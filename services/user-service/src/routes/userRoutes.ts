import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { UserService, UpdateProfileData } from '../services/userService';
import { UserPreferences } from '../../../../shared/src/types';
import { userSchemas } from '../schemas/userSchemas';

export interface UserRoutesOptions {
  userService: UserService;
}

export async function userRoutes(fastify: FastifyInstance, options: UserRoutesOptions) {
  const { userService } = options;

  // Get user profile
  fastify.get(
    '/profile',
    {
      preHandler: fastify.authenticate,
      schema: userSchemas.getProfile,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.userId;
        const profile = await userService.getUserProfile(userId);

        if (!profile) {
          return reply.code(404).send({
            error: 'NOT_FOUND',
            message: 'User profile not found',
            code: 'USER_NOT_FOUND',
          });
        }

        return reply.send({
          success: true,
          data: profile,
        });
      } catch (error) {
        fastify.log.error('Error getting user profile:', error);
        return reply.code(500).send({
          error: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve user profile',
          code: 'PROFILE_FETCH_ERROR',
        });
      }
    }
  );

  // Update user profile
  fastify.put(
    '/profile',
    {
      preHandler: fastify.authenticate,
      schema: userSchemas.updateProfile,
    },
    async (request: FastifyRequest<{ Body: UpdateProfileData }>, reply: FastifyReply) => {
      try {
        const userId = request.user!.userId;
        const updates = request.body;

        const updatedProfile = await userService.updateProfile(userId, updates);

        if (!updatedProfile) {
          return reply.code(404).send({
            error: 'NOT_FOUND',
            message: 'User not found',
            code: 'USER_NOT_FOUND',
          });
        }

        return reply.send({
          success: true,
          data: updatedProfile,
          message: 'Profile updated successfully',
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('Email is already in use')) {
          return reply.code(409).send({
            error: 'CONFLICT',
            message: error.message,
            code: 'EMAIL_ALREADY_EXISTS',
          });
        }

        fastify.log.error('Error updating user profile:', error);
        return reply.code(500).send({
          error: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update user profile',
          code: 'PROFILE_UPDATE_ERROR',
        });
      }
    }
  );

  // Get user preferences
  fastify.get(
    '/preferences',
    {
      preHandler: fastify.authenticate,
      schema: userSchemas.getPreferences,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.userId;
        const preferences = await userService.getUserPreferences(userId);

        if (!preferences) {
          return reply.code(404).send({
            error: 'NOT_FOUND',
            message: 'User preferences not found',
            code: 'PREFERENCES_NOT_FOUND',
          });
        }

        return reply.send({
          success: true,
          data: preferences,
        });
      } catch (error) {
        fastify.log.error('Error getting user preferences:', error);
        return reply.code(500).send({
          error: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve user preferences',
          code: 'PREFERENCES_FETCH_ERROR',
        });
      }
    }
  );

  // Update user preferences
  fastify.put(
    '/preferences',
    {
      preHandler: fastify.authenticate,
      schema: userSchemas.updatePreferences,
    },
    async (request: FastifyRequest<{ Body: Partial<UserPreferences> }>, reply: FastifyReply) => {
      try {
        const userId = request.user!.userId;
        const preferences = request.body;

        const updatedPreferences = await userService.updatePreferences(userId, preferences);

        if (!updatedPreferences) {
          return reply.code(404).send({
            error: 'NOT_FOUND',
            message: 'User not found',
            code: 'USER_NOT_FOUND',
          });
        }

        return reply.send({
          success: true,
          data: updatedPreferences,
          message: 'Preferences updated successfully',
        });
      } catch (error) {
        fastify.log.error('Error updating user preferences:', error);
        return reply.code(500).send({
          error: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update user preferences',
          code: 'PREFERENCES_UPDATE_ERROR',
        });
      }
    }
  );

  // Update notification preferences
  fastify.put(
    '/preferences/notifications',
    {
      preHandler: fastify.authenticate,
      schema: userSchemas.updateNotificationPreferences,
    },
    async (
      request: FastifyRequest<{ Body: Partial<UserPreferences['notifications']> }>,
      reply: FastifyReply
    ) => {
      try {
        const userId = request.user!.userId;
        const notifications = request.body;

        const updatedPreferences = await userService.updateNotificationPreferences(
          userId,
          notifications
        );

        if (!updatedPreferences) {
          return reply.code(404).send({
            error: 'NOT_FOUND',
            message: 'User not found',
            code: 'USER_NOT_FOUND',
          });
        }

        return reply.send({
          success: true,
          data: updatedPreferences.notifications,
          message: 'Notification preferences updated successfully',
        });
      } catch (error) {
        fastify.log.error('Error updating notification preferences:', error);
        return reply.code(500).send({
          error: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update notification preferences',
          code: 'NOTIFICATION_PREFERENCES_UPDATE_ERROR',
        });
      }
    }
  );

  // Update trading preferences
  fastify.put(
    '/preferences/trading',
    {
      preHandler: fastify.authenticate,
      schema: userSchemas.updateTradingPreferences,
    },
    async (
      request: FastifyRequest<{ Body: Partial<UserPreferences['trading']> }>,
      reply: FastifyReply
    ) => {
      try {
        const userId = request.user!.userId;
        const trading = request.body;

        const updatedPreferences = await userService.updateTradingPreferences(userId, trading);

        if (!updatedPreferences) {
          return reply.code(404).send({
            error: 'NOT_FOUND',
            message: 'User not found',
            code: 'USER_NOT_FOUND',
          });
        }

        return reply.send({
          success: true,
          data: updatedPreferences.trading,
          message: 'Trading preferences updated successfully',
        });
      } catch (error) {
        fastify.log.error('Error updating trading preferences:', error);
        return reply.code(500).send({
          error: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update trading preferences',
          code: 'TRADING_PREFERENCES_UPDATE_ERROR',
        });
      }
    }
  );

  // Update theme
  fastify.put(
    '/preferences/theme',
    {
      preHandler: fastify.authenticate,
      schema: userSchemas.updateTheme,
    },
    async (request: FastifyRequest<{ Body: { theme: 'light' | 'dark' } }>, reply: FastifyReply) => {
      try {
        const userId = request.user!.userId;
        const { theme } = request.body;

        const updatedPreferences = await userService.updateTheme(userId, theme);

        if (!updatedPreferences) {
          return reply.code(404).send({
            error: 'NOT_FOUND',
            message: 'User not found',
            code: 'USER_NOT_FOUND',
          });
        }

        return reply.send({
          success: true,
          data: { theme: updatedPreferences.theme },
          message: 'Theme updated successfully',
        });
      } catch (error) {
        fastify.log.error('Error updating theme:', error);
        return reply.code(500).send({
          error: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update theme',
          code: 'THEME_UPDATE_ERROR',
        });
      }
    }
  );

  // Request account deletion (GDPR compliance)
  fastify.post(
    '/delete-account',
    {
      preHandler: fastify.authenticate,
      schema: userSchemas.deleteAccount,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.userId;
        const result = await userService.requestAccountDeletion(userId);

        return reply.send({
          success: true,
          data: result,
          message:
            'Account deletion requested. Your account will be permanently deleted in 30 days. Contact support to cancel this request.',
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          return reply.code(404).send({
            error: 'NOT_FOUND',
            message: 'User not found',
            code: 'USER_NOT_FOUND',
          });
        }

        fastify.log.error('Error requesting account deletion:', error);
        return reply.code(500).send({
          error: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to process account deletion request',
          code: 'ACCOUNT_DELETION_ERROR',
        });
      }
    }
  );

  // Export user data (GDPR compliance)
  fastify.get(
    '/export-data',
    {
      preHandler: fastify.authenticate,
      schema: userSchemas.exportData,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.userId;
        const exportData = await userService.exportUserData(userId);

        // Set headers for file download
        reply.header('Content-Type', 'application/json');
        reply.header(
          'Content-Disposition',
          `attachment; filename="user-data-export-${userId}.json"`
        );

        return reply.send(exportData);
      } catch (error) {
        fastify.log.error('Error exporting user data:', error);
        return reply.code(500).send({
          error: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to export user data',
          code: 'DATA_EXPORT_ERROR',
        });
      }
    }
  );

  // Check email availability
  fastify.post(
    '/check-email',
    {
      preHandler: fastify.optionalAuth,
      schema: userSchemas.checkEmail,
    },
    async (request: FastifyRequest<{ Body: { email: string } }>, reply: FastifyReply) => {
      try {
        const { email } = request.body;
        const userId = request.user?.userId;

        const isAvailable = await userService.isEmailAvailable(email, userId);

        return reply.send({
          success: true,
          data: { available: isAvailable },
        });
      } catch (error) {
        fastify.log.error('Error checking email availability:', error);
        return reply.code(500).send({
          error: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to check email availability',
          code: 'EMAIL_CHECK_ERROR',
        });
      }
    }
  );

  // Check username availability
  fastify.post(
    '/check-username',
    {
      preHandler: fastify.optionalAuth,
      schema: userSchemas.checkUsername,
    },
    async (request: FastifyRequest<{ Body: { username: string } }>, reply: FastifyReply) => {
      try {
        const { username } = request.body;
        const userId = request.user?.userId;

        const isAvailable = await userService.isUsernameAvailable(username, userId);

        return reply.send({
          success: true,
          data: { available: isAvailable },
        });
      } catch (error) {
        fastify.log.error('Error checking username availability:', error);
        return reply.code(500).send({
          error: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to check username availability',
          code: 'USERNAME_CHECK_ERROR',
        });
      }
    }
  );

  // Change password
  fastify.put(
    '/change-password',
    {
      preHandler: fastify.authenticate,
      schema: userSchemas.changePassword,
    },
    async (
      request: FastifyRequest<{ Body: { currentPassword: string; newPassword: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const userId = request.user!.userId;
        const { currentPassword, newPassword } = request.body;

        const success = await userService.changePassword(userId, currentPassword, newPassword);

        if (!success) {
          return reply.code(400).send({
            error: 'BAD_REQUEST',
            message: 'Failed to change password. Please check your current password.',
            code: 'PASSWORD_CHANGE_FAILED',
          });
        }

        return reply.send({
          success: true,
          message: 'Password changed successfully',
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          return reply.code(404).send({
            error: 'NOT_FOUND',
            message: 'User not found',
            code: 'USER_NOT_FOUND',
          });
        }

        fastify.log.error('Error changing password:', error);
        return reply.code(500).send({
          error: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to change password',
          code: 'PASSWORD_CHANGE_ERROR',
        });
      }
    }
  );

  // Get user statistics
  fastify.get(
    '/stats',
    {
      preHandler: fastify.authenticate,
      schema: userSchemas.getUserStats,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.userId;
        const stats = await userService.getUserStats(userId);

        return reply.send({
          success: true,
          data: stats,
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          return reply.code(404).send({
            error: 'NOT_FOUND',
            message: 'User not found',
            code: 'USER_NOT_FOUND',
          });
        }

        fastify.log.error('Error getting user stats:', error);
        return reply.code(500).send({
          error: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve user statistics',
          code: 'USER_STATS_ERROR',
        });
      }
    }
  );

  // Deactivate account
  fastify.post(
    '/deactivate',
    {
      preHandler: fastify.authenticate,
      schema: userSchemas.deactivateAccount,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.userId;
        const success = await userService.deactivateAccount(userId);

        if (!success) {
          return reply.code(404).send({
            error: 'NOT_FOUND',
            message: 'User not found',
            code: 'USER_NOT_FOUND',
          });
        }

        return reply.send({
          success: true,
          message: 'Account deactivated successfully. You can reactivate it by logging in again.',
        });
      } catch (error) {
        fastify.log.error('Error deactivating account:', error);
        return reply.code(500).send({
          error: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to deactivate account',
          code: 'ACCOUNT_DEACTIVATION_ERROR',
        });
      }
    }
  );

  // Reactivate account
  fastify.post(
    '/reactivate',
    {
      preHandler: fastify.authenticate,
      schema: userSchemas.reactivateAccount,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.userId;
        const success = await userService.reactivateAccount(userId);

        if (!success) {
          return reply.code(404).send({
            error: 'NOT_FOUND',
            message: 'User not found',
            code: 'USER_NOT_FOUND',
          });
        }

        return reply.send({
          success: true,
          message: 'Account reactivated successfully',
        });
      } catch (error) {
        fastify.log.error('Error reactivating account:', error);
        return reply.code(500).send({
          error: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to reactivate account',
          code: 'ACCOUNT_REACTIVATION_ERROR',
        });
      }
    }
  );

  // Validate user exists (for other services)
  fastify.get(
    '/validate/:userId',
    {
      schema: userSchemas.validateUser,
    },
    async (request: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) => {
      try {
        const { userId } = request.params;
        const exists = await userService.validateUserExists(userId);

        return reply.send({
          success: true,
          data: { exists },
        });
      } catch (error) {
        fastify.log.error('Error validating user:', error);
        return reply.code(500).send({
          error: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to validate user',
          code: 'USER_VALIDATION_ERROR',
        });
      }
    }
  );
}
