import { FastifyPluginAsync } from 'fastify';
import { notificationRoutes } from './notifications';
import { preferenceRoutes } from './preferences';

export const routes: FastifyPluginAsync = async fastify => {
  await fastify.register(notificationRoutes, { prefix: '/notifications' });
  await fastify.register(preferenceRoutes, { prefix: '/preferences' });
};
