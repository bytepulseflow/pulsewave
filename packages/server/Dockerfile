# Multi-stage build for mediasoup server

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml* ./
COPY packages/shared ./packages/shared
COPY packages/server ./packages/server

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build shared package
RUN pnpm --filter @pulsewave-client/shared build

# Build server package
RUN pnpm --filter @pulsewave-client/server build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    linux-headers

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml* ./
COPY packages/server ./packages/server
COPY packages/shared ./packages/shared

# Install only production dependencies
RUN pnpm install --prod --frozen-lockfile

# Copy built files from builder
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Create non-root user
RUN addgroup -g 1001 -S mediasoup && \
    adduser -S -u 1001 mediasoup

# Set ownership
RUN chown -R mediasoup:mediasoup /app

# Switch to non-root user
USER mediasoup

# Expose ports
# 3000: HTTP API
# 40000-50000: Media ports (UDP)
EXPOSE 3000
EXPOSE 40000-50000/udp

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the server
CMD ["node", "packages/server/dist/index.js"]