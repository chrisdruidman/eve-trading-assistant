# Auth Service

Authentication and security service for EVE Trading Assistant.

## Features

- User registration and login
- JWT token generation and validation
- Password hashing with bcrypt
- Session management with Redis
- Rate limiting and security middleware
- Token refresh mechanism

## API Endpoints

### Authentication

- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login with email/password
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout and revoke tokens
- `GET /auth/validate` - Validate current token
- `GET /auth/me` - Get current user info (protected)

### Health Check

- `GET /health` - Service health status

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Database
DATABASE_URL=postgresql://localhost:5432/eve_trading_dev

# Redis
REDIS_URL=redis://localhost:6379

# JWT Secrets (CHANGE IN PRODUCTION!)
JWT_ACCESS_SECRET=your-super-secret-access-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key

# Server
PORT=3001
HOST=0.0.0.0
NODE_ENV=development
LOG_LEVEL=info

# CORS
ALLOWED_ORIGINS=localhost,127.0.0.1
```

## Development

```bash
# Install dependencies
npm install

# Run database migrations
npm run db:migrate

# Start development server
npm run dev

# Run tests
npm test
npm run test:watch

# Build for production
npm run build
npm start
```

## Database Schema

### Users Table

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(30) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## Security Features

- Password hashing with bcrypt (12 rounds)
- JWT tokens with separate access/refresh secrets
- Session management in Redis
- Rate limiting (100 req/min general, 5 req/min auth)
- CORS protection
- Security headers with Helmet
- Input validation with JSON schemas

## Token Management

- **Access tokens**: 15 minutes expiry
- **Refresh tokens**: 7 days expiry
- Automatic token refresh mechanism
- Session revocation on logout
- Multiple session support per user
