import { UserService } from '../../src/services/userService';
import { UserRepository } from '../../src/models/userRepository';
import { UserPreferencesRepository } from '../../src/models/userPreferencesRepository';

// Mock the repositories
jest.mock('../../src/models/userRepository');
jest.mock('../../src/models/userPreferencesRepository');

describe('UserService', () => {
  let userService: UserService;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockUserPreferencesRepository: jest.Mocked<UserPreferencesRepository>;

  beforeEach(() => {
    mockUserRepository = new UserRepository() as jest.Mocked<UserRepository>;
    mockUserPreferencesRepository =
      new UserPreferencesRepository() as jest.Mocked<UserPreferencesRepository>;
    userService = new UserService(mockUserRepository, mockUserPreferencesRepository);
  });

  describe('getUserProfile', () => {
    it('should return user profile with preferences', async () => {
      const userId = 'test-user-id';
      const mockUser = {
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockPreferences = {
        theme: 'light' as const,
        notifications: {
          email: true,
          inApp: true,
          push: false,
        },
        trading: {
          riskTolerance: 'MODERATE' as const,
          defaultBudget: 1000000,
          preferredRegions: [10000002],
        },
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserPreferencesRepository.findByUserId.mockResolvedValue(mockPreferences);

      const result = await userService.getUserProfile(userId);

      expect(result).toEqual({
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        createdAt: mockUser.created_at,
        preferences: mockPreferences,
        subscription: { tier: 'FREE' },
      });

      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
      expect(mockUserPreferencesRepository.findByUserId).toHaveBeenCalledWith(userId);
    });

    it('should return null if user not found', async () => {
      const userId = 'non-existent-user';
      mockUserRepository.findById.mockResolvedValue(null);

      const result = await userService.getUserProfile(userId);

      expect(result).toBeNull();
      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
    });

    it('should create default preferences if they do not exist', async () => {
      const userId = 'test-user-id';
      const mockUser = {
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockDefaultPreferences = {
        theme: 'light' as const,
        notifications: {
          email: true,
          inApp: true,
          push: false,
        },
        trading: {
          riskTolerance: 'MODERATE' as const,
          defaultBudget: 1000000,
          preferredRegions: [10000002],
        },
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserPreferencesRepository.findByUserId.mockResolvedValue(null);
      mockUserPreferencesRepository.createDefault.mockResolvedValue(mockDefaultPreferences);

      const result = await userService.getUserProfile(userId);

      expect(result?.preferences).toEqual(mockDefaultPreferences);
      expect(mockUserPreferencesRepository.createDefault).toHaveBeenCalledWith(userId);
    });
  });

  describe('updateProfile', () => {
    it('should update user profile successfully', async () => {
      const userId = 'test-user-id';
      const updates = { username: 'newusername', email: 'new@example.com' };

      const mockUpdatedUser = {
        id: userId,
        email: 'new@example.com',
        username: 'newusername',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockPreferences = {
        theme: 'light' as const,
        notifications: {
          email: true,
          inApp: true,
          push: false,
        },
        trading: {
          riskTolerance: 'MODERATE' as const,
          defaultBudget: 1000000,
          preferredRegions: [10000002],
        },
      };

      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.updateProfile.mockResolvedValue(mockUpdatedUser);
      mockUserRepository.findById.mockResolvedValue(mockUpdatedUser);
      mockUserPreferencesRepository.findByUserId.mockResolvedValue(mockPreferences);

      const result = await userService.updateProfile(userId, updates);

      expect(result?.email).toBe('new@example.com');
      expect(result?.username).toBe('newusername');
      expect(mockUserRepository.updateProfile).toHaveBeenCalledWith(userId, updates);
    });

    it('should throw error if email is already in use', async () => {
      const userId = 'test-user-id';
      const updates = { email: 'existing@example.com' };

      const existingUser = {
        id: 'different-user-id',
        email: 'existing@example.com',
        username: 'existinguser',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockUserRepository.findByEmail.mockResolvedValue(existingUser);

      await expect(userService.updateProfile(userId, updates)).rejects.toThrow(
        'Email is already in use by another account'
      );
    });
  });

  describe('requestAccountDeletion', () => {
    it('should soft delete user account', async () => {
      const userId = 'test-user-id';
      mockUserRepository.softDelete.mockResolvedValue(true);

      const result = await userService.requestAccountDeletion(userId);

      expect(result.success).toBe(true);
      expect(result.scheduledFor).toBeInstanceOf(Date);
      expect(mockUserRepository.softDelete).toHaveBeenCalledWith(userId);
    });

    it('should throw error if user not found', async () => {
      const userId = 'non-existent-user';
      mockUserRepository.softDelete.mockResolvedValue(false);

      await expect(userService.requestAccountDeletion(userId)).rejects.toThrow(
        'User not found or already deleted'
      );
    });
  });

  describe('isEmailAvailable', () => {
    it('should return true if email is available', async () => {
      const email = 'available@example.com';
      mockUserRepository.findByEmail.mockResolvedValue(null);

      const result = await userService.isEmailAvailable(email);

      expect(result).toBe(true);
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(email);
    });

    it('should return false if email is taken by another user', async () => {
      const email = 'taken@example.com';
      const existingUser = {
        id: 'other-user-id',
        email: 'taken@example.com',
        username: 'otheruser',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockUserRepository.findByEmail.mockResolvedValue(existingUser);

      const result = await userService.isEmailAvailable(email);

      expect(result).toBe(false);
    });

    it('should return true if email belongs to the excluded user', async () => {
      const email = 'user@example.com';
      const userId = 'test-user-id';
      const existingUser = {
        id: userId,
        email: 'user@example.com',
        username: 'testuser',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockUserRepository.findByEmail.mockResolvedValue(existingUser);

      const result = await userService.isEmailAvailable(email, userId);

      expect(result).toBe(true);
    });
  });

  describe('isUsernameAvailable', () => {
    it('should return true if username is available', async () => {
      const username = 'availableuser';
      mockUserRepository.findByUsername.mockResolvedValue(null);

      const result = await userService.isUsernameAvailable(username);

      expect(result).toBe(true);
      expect(mockUserRepository.findByUsername).toHaveBeenCalledWith(username);
    });

    it('should return false if username is taken by another user', async () => {
      const username = 'takenuser';
      const existingUser = {
        id: 'other-user-id',
        email: 'other@example.com',
        username: 'takenuser',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockUserRepository.findByUsername.mockResolvedValue(existingUser);

      const result = await userService.isUsernameAvailable(username);

      expect(result).toBe(false);
    });

    it('should return true if username belongs to the excluded user', async () => {
      const username = 'testuser';
      const userId = 'test-user-id';
      const existingUser = {
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockUserRepository.findByUsername.mockResolvedValue(existingUser);

      const result = await userService.isUsernameAvailable(username, userId);

      expect(result).toBe(true);
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const userId = 'test-user-id';
      const currentPassword = 'oldpassword';
      const newPassword = 'newpassword';

      const mockUser = {
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.updatePassword.mockResolvedValue(true);

      const result = await userService.changePassword(userId, currentPassword, newPassword);

      expect(result).toBe(true);
      expect(mockUserRepository.updatePassword).toHaveBeenCalledWith(userId, newPassword);
    });

    it('should throw error if user not found', async () => {
      const userId = 'non-existent-user';
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(userService.changePassword(userId, 'oldpass', 'newpass')).rejects.toThrow(
        'User not found'
      );
    });
  });

  describe('getUserStats', () => {
    it('should return user statistics', async () => {
      const userId = 'test-user-id';
      const mockUser = {
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        updated_at: new Date(),
      };

      const mockPreferences = {
        theme: 'light' as const,
        notifications: {
          email: true,
          inApp: true,
          push: false,
        },
        trading: {
          riskTolerance: 'MODERATE' as const,
          defaultBudget: 1000000,
          preferredRegions: [10000002],
        },
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserPreferencesRepository.findByUserId.mockResolvedValue(mockPreferences);

      const result = await userService.getUserStats(userId);

      expect(result.profileCompleteness).toBe(100); // email + username + preferences
      expect(result.accountAge).toBe(30);
      expect(result.preferencesSet).toBe(true);
      expect(result.lastLoginAt).toEqual(mockUser.updated_at);
    });

    it('should throw error if user not found', async () => {
      const userId = 'non-existent-user';
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(userService.getUserStats(userId)).rejects.toThrow('User not found');
    });
  });

  describe('deactivateAccount', () => {
    it('should deactivate account successfully', async () => {
      const userId = 'test-user-id';
      mockUserRepository.deactivateAccount.mockResolvedValue(true);

      const result = await userService.deactivateAccount(userId);

      expect(result).toBe(true);
      expect(mockUserRepository.deactivateAccount).toHaveBeenCalledWith(userId);
    });
  });

  describe('reactivateAccount', () => {
    it('should reactivate account successfully', async () => {
      const userId = 'test-user-id';
      mockUserRepository.reactivateAccount.mockResolvedValue(true);

      const result = await userService.reactivateAccount(userId);

      expect(result).toBe(true);
      expect(mockUserRepository.reactivateAccount).toHaveBeenCalledWith(userId);
    });
  });
});
