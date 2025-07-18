# AI Service

AI provider orchestration service for the EVE Trading Assistant. This service provides an abstraction layer over multiple AI providers (Anthropic Claude, OpenAI GPT) with intelligent failover, caching, and cost optimization.

## Features

- **Multi-Provider Support**: Seamlessly switch between Anthropic Claude and OpenAI GPT
- **Intelligent Failover**: Automatic provider switching with circuit breaker pattern
- **Response Caching**: Redis-based caching to reduce API costs and improve performance
- **Cost Optimization**: Smart caching decisions based on response cost and quality
- **Health Monitoring**: Provider availability monitoring and health checks
- **Rate Limiting**: Built-in rate limiting and exponential backoff

## Architecture

### Core Components

- **BaseAIProvider**: Abstract base class for all AI providers
- **AnthropicProvider**: Primary AI provider using Claude Sonnet 4
- **OpenAIProvider**: Secondary AI provider using GPT-4 Turbo
- **AIProviderManager**: Handles provider registration, selection, and failover
- **AICacheManager**: Redis-based caching system for AI responses
- **AIService**: Main service orchestrating all components

### Provider Priority

1. **Anthropic Claude** (Primary)
   - Model: claude-sonnet-4-20250514
   - Pricing: $3/1M input tokens, $15/1M output tokens
   - Features: High-performance reasoning, 200K context, 64K max output, extended thinking

2. **OpenAI GPT** (Fallback)
   - Model: gpt-4-turbo-preview
   - Pricing: $10/1M input tokens, $30/1M output tokens
   - General-purpose language model

## API Endpoints

### Market Analysis

```http
POST /api/v1/analyze/market
Content-Type: application/json

{
  "marketData": [
    {
      "typeId": 34,
      "regionId": 10000002,
      "buyOrders": [...],
      "sellOrders": [...],
      "volume": 1500,
      "averagePrice": 5.75
    }
  ],
  "context": {
    "userId": "user-123",
    "budget": 10000000,
    "riskTolerance": "MODERATE",
    "preferredRegions": [10000002],
    "timeHorizon": "MEDIUM"
  }
}
```

### Trading Advice

```http
POST /api/v1/analyze/trading-advice
Content-Type: application/json

{
  "userProfile": {
    "userId": "user-123",
    "tradingExperience": "INTERMEDIATE",
    "riskTolerance": "MODERATE",
    "availableBudget": 10000000,
    "preferredMarkets": [10000002],
    "tradingGoals": ["profit_maximization"]
  },
  "marketConditions": {
    "volatility": 0.3,
    "liquidity": 0.7,
    "trend": "BULL",
    "majorEvents": ["patch_release"]
  }
}
```

### Strategy Explanation

```http
POST /api/v1/analyze/explain-strategy
Content-Type: application/json

{
  "suggestion": {
    "itemId": 34,
    "itemName": "Tritanium",
    "buyPrice": 5.50,
    "sellPrice": 6.00,
    "expectedProfit": 500,
    "profitMargin": 0.083,
    "riskLevel": "MEDIUM",
    "requiredInvestment": 5500,
    "timeToProfit": 24,
    "confidence": 0.85
  }
}
```

### Health Check

```http
GET /api/v1/health
```

## Environment Variables

```bash
# Required - AI Provider API Keys
ANTHROPIC_API_KEY=your_anthropic_api_key
OPENAI_API_KEY=your_openai_api_key

# Optional - Service Configuration
PORT=3003
HOST=0.0.0.0
NODE_ENV=production
LOG_LEVEL=info

# Optional - Redis Configuration
REDIS_URL=redis://localhost:6379

# Optional - Security Configuration
CORS_ORIGIN=https://your-frontend-domain.com
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=1 minute
```

## Installation & Setup

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Development
npm run dev

# Production build
npm run build
npm start

# Testing
npm test
npm run test:unit
npm run test:integration
npm run test:watch

# Linting
npm run lint
npm run lint:fix
```

## Caching Strategy

The service implements intelligent caching to optimize costs and performance:

### Cache Criteria

- **Expensive responses** (>$0.01): Always cached
- **Long responses** (>1000 chars): Always cached
- **High confidence** (>0.8): Always cached
- **Short responses** (<50 chars): Never cached

### Cache TTL

- **Expensive/detailed responses**: 1 hour
- **Standard responses**: 30 minutes
- **Health checks**: 5 minutes

### Cache Keys

Generated using SHA-256 hash of:

- Provider name
- Prompt content
- Context parameters

## Circuit Breaker Pattern

Protects against provider failures:

- **Closed**: Normal operation
- **Open**: Provider marked as failed (3+ failures)
- **Half-Open**: Testing provider recovery

### Failure Thresholds

- **Failure count**: 3 consecutive failures
- **Retry backoff**: 1min → 2min → 4min → 10min (max)
- **Health check interval**: 5 minutes

## Monitoring & Observability

### Health Metrics

- Provider availability status
- Circuit breaker states
- Cache hit/miss ratios
- Response times and costs

### Logging

- Request/response logging
- Error tracking with context
- Performance metrics
- Cost tracking per user/request

## Error Handling

### Provider Errors

- **Rate Limits**: Automatic retry with exponential backoff
- **Authentication**: Immediate failure, no retry
- **Service Errors**: Retry with failover to backup provider
- **Timeouts**: Configurable timeout with retry

### Response Format

```json
{
  "error": "ERROR_CODE",
  "message": "Human readable error message",
  "details": "Additional error context",
  "retryable": true,
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## Development

### Adding New Providers

1. Extend `BaseAIProvider` class
2. Implement required methods:
   - `generateResponse()`
   - `estimateCost()`
   - `performHealthCheck()`
3. Register provider in `AIService.initialize()`
4. Add to provider priority list

### Testing

```bash
# Run all tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Watch mode
npm run test:watch

# Coverage report
npm test -- --coverage
```

### Code Quality

```bash
# Linting
npm run lint

# Type checking
npm run type-check

# Format code
npm run format
```

## Performance Considerations

- **Concurrent Requests**: Service handles multiple simultaneous AI requests
- **Memory Usage**: Responses cached in Redis, not in-memory
- **API Quotas**: Built-in rate limiting respects provider limits
- **Timeout Handling**: 30-second default timeout for AI requests

## Security

- **API Key Storage**: Environment variables only, never in code
- **Request Validation**: All inputs validated with Zod schemas
- **Rate Limiting**: Per-IP and per-user rate limiting
- **CORS**: Configurable CORS policies
- **Helmet**: Security headers for all responses

## Deployment

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3003
CMD ["node", "dist/index.js"]
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ai-service
  template:
    metadata:
      labels:
        app: ai-service
    spec:
      containers:
        - name: ai-service
          image: ai-service:latest
          ports:
            - containerPort: 3003
          env:
            - name: ANTHROPIC_API_KEY
              valueFrom:
                secretKeyRef:
                  name: ai-secrets
                  key: anthropic-key
            - name: OPENAI_API_KEY
              valueFrom:
                secretKeyRef:
                  name: ai-secrets
                  key: openai-key
```

## Contributing

1. Follow TypeScript best practices
2. Add tests for new features
3. Update documentation
4. Follow conventional commit messages
5. Ensure all tests pass before submitting PR

## License

MIT License - see LICENSE file for details
