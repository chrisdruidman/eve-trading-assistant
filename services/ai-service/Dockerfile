FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY services/ai-service/package*.json ./services/ai-service/
COPY shared/package*.json ./shared/

# Install dependencies
RUN npm ci --only=production

# Copy shared utilities
COPY shared/ ./shared/
RUN cd shared && npm run build

# Copy service source
COPY services/ai-service/ ./services/ai-service/

# Build the service
WORKDIR /app/services/ai-service
RUN npm run build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the service
CMD ["npm", "start"]