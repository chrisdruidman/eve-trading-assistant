# Market Data Service

The Market Data Service is responsible for managing EVE Online market data, including fetching, caching, and serving market information to other services in the EVE Trading Assistant application.

## Features

- **Market Data Management**: Store and retrieve market orders and price data
- **Intelligent Caching**: Redis-based caching with TTL and staleness detection
- **Historical Data**: Track price history over time
- **High Performance**: Optimized database queries and caching strategies
- **Health Monitoring**: Comprehensive health checks for dependencies

## API Endpoints

### Market Data

- `GET /api/v1/market/data/:regionId/:typeId` - Get current market data for an item
- `GET /api/v1/market/history/:regionId/:typeId?days=30` - Get historical price data
- `DELETE /api/v1/market/cache/:regionId/:typeId` - Invalidate cache for specific item

### Health & Monitoring

- `GET /health` - Basic health check
- `GET /api/v1/health/detailed` - Detailed health check with dependency status
- `GET /api/v1/health/ready` - Kubernetes readiness probe
- `GET /api/v1/health/live` - Kubernetes liveness probe
- `GET /api/v1/market/cache/stats` - Cache statistics

## Environment Variables

```bash
# Server Configuration
PORT=3002
HOST=0.0.0.0
NODE_ENV=development
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://localhost:5432/eve_trading_dev

# Redis Cache
REDIS_URL=redis://localhost:6379

# Security
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

## Database Schema

The service uses PostgreSQL with the following main tables:

- `market_data` - Summary of market data for each item/region
- `market_orders` - Individual buy/sell orders
- `price_history` - Historical price data aggregated by day
- `migrations` - Database migration tracking

## Caching Strategy

The service implements intelligent caching with:

- **TTL-based expiration**: Default 5 minutes for market data
- **Staleness detection**: Serves stale data when fresh data is unavailable
- **Cache warming**: Proactive refresh before expiration
- **Selective invalidation**: Clear cache for specific items

## Development

### Setup

```bash
# Install dependencies
npm install

# Run database migrations
npm run migrate

# Start development server
npm run dev
```

### Testing

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage
```

### Building

```bash
# Build TypeScript
npm run build

# Start production server
npm start
```

## Docker

```bash
# Build image
docker build -t market-service .

# Run container
docker run -p 3002:3002 \
  -e DATABASE_URL=postgresql://host:5432/db \
  -e REDIS_URL=redis://host:6379 \
  market-service
```

## Architecture

The service follows a layered architecture:

- **Routes**: HTTP request handling and validation
- **Models**: Database access and data persistence
- **Utils**: Caching, utilities, and helper functions
- **Plugins**: Fastify plugins for database, Redis, and middleware

## Performance Considerations

- Database queries are optimized with proper indexing
- Connection pooling for PostgreSQL
- Redis connection reuse and error handling
- Graceful degradation when dependencies are unavailable
- Request rate limiting to prevent abuse

## Monitoring

The service provides comprehensive monitoring through:

- Structured logging with request correlation
- Health check endpoints for load balancers
- Cache hit/miss metrics
- Database connection pool monitoring
- Error tracking and alerting

## Security

- Input validation using TypeBox schemas
- Rate limiting to prevent abuse
- CORS configuration for allowed origins
- Helmet.js for security headers
- Secure error handling without information leakage
