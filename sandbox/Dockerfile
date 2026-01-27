# Python + Bash Sandbox for Code Execution
FROM python:3.13-slim

# Install bash utilities and common tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    curl \
    jq \
    git \
    tree \
    && rm -rf /var/lib/apt/lists/*

# Install common Python packages
RUN pip install --no-cache-dir \
    numpy \
    pandas \
    matplotlib \
    scipy \
    sympy \
    requests

# Create non-root user for security
RUN useradd -m -u 1000 sandbox

# Create workspace directory
RUN mkdir -p /home/sandbox/workspace && chown sandbox:sandbox /home/sandbox/workspace

USER sandbox
WORKDIR /home/sandbox

# Copy the execution server
COPY --chown=sandbox:sandbox server.py .

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run the server
CMD ["python", "server.py"]

