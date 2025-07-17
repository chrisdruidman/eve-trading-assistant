import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from '../services/authService';
import { UserCredentials } from '../../../../shared/src/types';

export class AuthController {
  constructor(private authService: AuthService) {}

  async register(request: FastifyRequest, reply: FastifyReply) {
    try {
      const credentials = request.body as UserCredentials & { username: string };
      const result = await this.authService.registerUser(credentials);

      reply.code(201).send({
        data: result,
        message: 'User registered successfully',
      });
    } catch (error) {
      reply.code(400).send({
        error: error instanceof Error ? error.message : 'Registration failed',
      });
    }
  }

  async login(request: FastifyRequest, reply: FastifyReply) {
    try {
      const credentials = request.body as UserCredentials;
      const tokens = await this.authService.authenticateUser(credentials);

      reply.code(200).send({
        data: tokens,
        message: 'Login successful',
      });
    } catch (error) {
      reply.code(401).send({
        error: error instanceof Error ? error.message : 'Authentication failed',
      });
    }
  }

  async refreshToken(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { refreshToken } = request.body as { refreshToken: string };
      const tokens = await this.authService.refreshToken(refreshToken);

      reply.code(200).send({
        data: tokens,
        message: 'Token refreshed successfully',
      });
    } catch (error) {
      reply.code(401).send({
        error: error instanceof Error ? error.message : 'Token refresh failed',
      });
    }
  }

  async logout(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { refreshToken } = request.body as { refreshToken: string };
      await this.authService.revokeToken(refreshToken);

      reply.code(200).send({
        message: 'Logout successful',
      });
    } catch (error) {
      reply.code(400).send({
        error: error instanceof Error ? error.message : 'Logout failed',
      });
    }
  }

  async validateToken(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authorization = request.headers.authorization;
      if (!authorization) {
        return reply.code(401).send({ error: 'No authorization header' });
      }

      const token = authorization.replace('Bearer ', '');
      const isValid = await this.authService.validateToken(token);

      reply.code(200).send({
        data: { valid: isValid },
        message: 'Token validation complete',
      });
    } catch (error) {
      reply.code(401).send({
        error: error instanceof Error ? error.message : 'Token validation failed',
      });
    }
  }
}
