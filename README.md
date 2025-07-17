# EVE Online Trading Assistant

A web application that provides AI-powered trading insights for EVE Online players. The system analyzes market data, suggests profitable trading opportunities, tracks market performance, and creates personalized trading plans within user-defined budgets.

## Features

- **AI-Powered Trading Suggestions**: Analyze market data and provide profitable trading opportunities with risk assessments
- **Market Performance Tracking**: Monitor price changes, volume trends, and historical data for watchlisted items
- **Budget-Aware Trading Plans**: Create optimized trading strategies within financial constraints
- **EVE Online Integration**: Secure API key management for real-time character and market data access
- **Multi-AI Provider Support**: Flexible AI backend with failover capabilities (Anthropic, OpenAI)
- **Real-time Notifications**: Market alerts and trading opportunity notifications
- **Educational Content**: Trading guides and strategy explanations for new traders

## Architecture

This application uses a microservices architecture with the following services:

- **Auth Service** (Port 3001): Authentication and security
- **Market Service** (Port 3002): EVE Online market data management
- **Trading Service** (Port 3003): Trading analysis and suggestions
- **AI Service** (Port 3004): AI provider orchestration
- **Notification Service** (Port 3005): Alerts and notifications
- **User Service** (Port 3006): User management

## Prerequisites

- Node.js 18+ and npm 9+
- Docker and Docker Compose
- PostgreSQL 15+
- Redis 7+

## Quick Start

1. **Clone and setup**:

   ```bash
   git clone <repository-url>
   cd eve-trading-assistant
   npm install
   ```

2. **Environment configuration**:

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start with Docker**:

   ```bash
   npm run docker:up
   ```

4. **Or start for development**:
   ```bash
   npm run dev
   ```

## Development Commands

```bash
# Install dependencies
npm install

# Start all services in development mode
npm run dev

# Start individual services
npm run dev:services
npm run dev:frontend

# Build all services
npm run build

# Run tests
npm test
npm run test:unit
npm run test:integration
npm run test:e2e

# Linting and formatting
npm run lint
npm run lint:fix
npm run format
npm run format:check

# Database operations
npm run db:migrate
npm run db:seed

# Docker operations
npm run docker:build
npm run docker:up
npm run docker:down
npm run docker:logs
```

## Project Structure

```
eve-trading-assistant/
├── services/                 # Microservices
│   ├── auth-service/        # Authentication & security
│   ├── market-service/      # EVE market data management
│   ├── trading-service/     # Trading analysis & suggestions
│   ├── ai-service/          # AI provider orchestration
│   ├── notification-service/ # Alerts & notifications
│   └── user-service/        # User management
├── frontend/                # React/Next.js web application
├── shared/                  # Shared utilities & types
│   ├── types/              # TypeScript interfaces
│   ├── utils/              # Common utilities
│   └── constants/          # Shared constants
├── infrastructure/          # Deployment & infrastructure
│   ├── docker/             # Docker configurations
│   ├── k8s/               # Kubernetes manifests
│   └── terraform/         # Infrastructure as code
├── docs/                   # Documentation
└── scripts/               # Build & deployment scripts
```

## Environment Variables

Key environment variables (see `.env.example` for full list):

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `JWT_SECRET`: JWT signing secret
- `ANTHROPIC_API_KEY`: Anthropic AI API key
- `OPENAI_API_KEY`: OpenAI API key
- `ESI_BASE_URL`: EVE Online ESI API base URL

## API Documentation

Once running, API documentation is available at:

- Auth Service: http://localhost:3001/docs
- Market Service: http://localhost:3002/docs
- Trading Service: http://localhost:3003/docs
- AI Service: http://localhost:3004/docs
- Notification Service: http://localhost:3005/docs
- User Service: http://localhost:3006/docs

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run linting and tests
6. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Security

For security concerns, please email security@eve-trading-assistant.com instead of using the issue tracker.
