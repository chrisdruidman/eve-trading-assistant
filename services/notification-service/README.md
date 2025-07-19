# Notification Service

The notification service handles all notification delivery for the EVE Trading Assistant application, supporting multiple delivery channels including email, in-app notifications, and push notifications.

## Features

- **Multiple Delivery Channels**: Email, in-app, and push notifications
- **User Preferences**: Customizable notification preferences per user
- **Scheduling**: Quiet hours and batching support
- **Real-time Updates**: WebSocket support for live notifications
- **Rate Limiting**: Prevents notification spam
- **Retry Logic**: Automatic retry for failed deliveries
- **Template System**: Rich HTML email templates

## API Endpoints

### Notifications

- `POST /api/v1/notifications` - Send a single notification
- `POST /api/v1/notifications/batch` - Send multiple notifications
- `GET /api/v1/notifications/user/:userId` - Get user notifications
- `GET /api/v1/notifications/user/:userId/unread-count` - Get unread count
- `PATCH /api/v1/notifications/:id/read` - Mark notification as read
- `PATCH /api/v1/notifications/user/:userId/read-all` - Mark all as read
- `GET /api/v1/notifications/user/:userId/stream` - WebSocket stream

### Preferences

- `GET /api/v1/preferences/user/:userId` - Get notification preferences
- `PUT /api/v1/preferences/user/:userId` - Update preferences
- `GET /api/v1/preferences/user/:userId/schedule` - Get notification schedule
- `PUT /api/v1/preferences/user/:userId/schedule` - Update schedule
- `POST /api/v1/preferences/user/:userId/test` - Test notification delivery

## Environment Variables

```bash
# Server Configuration
PORT=3004
HOST=0.0.0.0
NODE_ENV=development

# Database
DATABASE_URL=postgresql://localhost:5432/eve_trading_dev

# Redis
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-jwt-secret

# Email Configuration
SMTP_HOST=localhost
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
FROM_EMAIL=noreply@eve-trading-assistant.com

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:3000

# CORS
CORS_ORIGIN=http://localhost:3000
```

## Development

```bash
# Install dependencies
npm install

# Run database migrations
npm run migrate

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Database Schema

The service uses PostgreSQL with the following main tables:

- `notifications` - Stores notification data
- `notification_channels` - Tracks delivery channels and status
- `notification_preferences` - User notification preferences
- `notification_schedules` - User scheduling preferences

## Notification Types

- `MARKET_ALERT` - Market condition alerts
- `TRADING_OPPORTUNITY` - Trading suggestions
- `SYSTEM_UPDATE` - System announcements
- `ACCOUNT_NOTICE` - Account-related notifications

## Priority Levels

- `LOW` - Non-urgent notifications
- `MEDIUM` - Standard notifications
- `HIGH` - Important notifications
- `URGENT` - Critical notifications (bypass quiet hours)

## Delivery Channels

- `EMAIL` - HTML email notifications
- `IN_APP` - Real-time in-app notifications
- `PUSH` - Push notifications (future implementation)

## Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Test notification delivery
curl -X POST http://localhost:3004/api/v1/preferences/user/123/test \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{"channel": "EMAIL"}'
```
