import { FastifyPluginAsync } from 'fastify';
import { NotificationService } from '../services/notificationService';
import { EmailService } from '../services/emailService';
import { InAppService } from '../services/inAppService';
import { NotificationRepository } from '../models/notificationRepository';
import { PreferenceRepository } from '../models/preferenceRepository';

declare module 'fastify' {
  interface FastifyInstance {
    notificationService: NotificationService;
    emailService: EmailService;
    inAppService: InAppService;
  }
}

export const notificationPlugin: FastifyPluginAsync = async fastify => {
  // Initialize repositories
  const notificationRepository = new NotificationRepository(fastify.db);
  const preferenceRepository = new PreferenceRepository(fastify.db);

  // Initialize services
  const emailService = new EmailService();
  const inAppService = new InAppService(fastify.redis);
  const notificationService = new NotificationService(
    notificationRepository,
    preferenceRepository,
    emailService,
    inAppService,
    fastify.redis
  );

  // Decorate fastify instance
  fastify.decorate('notificationService', notificationService);
  fastify.decorate('emailService', emailService);
  fastify.decorate('inAppService', inAppService);

  // Start background services
  await notificationService.startScheduler();

  fastify.addHook('onClose', async () => {
    await notificationService.stopScheduler();
  });
};
