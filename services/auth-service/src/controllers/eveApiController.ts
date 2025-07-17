import { FastifyRequest, FastifyReply } from 'fastify';
import { EveApiKeyService } from '../services/eveApiKeyService';
import { ApiKeyNotificationService } from '../services/apiKeyNotificationService';

export class EveApiController {
  constructor(
    private eveApiKeyService: EveApiKeyService,
    private notificationService: ApiKeyNotificationService
  ) {}

  /**
   * Add a new EVE Online API key for a user
   */
  async addApiKey(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { accessToken, refreshToken } = request.body as {
        accessToken: string;
        refreshToken?: string;
      };

      // Get user ID from authenticated request (assuming auth middleware sets this)
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.code(401).send({
          error: 'Authentication required',
        });
      }

      const character = await this.eveApiKeyService.addApiKey({
        userId,
        accessToken,
        refreshToken,
      });

      reply.code(201).send({
        data: character,
        message: 'EVE character added successfully',
      });
    } catch (error) {
      reply.code(400).send({
        error: error instanceof Error ? error.message : 'Failed to add API key',
      });
    }
  }

  /**
   * Get all characters for the authenticated user
   */
  async getUserCharacters(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.code(401).send({
          error: 'Authentication required',
        });
      }

      const characters = await this.eveApiKeyService.getUserCharacters(userId);

      reply.code(200).send({
        data: characters,
        message: 'Characters retrieved successfully',
      });
    } catch (error) {
      reply.code(500).send({
        error: error instanceof Error ? error.message : 'Failed to retrieve characters',
      });
    }
  }

  /**
   * Validate a specific character's API key
   */
  async validateApiKey(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { characterId } = request.params as { characterId: string };
      const userId = (request as any).user?.id;

      if (!userId) {
        return reply.code(401).send({
          error: 'Authentication required',
        });
      }

      const result = await this.eveApiKeyService.validateApiKey(userId, parseInt(characterId));

      reply.code(200).send({
        data: result,
        message: 'API key validation completed',
      });
    } catch (error) {
      reply.code(400).send({
        error: error instanceof Error ? error.message : 'Failed to validate API key',
      });
    }
  }

  /**
   * Refresh character information from EVE Online
   */
  async refreshCharacter(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { characterId } = request.params as { characterId: string };
      const userId = (request as any).user?.id;

      if (!userId) {
        return reply.code(401).send({
          error: 'Authentication required',
        });
      }

      const character = await this.eveApiKeyService.refreshCharacterInfo(
        userId,
        parseInt(characterId)
      );

      reply.code(200).send({
        data: character,
        message: 'Character information refreshed successfully',
      });
    } catch (error) {
      reply.code(400).send({
        error: error instanceof Error ? error.message : 'Failed to refresh character',
      });
    }
  }

  /**
   * Remove a character and its API key
   */
  async removeCharacter(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { characterId } = request.params as { characterId: string };
      const userId = (request as any).user?.id;

      if (!userId) {
        return reply.code(401).send({
          error: 'Authentication required',
        });
      }

      const removed = await this.eveApiKeyService.removeCharacter(userId, parseInt(characterId));

      if (!removed) {
        return reply.code(404).send({
          error: 'Character not found',
        });
      }

      reply.code(200).send({
        message: 'Character removed successfully',
      });
    } catch (error) {
      reply.code(400).send({
        error: error instanceof Error ? error.message : 'Failed to remove character',
      });
    }
  }

  /**
   * Check if a character has required scopes for trading
   */
  async checkScopes(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { characterId } = request.params as { characterId: string };
      const userId = (request as any).user?.id;

      if (!userId) {
        return reply.code(401).send({
          error: 'Authentication required',
        });
      }

      const hasScopes = await this.eveApiKeyService.hasRequiredScopes(
        userId,
        parseInt(characterId)
      );

      reply.code(200).send({
        data: { hasRequiredScopes: hasScopes },
        message: 'Scope check completed',
      });
    } catch (error) {
      reply.code(400).send({
        error: error instanceof Error ? error.message : 'Failed to check scopes',
      });
    }
  }

  /**
   * Get characters with expiring API keys (admin endpoint)
   */
  async getExpiringKeys(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { days } = request.query as { days?: string };
      const daysAhead = days ? parseInt(days) : 7;

      const characters = await this.eveApiKeyService.getCharactersWithExpiringKeys(daysAhead);

      reply.code(200).send({
        data: characters,
        message: `Found ${characters.length} characters with expiring keys`,
      });
    } catch (error) {
      reply.code(500).send({
        error: error instanceof Error ? error.message : 'Failed to get expiring keys',
      });
    }
  }

  /**
   * Trigger notification check for expiring API keys (admin endpoint)
   */
  async checkNotifications(request: FastifyRequest, reply: FastifyReply) {
    try {
      const summary = await this.notificationService.scheduleNotificationCheck();

      reply.code(200).send({
        data: summary,
        message: 'Notification check completed',
      });
    } catch (error) {
      reply.code(500).send({
        error: error instanceof Error ? error.message : 'Failed to check notifications',
      });
    }
  }

  /**
   * Get EVE Online OAuth authorization URL
   */
  async getAuthUrl(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { state } = request.query as { state?: string };

      const clientId = process.env.EVE_CLIENT_ID;
      const redirectUri = process.env.EVE_REDIRECT_URI;

      if (!clientId || !redirectUri) {
        return reply.code(500).send({
          error: 'EVE Online OAuth not configured',
        });
      }

      // Import the service to get the auth URL
      const { EveEsiService } = await import('../services/eveEsiService');
      const esiService = new EveEsiService();

      const authUrl = esiService.generateAuthUrl(clientId, redirectUri, state || 'default');

      reply.code(200).send({
        data: { authUrl },
        message: 'Authorization URL generated',
      });
    } catch (error) {
      reply.code(500).send({
        error: error instanceof Error ? error.message : 'Failed to generate auth URL',
      });
    }
  }

  /**
   * Get recommended scopes for EVE Online API
   */
  async getRecommendedScopes(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { EveEsiService } = await import('../services/eveEsiService');
      const esiService = new EveEsiService();

      const scopes = esiService.getRecommendedScopes();

      reply.code(200).send({
        data: { scopes },
        message: 'Recommended scopes retrieved',
      });
    } catch (error) {
      reply.code(500).send({
        error: error instanceof Error ? error.message : 'Failed to get recommended scopes',
      });
    }
  }
}
