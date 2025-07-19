import { FastifyRequest, FastifyReply } from 'fastify';
import { WatchlistService } from '../services/watchlistService';
import { WatchlistItem, AlertRule } from '../../../shared/src/types';

interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    email: string;
  };
}

export class WatchlistController {
  constructor(private watchlistService: WatchlistService) {}

  async createWatchlist(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { name } = request.body as { name: string };
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      if (!name || name.trim().length === 0) {
        return reply.status(400).send({ error: 'Watchlist name is required' });
      }

      const watchlist = await this.watchlistService.createWatchlist(userId, name.trim());

      reply.status(201).send({
        success: true,
        data: watchlist,
      });
    } catch (error) {
      console.error('Error creating watchlist:', error);
      reply.status(500).send({
        error: 'Failed to create watchlist',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getUserWatchlists(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      const watchlists = await this.watchlistService.getUserWatchlists(userId);

      reply.send({
        success: true,
        data: watchlists,
      });
    } catch (error) {
      console.error('Error getting user watchlists:', error);
      reply.status(500).send({
        error: 'Failed to get watchlists',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getWatchlist(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { watchlistId } = request.params as { watchlistId: string };
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      const watchlist = await this.watchlistService.getWatchlist(watchlistId, userId);

      if (!watchlist) {
        return reply.status(404).send({ error: 'Watchlist not found' });
      }

      reply.send({
        success: true,
        data: watchlist,
      });
    } catch (error) {
      console.error('Error getting watchlist:', error);
      reply.status(500).send({
        error: 'Failed to get watchlist',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async addItemToWatchlist(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { watchlistId } = request.params as { watchlistId: string };
      const item = request.body as Omit<WatchlistItem, 'addedAt'>;
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      // Validate required fields
      if (!item.typeId || !item.regionId) {
        return reply.status(400).send({
          error: 'typeId and regionId are required',
        });
      }

      await this.watchlistService.addItemToWatchlist(watchlistId, userId, item);

      reply.status(201).send({
        success: true,
        message: 'Item added to watchlist',
      });
    } catch (error) {
      console.error('Error adding item to watchlist:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.status(404).send({ error: error.message });
      }
      reply.status(500).send({
        error: 'Failed to add item to watchlist',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async removeItemFromWatchlist(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { watchlistId, typeId, regionId } = request.params as {
        watchlistId: string;
        typeId: string;
        regionId: string;
      };
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      await this.watchlistService.removeItemFromWatchlist(
        watchlistId,
        userId,
        parseInt(typeId),
        parseInt(regionId)
      );

      reply.send({
        success: true,
        message: 'Item removed from watchlist',
      });
    } catch (error) {
      console.error('Error removing item from watchlist:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.status(404).send({ error: error.message });
      }
      reply.status(500).send({
        error: 'Failed to remove item from watchlist',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async createAlertRule(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { watchlistId } = request.params as { watchlistId: string };
      const rule = request.body as Omit<AlertRule, 'id' | 'createdAt'>;
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      // Validate required fields
      if (!rule.typeId || !rule.regionId || !rule.condition || rule.threshold === undefined) {
        return reply.status(400).send({
          error: 'typeId, regionId, condition, and threshold are required',
        });
      }

      // Validate condition
      const validConditions = ['PRICE_ABOVE', 'PRICE_BELOW', 'VOLUME_ABOVE', 'VOLUME_BELOW'];
      if (!validConditions.includes(rule.condition)) {
        return reply.status(400).send({
          error: 'Invalid condition. Must be one of: ' + validConditions.join(', '),
        });
      }

      const alertRule = await this.watchlistService.createAlertRule(watchlistId, userId, rule);

      reply.status(201).send({
        success: true,
        data: alertRule,
      });
    } catch (error) {
      console.error('Error creating alert rule:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.status(404).send({ error: error.message });
      }
      reply.status(500).send({
        error: 'Failed to create alert rule',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async updateAlertRule(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { ruleId } = request.params as { ruleId: string };
      const updates = request.body as Partial<Pick<AlertRule, 'threshold' | 'isActive'>>;
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      await this.watchlistService.updateAlertRule(ruleId, userId, updates);

      reply.send({
        success: true,
        message: 'Alert rule updated',
      });
    } catch (error) {
      console.error('Error updating alert rule:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.status(404).send({ error: error.message });
      }
      reply.status(500).send({
        error: 'Failed to update alert rule',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async deleteAlertRule(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { ruleId } = request.params as { ruleId: string };
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      await this.watchlistService.deleteAlertRule(ruleId, userId);

      reply.send({
        success: true,
        message: 'Alert rule deleted',
      });
    } catch (error) {
      console.error('Error deleting alert rule:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.status(404).send({ error: error.message });
      }
      reply.status(500).send({
        error: 'Failed to delete alert rule',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getUserAlerts(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { limit } = request.query as { limit?: string };
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      const alertLimit = limit ? parseInt(limit) : 50;
      const alerts = await this.watchlistService.getUserAlerts(userId, alertLimit);

      reply.send({
        success: true,
        data: alerts,
      });
    } catch (error) {
      console.error('Error getting user alerts:', error);
      reply.status(500).send({
        error: 'Failed to get alerts',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async acknowledgeAlert(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { alertId } = request.params as { alertId: string };
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      await this.watchlistService.acknowledgeAlert(alertId, userId);

      reply.send({
        success: true,
        message: 'Alert acknowledged',
      });
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      reply.status(500).send({
        error: 'Failed to acknowledge alert',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async deleteWatchlist(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { watchlistId } = request.params as { watchlistId: string };
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      await this.watchlistService.deleteWatchlist(watchlistId, userId);

      reply.send({
        success: true,
        message: 'Watchlist deleted',
      });
    } catch (error) {
      console.error('Error deleting watchlist:', error);
      reply.status(500).send({
        error: 'Failed to delete watchlist',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getWatchlistPerformance(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { watchlistId } = request.params as { watchlistId: string };
      const { days } = request.query as { days?: string };
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      const daysPeriod = days ? parseInt(days) : 30;
      const performance = await this.watchlistService.getWatchlistPerformance(
        watchlistId,
        userId,
        daysPeriod
      );

      reply.send({
        success: true,
        data: performance,
      });
    } catch (error) {
      console.error('Error getting watchlist performance:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.status(404).send({ error: error.message });
      }
      reply.status(500).send({
        error: 'Failed to get watchlist performance',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getMarketChangeAnalysis(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { days } = request.query as { days?: string };
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      const daysPeriod = days ? parseInt(days) : 7;
      const analysis = await this.watchlistService.getMarketChangeAnalysis(userId, daysPeriod);

      reply.send({
        success: true,
        data: analysis,
      });
    } catch (error) {
      console.error('Error getting market change analysis:', error);
      reply.status(500).send({
        error: 'Failed to get market change analysis',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
