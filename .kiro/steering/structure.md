# Project Structure

## Root Directory Layout

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

## Service Structure Template

Each microservice follows this consistent structure:

```
service-name/
├── src/
│   ├── controllers/        # HTTP request handlers
│   ├── services/          # Business logic
│   ├── models/            # Data models & schemas
│   ├── plugins/           # Fastify plugins
│   ├── routes/            # API route definitions
│   ├── schemas/           # JSON schemas for validation
│   ├── utils/             # Service-specific utilities
│   └── index.ts           # Service entry point
├── tests/
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── fixtures/          # Test data
├── package.json
├── tsconfig.json
├── Dockerfile
└── README.md
```

## Frontend Structure

```
frontend/
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── common/        # Generic components
│   │   ├── trading/       # Trading-specific components
│   │   └── market/        # Market data components
│   ├── pages/             # Next.js pages/routes
│   ├── hooks/             # Custom React hooks
│   ├── services/          # API client services
│   ├── store/             # State management
│   ├── utils/             # Frontend utilities
│   └── types/             # Frontend-specific types
├── public/                # Static assets
└── styles/               # Global styles
```

## Shared Module Organization

```
shared/
├── types/
│   ├── api.ts             # API request/response types
│   ├── market.ts          # Market data types
│   ├── trading.ts         # Trading-related types
│   ├── user.ts            # User & auth types
│   └── index.ts           # Type exports
├── utils/
│   ├── encryption.ts      # Encryption utilities
│   ├── validation.ts      # Data validation
│   ├── formatting.ts      # Data formatting
│   └── cache.ts           # Caching utilities
└── constants/
    ├── api.ts             # API endpoints & configs
    ├── market.ts          # Market-related constants
    └── errors.ts          # Error codes & messages
```

## Naming Conventions

### Files & Directories

- **kebab-case** for directories: `auth-service`, `market-data`
- **camelCase** for TypeScript files: `userService.ts`, `marketAnalysis.ts`
- **PascalCase** for React components: `TradingDashboard.tsx`, `MarketChart.tsx`

### Code Conventions

- **PascalCase** for interfaces/types: `TradingSuggestion`, `MarketData`
- **camelCase** for variables/functions: `getUserProfile`, `calculateProfit`
- **UPPER_SNAKE_CASE** for constants: `MAX_RETRY_ATTEMPTS`, `DEFAULT_CACHE_TTL`

### API Conventions

- **RESTful endpoints**: `/api/v1/trading/suggestions`, `/api/v1/market/data`
- **HTTP methods**: GET for retrieval, POST for creation, PUT for updates, DELETE for removal
- **Response format**: Consistent JSON structure with `data`, `error`, `meta` fields

## Database Conventions

### Table Naming

- **snake_case** for table names: `market_orders`, `trading_plans`, `user_profiles`
- **Singular nouns** for entity tables: `user`, `order`, `suggestion`
- **Descriptive names** for junction tables: `user_watchlist_items`

### Column Naming

- **snake_case** for column names: `created_at`, `user_id`, `profit_margin`
- **Consistent suffixes**: `_id` for foreign keys, `_at` for timestamps
- **Boolean prefixes**: `is_active`, `has_expired`, `can_trade`

## Environment Configuration

```
# Development
NODE_ENV=development
DATABASE_URL=postgresql://localhost:5432/eve_trading_dev
REDIS_URL=redis://localhost:6379
ANTHROPIC_API_KEY=your_key_here

# Production
NODE_ENV=production
DATABASE_URL=postgresql://prod-db:5432/eve_trading
REDIS_URL=redis://prod-cache:6379
```

## Import/Export Patterns

```typescript
// Barrel exports in index files
export * from './userService';
export * from './authService';

// Consistent import grouping
import { FastifyInstance } from 'fastify'; // External libraries
import { UserService } from '../services'; // Internal services
import { User } from '../../shared/types'; // Shared types
import './plugins'; // Side effects
```

## Error Handling Structure

```typescript
// Consistent error response format
interface ErrorResponse {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
  requestId: string;
}

// Service-specific error classes
class MarketDataError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'MarketDataError';
  }
}
```
