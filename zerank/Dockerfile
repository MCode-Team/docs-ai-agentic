FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY server.py .

# Create cache directory for model
RUN mkdir -p /data

ENV HF_HOME=/data
ENV TRANSFORMERS_CACHE=/data

EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:80/health || exit 1

CMD ["python", "server.py"]
