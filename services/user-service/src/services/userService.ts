import { User, UserPreferences, SubscriptionInfo } from '../../../../shared/src/types';
import { UserRepository } from '../models/userRepository';
import { UserPreferencesRepository } from '../models/userPreferencesRepository';

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  createdAt: Date;
  preferences: UserPreferences;
  subscription: SubscriptionInfo;
}

export interface UpdateProfileData {
  username?: string;
  email?: string;
}

export interface GDPRExportData {
  profile: any;
  preferences: any;
  eveCharacters: any[];
  tradingPlans: any[];
  watchlists: any[];
  exportedAt: Date;
}

export class UserService {
  constructor(
    private userRepository: UserRepository,
    private userPreferencesRepository: UserPreferencesRepository
  ) {}

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      return null;
    }

    let preferences = await this.userPreferencesRepository.findByUserId(userId);
    if (!preferences) {
      // Create default preferences if they don't exist
      preferences = await this.userPreferencesRepository.createDefault(userId);
    }

    // Default subscription info (can be extended later)
    const subscription: SubscriptionInfo = {
      tier: 'FREE',
    };

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      createdAt: user.created_at,
      preferences,
      subscription,
    };
  }

  async updateProfile(userId: string, updates: UpdateProfileData): Promise<UserProfile | null> {
    // Validate email uniqueness if updating email
    if (updates.email) {
      const existingUser = await this.userRepository.findByEmail(updates.email);
      if (existingUser && existingUser.id !== userId) {
        throw new Error('Email is already in use by another account');
      }
    }

    const updatedUser = await this.userRepository.updateProfile(userId, updates);
    if (!updatedUser) {
      return null;
    }

    return await this.getUserProfile(userId);
  }

  async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    let preferences = await this.userPreferencesRepository.findByUserId(userId);

    if (!preferences) {
      // Create default preferences if they don't exist
      preferences = await this.userPreferencesRepository.createDefault(userId);
    }

    return preferences;
  }

  async updatePreferences(
    userId: string,
    preferences: Partial<UserPreferences>
  ): Promise<UserPreferences | null> {
    // Validate user exists
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if preferences exist, create default if not
    let existingPreferences = await this.userPreferencesRepository.findByUserId(userId);
    if (!existingPreferences) {
      existingPreferences = await this.userPreferencesRepository.createDefault(userId);
    }

    return await this.userPreferencesRepository.update(userId, preferences);
  }

  async updateNotificationPreferences(
    userId: string,
    notifications: Partial<UserPreferences['notifications']>
  ): Promise<UserPreferences | null> {
    const partialPreferences: Partial<UserPreferences> = {};
    if (Object.keys(notifications).length > 0) {
      partialPreferences.notifications = notifications as UserPreferences['notifications'];
    }
    return await this.updatePreferences(userId, partialPreferences);
  }

  async updateTradingPreferences(
    userId: string,
    trading: Partial<UserPreferences['trading']>
  ): Promise<UserPreferences | null> {
    const partialPreferences: Partial<UserPreferences> = {};
    if (Object.keys(trading).length > 0) {
      partialPreferences.trading = trading as UserPreferences['trading'];
    }
    return await this.updatePreferences(userId, partialPreferences);
  }

  async updateTheme(userId: string, theme: 'light' | 'dark'): Promise<UserPreferences | null> {
    return await this.updatePreferences(userId, { theme });
  }

  async requestAccountDeletion(userId: string): Promise<{ success: boolean; scheduledFor: Date }> {
    // Soft delete the account (GDPR compliance - 30 day grace period)
    const success = await this.userRepository.softDelete(userId);

    if (!success) {
      throw new Error('User not found or already deleted');
    }

    // Schedule permanent deletion in 30 days
    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + 30);

    return {
      success: true,
      scheduledFor,
    };
  }

  async permanentlyDeleteAccount(userId: string): Promise<boolean> {
    // This should only be called after the grace period or by admin
    return await this.userRepository.hardDelete(userId);
  }

  async exportUserData(userId: string): Promise<GDPRExportData> {
    // GDPR Article 20 - Right to data portability
    const userData = await this.userRepository.getUserDataForExport(userId);

    return {
      ...userData,
      exportedAt: new Date(),
    };
  }

  async validateUserExists(userId: string): Promise<boolean> {
    const user = await this.userRepository.findById(userId);
    return !!user;
  }

  async getUserByEmail(email: string): Promise<UserProfile | null> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      return null;
    }

    return await this.getUserProfile(user.id);
  }

  async isEmailAvailable(email: string, excludeUserId?: string): Promise<boolean> {
    const existingUser = await this.userRepository.findByEmail(email);

    if (!existingUser) {
      return true;
    }

    // If excluding a specific user (for updates), check if it's the same user
    return excludeUserId ? existingUser.id === excludeUserId : false;
  }

  async isUsernameAvailable(username: string, excludeUserId?: string): Promise<boolean> {
    // Check if username is already taken by another user
    const existingUser = await this.userRepository.findByUsername(username);

    if (!existingUser) {
      return true;
    }

    // If excluding a specific user (for updates), check if it's the same user
    return excludeUserId ? existingUser.id === excludeUserId : false;
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<boolean> {
    // This would typically verify the current password and update to the new one
    // For now, we'll just validate that the user exists
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // In a real implementation, you would:
    // 1. Verify the current password
    // 2. Hash the new password
    // 3. Update the password in the database
    // 4. Invalidate existing sessions/tokens

    return await this.userRepository.updatePassword(userId, newPassword);
  }

  async getUserStats(userId: string): Promise<{
    profileCompleteness: number;
    lastLoginAt?: Date;
    accountAge: number;
    preferencesSet: boolean;
  }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const preferences = await this.userPreferencesRepository.findByUserId(userId);

    // Calculate profile completeness (basic implementation)
    let completeness = 0;
    if (user.username) completeness += 25;
    if (user.email) completeness += 25;
    if (preferences) completeness += 50;

    // Calculate account age in days
    const accountAge = Math.floor((Date.now() - user.created_at.getTime()) / (1000 * 60 * 60 * 24));

    return {
      profileCompleteness: completeness,
      lastLoginAt: user.updated_at, // This would be actual last login in real implementation
      accountAge,
      preferencesSet: !!preferences,
    };
  }

  async deactivateAccount(userId: string): Promise<boolean> {
    // Soft deactivation - different from deletion
    return await this.userRepository.deactivateAccount(userId);
  }

  async reactivateAccount(userId: string): Promise<boolean> {
    return await this.userRepository.reactivateAccount(userId);
  }
}
