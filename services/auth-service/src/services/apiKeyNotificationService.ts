import { EveApiKeyService } from './eveApiKeyService';
import { UserRepository } from '../models/userRepository';
import { EveCharacter } from '../../../../shared/src/types';

export interface NotificationPreferences {
  email: boolean;
  inApp: boolean;
  daysBeforeExpiry: number[];
}

export interface ApiKeyNotification {
  userId: string;
  userEmail: string;
  character: EveCharacter;
  daysUntilExpiry: number;
  notificationType: 'EXPIRING_SOON' | 'EXPIRED' | 'INVALID';
}

export class ApiKeyNotificationService {
  constructor(
    private eveApiKeyService: EveApiKeyService,
    private userRepository: UserRepository
  ) {}

  /**
   * Check for API keys that need renewal notifications
   * @param daysAhead - Number of days to look ahead for expiring keys
   * @returns Array of notifications to send
   */
  async checkForExpiringKeys(daysAhead: number = 7): Promise<ApiKeyNotification[]> {
    const notifications: ApiKeyNotification[] = [];

    try {
      // Get characters with expiring API keys
      const expiringCharacters =
        await this.eveApiKeyService.getCharactersWithExpiringKeys(daysAhead);

      for (const character of expiringCharacters) {
        // Find the user for this character
        const characterRecord = await this.eveApiKeyService[
          'eveCharacterRepository'
        ].findByCharacterId(character.characterId);

        if (!characterRecord) {
          continue;
        }

        const user = await this.userRepository.findById(characterRecord.userId);
        if (!user) {
          continue;
        }

        // Calculate days until expiry
        const now = new Date();
        const expiryDate = new Date(characterRecord.expiresAt);
        const daysUntilExpiry = Math.ceil(
          (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        let notificationType: 'EXPIRING_SOON' | 'EXPIRED' | 'INVALID';
        if (daysUntilExpiry <= 0) {
          notificationType = 'EXPIRED';
        } else if (!characterRecord.isValid) {
          notificationType = 'INVALID';
        } else {
          notificationType = 'EXPIRING_SOON';
        }

        notifications.push({
          userId: user.id,
          userEmail: user.email,
          character,
          daysUntilExpiry,
          notificationType,
        });
      }

      return notifications;
    } catch (error) {
      throw new Error(
        `Failed to check for expiring keys: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate email notification content for API key renewal
   * @param notification - Notification details
   * @returns Email content
   */
  generateEmailNotification(notification: ApiKeyNotification): {
    subject: string;
    htmlBody: string;
    textBody: string;
  } {
    const { character, daysUntilExpiry, notificationType } = notification;

    let subject: string;
    let urgency: string;
    let actionText: string;

    switch (notificationType) {
      case 'EXPIRED':
        subject = `EVE API Key Expired - ${character.characterName}`;
        urgency = 'Your EVE Online API key has expired';
        actionText =
          'Please renew your API key immediately to continue using the trading assistant.';
        break;
      case 'INVALID':
        subject = `EVE API Key Invalid - ${character.characterName}`;
        urgency = 'Your EVE Online API key is no longer valid';
        actionText = 'Please re-add your character to restore access to the trading assistant.';
        break;
      default:
        subject = `EVE API Key Expiring Soon - ${character.characterName}`;
        urgency = `Your EVE Online API key expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}`;
        actionText = 'Please renew your API key to avoid interruption of service.';
    }

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${subject}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
          .alert { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
          .character-info { background-color: #e9ecef; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .button { display: inline-block; background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>EVE Trading Assistant</h1>
            <h2>${subject}</h2>
          </div>
          
          <div class="alert">
            <strong>⚠️ Action Required:</strong> ${urgency}
          </div>
          
          <div class="character-info">
            <h3>Character Details:</h3>
            <ul>
              <li><strong>Name:</strong> ${character.characterName}</li>
              <li><strong>Character ID:</strong> ${character.characterId}</li>
              <li><strong>Corporation ID:</strong> ${character.corporationId}</li>
              ${character.allianceId ? `<li><strong>Alliance ID:</strong> ${character.allianceId}</li>` : ''}
              <li><strong>Last Sync:</strong> ${character.lastSync.toLocaleDateString()}</li>
            </ul>
          </div>
          
          <p>${actionText}</p>
          
          <a href="${process.env.FRONTEND_URL || 'https://app.example.com'}/characters" class="button">
            Manage API Keys
          </a>
          
          <h3>What you need to do:</h3>
          <ol>
            <li>Log in to the EVE Trading Assistant</li>
            <li>Go to your Character Management page</li>
            <li>Remove the expired/invalid character</li>
            <li>Re-add your character with a new API key</li>
          </ol>
          
          <div class="footer">
            <p>This is an automated notification from EVE Trading Assistant.</p>
            <p>If you no longer wish to receive these notifications, you can update your preferences in your account settings.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textBody = `
EVE Trading Assistant - ${subject}

⚠️ Action Required: ${urgency}

Character Details:
- Name: ${character.characterName}
- Character ID: ${character.characterId}
- Corporation ID: ${character.corporationId}
${character.allianceId ? `- Alliance ID: ${character.allianceId}` : ''}
- Last Sync: ${character.lastSync.toLocaleDateString()}

${actionText}

What you need to do:
1. Log in to the EVE Trading Assistant
2. Go to your Character Management page
3. Remove the expired/invalid character
4. Re-add your character with a new API key

Manage your API keys: ${process.env.FRONTEND_URL || 'https://app.example.com'}/characters

---
This is an automated notification from EVE Trading Assistant.
If you no longer wish to receive these notifications, you can update your preferences in your account settings.
    `;

    return {
      subject,
      htmlBody,
      textBody,
    };
  }

  /**
   * Generate in-app notification for API key renewal
   * @param notification - Notification details
   * @returns In-app notification data
   */
  generateInAppNotification(notification: ApiKeyNotification): {
    title: string;
    message: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    actionUrl: string;
  } {
    const { character, daysUntilExpiry, notificationType } = notification;

    let title: string;
    let message: string;
    let priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

    switch (notificationType) {
      case 'EXPIRED':
        title = 'API Key Expired';
        message = `Your EVE Online API key for ${character.characterName} has expired. Please renew it to continue using the trading assistant.`;
        priority = 'URGENT';
        break;
      case 'INVALID':
        title = 'API Key Invalid';
        message = `Your EVE Online API key for ${character.characterName} is no longer valid. Please re-add your character.`;
        priority = 'HIGH';
        break;
      default:
        title = 'API Key Expiring Soon';
        message = `Your EVE Online API key for ${character.characterName} expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}. Please renew it to avoid service interruption.`;
        priority = daysUntilExpiry <= 3 ? 'HIGH' : 'MEDIUM';
    }

    return {
      title,
      message,
      priority,
      actionUrl: '/characters',
    };
  }

  /**
   * Schedule notification checks (to be called by a cron job or scheduler)
   * @returns Summary of notifications that should be sent
   */
  async scheduleNotificationCheck(): Promise<{
    totalNotifications: number;
    expiringSoon: number;
    expired: number;
    invalid: number;
  }> {
    const notifications = await this.checkForExpiringKeys(7);

    const summary = {
      totalNotifications: notifications.length,
      expiringSoon: notifications.filter(n => n.notificationType === 'EXPIRING_SOON').length,
      expired: notifications.filter(n => n.notificationType === 'EXPIRED').length,
      invalid: notifications.filter(n => n.notificationType === 'INVALID').length,
    };

    // In a real implementation, you would send these notifications
    // to an email service, push notification service, etc.
    // For now, we just return the summary

    return summary;
  }
}
