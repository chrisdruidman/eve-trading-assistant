# User Service

The User Service handles comprehensive user management, authentication, and user preferences for the EVE Trading Assistant application. It provides a complete set of features for user profile management, preferences, security, and GDPR compliance.

## Features

### Core User Management

- User profile creation and updates
- User preferences and settings management
- Account deletion with GDPR compliance (30-day grace period)
- User data export for GDPR compliance
- Account deactivation/reactivation
- Password management
- User statistics and profile completeness tracking

### Authentication & Security

- JWT-based authentication middleware
- Role-based authorization system
- Protected route middleware
- Optional authentication for public endpoints
- Resource ownership validation

### User Preferences

- Theme preferences (light/dark mode)
- Notification preferences (email, in-app, push)
- Trading preferences (risk tolerance, budget, preferred regions)
- Automatic default preference creation

## API Endpoints

### Profile Management

- `GET /profile` - Get complete user profile with preferences
- `PUT /profile` - Update user profile (username, email)
- `GET /stats` - Get user statistics and profile completeness
- `POST /check-email` - Check email availability
- `POST /check-username` - Check username availability

### Preferences Management

- `GET /preferences` - Get all user preferences
- `PUT /preferences` - Update user preferences (bulk update)
- `PUT /preferences/notifications` - Update notification preferences
- `PUT /preferences/trading` - Update trading preferences
- `PUT /preferences/theme` - Update theme preference

### Account Security

- `PUT /change-password` - Change user password
- `POST /deactivate` - Deactivate user account
- `POST /reactivate` - Reactivate user account

### GDPR Compliance

- `POST /delete-account` - Request account deletion (30-day grace period)
- `GET /export-data` - Export all user data in JSON format

### Service Integration

- `GET /validate/:userId` - Validate user exists (for other microservices)

## Authentication Middleware

The service provides several authentication decorators:

### `fastify.authenticate`

Requires valid JWT token. Adds user info to `request.user`:

```typescript
request.user = {
  userId: string;
  email?: string;
  roles?: string[];
}
```

### `fastify.optionalAuth`

Optional authentication - doesn't fail if no token provided.

### `fastify.authorize(roles: string[])`

Role-based authorization. Requires authentication + specific roles.

### `fastify.requireOwnership`

Ensures user can only access their own resources.

## Data Models

### User Profile

```typescript
interface UserProfile {
  id: string;
  email: string;
  username: string;
  createdAt: Date;
  preferences: UserPreferences;
  subscription: SubscriptionInfo;
}
```

### User Preferences

```typescript
interface UserPreferences {
  theme: 'light' | 'dark';
  notifications: {
    email: boolean;
    inApp: boolean;
    push: boolean;
  };
  trading: {
    riskTolerance: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
    defaultBudget: number;
    preferredRegions: number[];
  };
}
```

### User Statistics

```typescript
interface UserStats {
  profileCompleteness: number; // 0-100%
  lastLoginAt?: Date;
  accountAge: number; // days
  preferencesSet: boolean;
}
```

## Security Features

- **JWT Token Validation**: Secure token-based authentication
- **Role-Based Access Control**: Extensible role system for authorization
- **Password Security**: Secure password hashing and validation
- **Data Encryption**: Sensitive data encryption capabilities
- **CORS Protection**: Configurable cross-origin request handling
- **Rate Limiting**: Built-in request rate limiting
- **Input Validation**: Comprehensive request validation using JSON schemas

## GDPR Compliance

The service implements full GDPR compliance:

- **Right to Access**: Users can export all their data
- **Right to Rectification**: Users can update their profile and preferences
- **Right to Erasure**: Users can request account deletion with 30-day grace period
- **Right to Portability**: Data export in machine-readable JSON format
- **Data Minimization**: Only necessary data is collected and stored

## Database Schema

The service expects the following database tables:

### users

- `id` (UUID, primary key)
- `email` (unique)
- `username` (unique)
- `password_hash`
- `is_active` (boolean)
- `created_at`, `updated_at`, `deleted_at`

### user_preferences

- `user_id` (foreign key)
- `theme`, `email_notifications`, `in_app_notifications`, `push_notifications`
- `risk_tolerance`, `default_budget`, `preferred_regions`
- `created_at`, `updated_at`

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://localhost:5432/eve_trading_dev

# Authentication
JWT_SECRET=your-jwt-secret-key

# Server Configuration
PORT=3002
HOST=0.0.0.0
LOG_LEVEL=info

# CORS
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

## Development

### Setup

```bash
npm install
npm run dev
```

### Testing

```bash
npm test              # Run unit tests
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Run tests with coverage
```

### Building

```bash
npm run build         # Build TypeScript
npm run build:docker  # Build Docker image
```

## Error Handling

The service provides comprehensive error handling with consistent response formats:

```typescript
interface ErrorResponse {
  error: string; // Error type
  message: string; // Human-readable message
  code: string; // Specific error code
  timestamp?: string; // Error timestamp
  requestId?: string; // Request tracking ID
}
```

Common error codes:

- `USER_NOT_FOUND` - User doesn't exist
- `EMAIL_ALREADY_EXISTS` - Email is already in use
- `AUTH_TOKEN_EXPIRED` - JWT token has expired
- `INSUFFICIENT_PERMISSIONS` - User lacks required permissions
- `VALIDATION_ERROR` - Request validation failed

## Integration with Other Services

The user service is designed to integrate seamlessly with other microservices:

- **Authentication Service**: Validates JWT tokens and user credentials
- **Trading Service**: Provides user preferences for trading algorithms
- **Notification Service**: Supplies notification preferences
- **Market Service**: Uses user preferences for personalized data

## Performance Considerations

- **Connection Pooling**: PostgreSQL connection pooling for optimal database performance
- **Caching**: User preferences cached to reduce database queries
- **Rate Limiting**: Prevents abuse and ensures fair resource usage
- **Async Operations**: Non-blocking I/O for high concurrency

## Monitoring and Observability

- **Health Checks**: `/health` endpoint for service monitoring
- **Structured Logging**: JSON-formatted logs with correlation IDs
- **Error Tracking**: Comprehensive error logging and tracking
- **Metrics**: Performance and usage metrics collection
