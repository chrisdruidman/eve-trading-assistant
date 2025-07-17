import { AuthController } from '../controllers/authController';

declare module 'fastify' {
  interface FastifyInstance {
    authController: AuthController;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    optionalAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
