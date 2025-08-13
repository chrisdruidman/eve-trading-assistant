import { FastifyPluginAsync } from 'fastify';
import { NotificationPreferences } from '../../../shared/dist/types';
import { NotificationSchedule } from '../models/preferenceRepository';

export const preferenceRoutes: FastifyPluginAsync = async fastify => {
  // Get user notification preferences
  fastify.get<{ Params: { userId: string } }>(
    '/user/:userId',
    {
      preHandler: fastify.authenticate,
      schema: {
        params: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.params;

      // Verify user can access these preferences
      if (request.user.id !== userId && request.user.role !== 'admin') {
        return reply.code(403).send({ error: 'Access denied' });
      }

      const preferences = await fastify.notificationService.getPreferences(userId);
      return reply.send({ preferences });
    }
  );

  // Update user notification preferences
  fastify.put<{
    Params: { userId: string };
    Body: NotificationPreferences;
  }>(
    '/user/:userId',
    {
      preHandler: fastify.authenticate,
      schema: {
        params: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['email', 'inApp', 'push'],
          properties: {
            email: { type: 'boolean' },
            inApp: { type: 'boolean' },
            push: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.params;
      const preferences = request.body;

      // Verify user can update these preferences
      if (request.user.id !== userId && request.user.role !== 'admin') {
        return reply.code(403).send({ error: 'Access denied' });
      }

      await fastify.notificationService.updatePreferences(userId, preferences);
      return reply.send({ success: true });
    }
  );

  // Get user notification schedule
  fastify.get<{ Params: { userId: string } }>(
    '/user/:userId/schedule',
    {
      preHandler: fastify.authenticate,
      schema: {
        params: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.params;

      // Verify user can access this schedule
      if (request.user.id !== userId && request.user.role !== 'admin') {
        return reply.code(403).send({ error: 'Access denied' });
      }

      const schedule = await fastify.notificationService.getSchedule(userId);
      return reply.send({ schedule });
    }
  );

  // Update user notification schedule
  fastify.put<{
    Params: { userId: string };
    Body: Omit<NotificationSchedule, 'userId'>;
  }>(
    '/user/:userId/schedule',
    {
      preHandler: fastify.authenticate,
      schema: {
        params: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            quietHoursStart: {
              type: 'string',
              pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$',
            },
            quietHoursEnd: {
              type: 'string',
              pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$',
            },
            timezone: { type: 'string' },
            maxDailyNotifications: {
              type: 'number',
              minimum: 1,
              maximum: 1000,
            },
            enableBatching: { type: 'boolean' },
            batchIntervalMinutes: {
              type: 'number',
              minimum: 15,
              maximum: 1440,
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.params;
      const scheduleData = request.body;

      // Verify user can update this schedule
      if (request.user.id !== userId && request.user.role !== 'admin') {
        return reply.code(403).send({ error: 'Access denied' });
      }

      const schedule: NotificationSchedule = {
        userId,
        ...scheduleData,
      };

      await fastify.notificationService.updateSchedule(schedule);
      return reply.send({ success: true });
    }
  );

  // Test notification delivery
  fastify.post<{
    Params: { userId: string };
    Body: { channel: 'EMAIL' | 'IN_APP' | 'PUSH' };
  }>(
    '/user/:userId/test',
    {
      preHandler: fastify.authenticate,
      schema: {
        params: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['channel'],
          properties: {
            channel: {
              type: 'string',
              enum: ['EMAIL', 'IN_APP', 'PUSH'],
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.params;
      const { channel } = request.body;

      // Verify user can test notifications
      if (request.user.id !== userId && request.user.role !== 'admin') {
        return reply.code(403).send({ error: 'Access denied' });
      }

      const testNotification = {
        userId,
        type: 'SYSTEM_UPDATE' as const,
        title: 'Test Notification',
        message: `This is a test notification for the ${channel} channel.`,
        priority: 'LOW' as const,
        channels: [channel],
      };

      const result = await fastify.notificationService.sendNotification(testNotification);

      if (result.success) {
        return reply.send({
          success: true,
          message: `Test notification sent via ${channel}`,
          notificationId: result.notificationId,
        });
      } else {
        return reply.code(400).send({
          success: false,
          error: result.error,
        });
      }
    }
  );
};
