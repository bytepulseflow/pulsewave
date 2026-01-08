# =========================
# Builder stage
# =========================
FROM node:20-alpine AS builder

WORKDIR /app

# Native deps for mediasoup (needed for postinstall)
RUN apk add --no-cache \
    python3 \
    py3-pip \
    make \
    g++ \
    linux-headers \
    openssl

# Install pnpm
RUN npm install -g pnpm

# Copy root workspace files
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml tsconfig.base.json ./

# Copy shared package
COPY packages/shared ./packages/shared

# Copy server package
COPY packages/server ./packages/server

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Build shared package first
RUN pnpm --filter @bytepulse/pulsewave-shared build

# Build server package
RUN pnpm --filter @bytepulse/pulsewave-server build

# =========================
# Production stage
# =========================
FROM node:20-alpine AS production

WORKDIR /app
ENV NODE_ENV=production

# Runtime deps only
RUN apk add --no-cache openssl

# Copy node_modules from builder (includes mediasoup native bindings)
COPY --from=builder /app/node_modules ./node_modules

# Copy built dist files from builder
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist

# Copy package files for pnpm resolution
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/server ./packages/server

# Create non-root user
RUN addgroup -S mediasoup && adduser -S mediasoup -G mediasoup
USER mediasoup

# Expose API port (UDP handled by compose)
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start server
CMD ["node", "packages/server/dist/index.js"]
