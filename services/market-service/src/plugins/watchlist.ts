import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { WatchlistRepository } from '../models/watchlistRepository';
import { MarketDataRepository } from '../models/marketDataRepository';
import { WatchlistService } from '../services/watchlistService';
import { WatchlistController } from '../controllers/watchlistController';
import { AlertMonitoringService } from '../services/alertMonitoringService';

declare module 'fastify' {
  interface FastifyInstance {
    watchlistRepository: WatchlistRepository;
    watchlistService: WatchlistService;
    watchlistController: WatchlistController;
    alertMonitoringService: AlertMonitoringService;
  }
}

async function watchlistPlugin(fastify: FastifyInstance) {
  // Initialize repositories
  const watchlistRepository = new WatchlistRepository(fastify.db.pool);
  const marketDataRepository = new MarketDataRepository(fastify.db.pool, fastify.redis);

  // Initialize services
  const watchlistService = new WatchlistService(watchlistRepository, marketDataRepository);
  const watchlistController = new WatchlistController(watchlistService);

  // Initialize alert monitoring service
  const alertCheckIntervalMs = parseInt(process.env.ALERT_CHECK_INTERVAL_MS || '300000', 10); // 5 minutes default
  const alertMonitoringService = new AlertMonitoringService(watchlistService, alertCheckIntervalMs);

  // Decorate fastify instance
  fastify.decorate('watchlistRepository', watchlistRepository);
  fastify.decorate('watchlistService', watchlistService);
  fastify.decorate('watchlistController', watchlistController);
  fastify.decorate('alertMonitoringService', alertMonitoringService);

  // Start alert monitoring service
  alertMonitoringService.start();

  // Graceful shutdown
  fastify.addHook('onClose', async () => {
    fastify.log.info('Stopping alert monitoring service');
    alertMonitoringService.stop();
  });
}

export default fp(watchlistPlugin, {
  name: 'watchlist-plugin',
  dependencies: ['database-plugin', 'redis-plugin'],
});
