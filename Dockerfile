# Use Python 3.11 slim as base image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DEBIAN_FRONTEND=noninteractive

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    postgresql-client \
    libpq-dev \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY pyproject.toml uv.lock ./

# Install Python dependencies
RUN pip install --no-cache-dir uv && \
    uv pip install --system --no-cache -r uv.lock

# Copy application code
COPY . .

# Create directory for ChromaDB data
RUN mkdir -p /app/chromadb_data

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/ || exit 1

# Make start script executable
RUN chmod +x start.sh

# Run the application with startup script
CMD ["./start.sh"]