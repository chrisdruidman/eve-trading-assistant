# Technology Stack

## Architecture

**Microservices Architecture** - Independent, scalable services with clear separation of concerns

## Backend Technologies

- **Runtime**: Node.js with TypeScript
- **Web Framework**: Fastify for high-performance HTTP services
- **Database**: PostgreSQL with connection pooling
- **Cache**: Redis for market data and AI response caching
- **Message Queue**: For async service communication
- **Authentication**: JWT tokens with refresh token rotation

## Frontend Technologies

- **Framework**: React/Next.js with TypeScript
- **State Management**: Context API or Redux Toolkit
- **UI Components**: Modern component library (Material-UI or similar)
- **Charts**: For market data visualization

## External Integrations

- **EVE Online ESI API**: Market data and character information
- **AI Providers**:
  - Primary: Anthropic Claude
  - Secondary: OpenAI GPT (failover)
- **Email Service**: For notifications
- **Push Notifications**: Real-time alerts

## Infrastructure

- **Containerization**: Docker containers for all services
- **Orchestration**: Kubernetes for scaling and deployment
- **API Gateway**: Load balancing and routing
- **Monitoring**: Prometheus metrics, centralized logging

## Security

- **Encryption**: AES-256 for API keys and sensitive data
- **Transport**: TLS 1.3 for all communications
- **Authentication**: Role-based access control (RBAC)
- **Rate Limiting**: Per-user and IP-based throttling

## Development Tools

- **Code Quality**: ESLint, Prettier
- **Testing**: Jest for unit tests, integration test suites
- **CI/CD**: Automated testing and deployment pipeline
- **Documentation**: OpenAPI specs for APIs

## Common Commands

```bash
# Development setup
npm install
npm run dev

# Testing
npm test
npm run test:integration
npm run test:e2e

# Building
npm run build
npm run build:docker

# Database operations
npm run db:migrate
npm run db:seed

# Deployment
npm run deploy:staging
npm run deploy:production
```

## Performance Considerations

- **Caching Strategy**: 5-15 minute TTL for market data, 1 hour for AI responses
- **Rate Limiting**: Exponential backoff for ESI API calls
- **Database**: Partitioned tables for market data, indexed queries
- **CDN**: Static asset delivery optimization
