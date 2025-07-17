FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY services/auth-service/package*.json ./services/auth-service/
COPY shared/package*.json ./shared/

# Install dependencies
RUN npm ci --only=production

# Copy shared utilities
COPY shared/ ./shared/
RUN cd shared && npm run build

# Copy service source
COPY services/auth-service/ ./services/auth-service/

# Build the service
WORKDIR /app/services/auth-service
RUN npm run build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the service
CMD ["npm", "start"]