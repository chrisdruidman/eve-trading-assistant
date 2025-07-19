import { FastifyPluginAsync } from 'fastify';
import { NotificationRequest } from '../services/notificationService';

interface NotificationParams {
  id: string;
}

interface NotificationQuery {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}

export const notificationRoutes: FastifyPluginAsync = async fastify => {
  // Send a single notification
  fastify.post<{ Body: NotificationRequest }>(
    '/',
    {
      preHandler: fastify.authenticate,
      schema: {
        body: {
          type: 'object',
          required: ['userId', 'type', 'title', 'message', 'priority'],
          properties: {
            userId: { type: 'string' },
            type: {
              type: 'string',
              enum: ['MARKET_ALERT', 'TRADING_OPPORTUNITY', 'SYSTEM_UPDATE', 'ACCOUNT_NOTICE'],
            },
            title: { type: 'string', minLength: 1, maxLength: 200 },
            message: { type: 'string', minLength: 1, maxLength: 1000 },
            priority: {
              type: 'string',
              enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
            },
            data: { type: 'object' },
            channels: {
              type: 'array',
              items: { type: 'string', enum: ['EMAIL', 'IN_APP', 'PUSH'] },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const result = await fastify.notificationService.sendNotification(request.body);

      if (result.success) {
        return reply.code(201).send({
          success: true,
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

  // Send batch notifications
  fastify.post<{ Body: { notifications: NotificationRequest[] } }>(
    '/batch',
    {
      preHandler: fastify.authenticate,
      schema: {
        body: {
          type: 'object',
          required: ['notifications'],
          properties: {
            notifications: {
              type: 'array',
              items: {
                type: 'object',
                required: ['userId', 'type', 'title', 'message', 'priority'],
                properties: {
                  userId: { type: 'string' },
                  type: {
                    type: 'string',
                    enum: [
                      'MARKET_ALERT',
                      'TRADING_OPPORTUNITY',
                      'SYSTEM_UPDATE',
                      'ACCOUNT_NOTICE',
                    ],
                  },
                  title: { type: 'string', minLength: 1, maxLength: 200 },
                  message: { type: 'string', minLength: 1, maxLength: 1000 },
                  priority: {
                    type: 'string',
                    enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
                  },
                  data: { type: 'object' },
                  channels: {
                    type: 'array',
                    items: { type: 'string', enum: ['EMAIL', 'IN_APP', 'PUSH'] },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const result = await fastify.notificationService.sendBatchNotification(
        request.body.notifications
      );
      return reply.send(result);
    }
  );

  // Get user notifications
  fastify.get<{
    Querystring: NotificationQuery;
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
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'number', minimum: 1, maximum: 100, default: 50 },
            offset: { type: 'number', minimum: 0, default: 0 },
            unreadOnly: { type: 'boolean', default: false },
          },
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const options = request.query;

      // Verify user can access these notifications
      if (request.user.id !== userId && request.user.role !== 'admin') {
        return reply.code(403).send({ error: 'Access denied' });
      }

      const notifications = await fastify.notificationService.getNotifications(userId, options);
      return reply.send({ notifications });
    }
  );

  // Get unread count
  fastify.get<{ Params: { userId: string } }>(
    '/user/:userId/unread-count',
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

      // Verify user can access this data
      if (request.user.id !== userId && request.user.role !== 'admin') {
        return reply.code(403).send({ error: 'Access denied' });
      }

      const count = await fastify.notificationService.getUnreadCount(userId);
      return reply.send({ unreadCount: count });
    }
  );

  // Mark notification as read
  fastify.patch<{ Params: NotificationParams }>(
    '/:id/read',
    {
      preHandler: fastify.authenticate,
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.user.id;

      try {
        await fastify.notificationService.markAsRead(id, userId);
        return reply.send({ success: true });
      } catch (error) {
        return reply.code(404).send({
          error: 'Notification not found or access denied',
        });
      }
    }
  );

  // Mark all notifications as read
  fastify.patch<{ Params: { userId: string } }>(
    '/user/:userId/read-all',
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

      // Verify user can perform this action
      if (request.user.id !== userId && request.user.role !== 'admin') {
        return reply.code(403).send({ error: 'Access denied' });
      }

      await fastify.notificationService.markAllAsRead(userId);
      return reply.send({ success: true });
    }
  );

  // WebSocket endpoint for real-time notifications
  fastify.get<{ Params: { userId: string } }>(
    '/user/:userId/stream',
    {
      websocket: true,
      preHandler: fastify.authenticate,
    },
    async (connection, request) => {
      const { userId } = request.params as { userId: string };

      // Verify user can access this stream
      if (request.user.id !== userId && request.user.role !== 'admin') {
        connection.socket.close(1008, 'Access denied');
        return;
      }

      // Subscribe to user notifications
      const unsubscribe = await fastify.inAppService.subscribeToUserNotifications(
        userId,
        notification => {
          connection.socket.send(JSON.stringify(notification));
        }
      );

      connection.socket.on('close', () => {
        unsubscribe();
      });

      // Send initial unread count
      const unreadCount = await fastify.notificationService.getUnreadCount(userId);
      connection.socket.send(
        JSON.stringify({
          type: 'UNREAD_COUNT',
          count: unreadCount,
        })
      );
    }
  );

  // Admin endpoint to cleanup old notifications
  fastify.delete(
    '/cleanup',
    {
      preHandler: fastify.authenticate,
      schema: {
        querystring: {
          type: 'object',
          properties: {
            daysOld: { type: 'number', minimum: 1, default: 30 },
          },
        },
      },
    },
    async (request, reply) => {
      // Verify admin access
      if (request.user.role !== 'admin') {
        return reply.code(403).send({ error: 'Admin access required' });
      }

      const { daysOld = 30 } = request.query as { daysOld?: number };
      const result = await fastify.notificationService.cleanupOldNotifications(daysOld);

      return reply.send({
        success: true,
        cleaned: result,
      });
    }
  );
};
