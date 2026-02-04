# syntax=docker/dockerfile:1

# ============================================
# Stage 1: Install dependencies
# ============================================
FROM oven/bun:1 AS deps

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9

# Copy workspace configuration files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# ============================================
# Stage 2: Generate Prisma Client & Build
# ============================================
FROM deps AS builder

WORKDIR /app

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN pnpm --filter @snl-emp/db exec prisma generate --schema=./prisma/schema.prisma

# Copy source code
COPY packages/db ./packages/db
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
COPY tsconfig.json ./

# Copy .env if exists (for build-time env vars from CI)
# The wildcard ensures this doesn't fail if no .env files exist
COPY .env* ./

# Build the API
RUN pnpm --filter @snl-emp/api build

# ============================================
# Stage 3: Production image
# ============================================
FROM oven/bun:1-slim AS runner

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

# Copy package files for module resolution
COPY --from=builder /app/package.json ./
COPY --from=builder /app/apps/api/package.json ./apps/api/

# Copy built output
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Copy Prisma generated client
COPY --from=builder /app/packages/db/src/generated ./packages/db/src/generated

# Copy node_modules (needed for runtime dependencies)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=builder /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy shared package source (needed at runtime)
COPY --from=builder /app/packages/shared/src ./packages/shared/src
COPY --from=builder /app/packages/shared/package.json ./packages/shared/

# Copy db package source (needed at runtime for exports)
COPY --from=builder /app/packages/db/src ./packages/db/src
COPY --from=builder /app/packages/db/package.json ./packages/db/

# Set ownership
RUN chown -R appuser:nodejs /app

# Switch to non-root user
USER appuser

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check using bun (no curl needed)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD bun -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Start the application from the correct directory
WORKDIR /app/apps/api
CMD ["bun", "run", "dist/index.js"]
