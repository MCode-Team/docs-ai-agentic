# Use a Debian-based Node.js image
FROM node:24-bullseye

# Install dependencies required by PhantomJS and necessary tools
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

# Install Bun as 'appuser'
RUN curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.6"

# Set additional environment variables
ENV NODE_ENV=production
ENV TZ=Asia/Bangkok
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

# Set Bun environment variables
ENV BUN_INSTALL="/root/.bun"
ENV PATH="$BUN_INSTALL/bin:$PATH"

# เพิ่ม build time เป็น environment variable
ARG BUILD_TIME
ENV NEXT_PUBLIC_BUILD_TIME=$BUILD_TIME

# Set the working directory
WORKDIR /app

# Copy only the package files to leverage Docker layer caching
COPY package.json ./

# Install project dependencies using Bun
RUN bun install

# Copy the rest of your application code
COPY . .


# Build the application
RUN bun run build

# Expose port
EXPOSE 3000

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Specify the command to run your application
CMD ["bun", "start"]