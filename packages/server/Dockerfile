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

# Install all dependencies with hoisting for production
RUN pnpm install --frozen-lockfile --shamefully-hoist

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
ENV NODE_PATH=/app/node_modules

# Runtime deps only
RUN apk add --no-cache openssl

# Copy node_modules from builder (includes mediasoup native bindings and workspace symlinks)
COPY --from=builder /app/node_modules ./node_modules

# Copy entire packages directory from builder (preserves workspace structure)
COPY --from=builder /app/packages ./packages

# Copy root workspace files
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml* ./pnpm-lock.yaml*
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/tsconfig.base.json ./tsconfig.base.json

# Create non-root user
RUN addgroup -S mediasoup && adduser -S mediasoup -G mediasoup
USER mediasoup

# Expose API port (UDP handled by compose)
EXPOSE 3000

# Start server
CMD ["node", "packages/server/dist/index.js"]
