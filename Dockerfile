# ---- Base Stage ----
FROM node:24-bullseye AS base
WORKDIR /app

# Install Bun
ENV BUN_INSTALL="/root/.bun"
ENV PATH="$BUN_INSTALL/bin:$PATH"
RUN curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.5"

# ---- Dependencies Stage ----
FROM base AS deps
# Install system dependencies requested
RUN apt-get update && apt-get install -y \
    build-essential \
    libfontconfig1 \
    libfreetype6 \
    libssl-dev \
    libjpeg-dev \
    libpng-dev \
    libx11-6 \
    libxext6 \
    libxrender1 \
    curl \
    bash \
    && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# ---- Builder Stage ----
FROM base AS builder
WORKDIR /app

# Set additional environment variables
ENV NODE_ENV=production
ENV TZ=Asia/Bangkok
ENV NEXT_TELEMETRY_DISABLED=1

# Build time environment variable
ARG BUILD_TIME
ENV NEXT_PUBLIC_BUILD_TIME=$BUILD_TIME

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client if needed (uncomment if using Prisma)
# RUN bunx prisma generate

RUN bun run build

# ---- Production Stage ----
FROM node:24-bullseye-slim AS runner
WORKDIR /app

# Install Bun in runner stage
ENV BUN_INSTALL="/root/.bun"
ENV PATH="$BUN_INSTALL/bin:$PATH"
RUN apt-get update && apt-get install -y curl unzip && \
    curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.5" && \
    rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV TZ=Asia/Bangkok
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Install runtime system dependencies (minimal for production)
RUN apt-get update && apt-get install -y \
    libfontconfig1 \
    libfreetype6 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user (Standard in Node images is 'node', but we'll create nextjs)
RUN groupadd --system --gid 1001 bunjs && \
    useradd --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Set ownership
RUN chown -R nextjs:bunjs /app

USER nextjs

EXPOSE 3000

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["bun", "server.js"]
