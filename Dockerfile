# Use Node.js 18 LTS as base image
FROM node:18-alpine

# Install system dependencies for PostgreSQL, ChromaDB and document processing
RUN apk add --no-cache \
    python3 \
    py3-pip \
    build-base \
    python3-dev \
    libffi-dev \
    openssl-dev \
    sqlite \
    sqlite-dev \
    postgresql-client \
    postgresql-dev \
    libreoffice \
    tesseract-ocr \
    tesseract-ocr-data-eng \
    imagemagick \
    poppler-utils \
    git

# Install Python packages for ChromaDB and vector operations
RUN pip3 install --no-cache-dir \
    chromadb \
    sentence-transformers \
    numpy \
    psycopg2-binary

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p downloaded_documents temp_downloads temp_conversions vector_indexes temp_images

# Set environment variables
ENV PYTHONPATH=/usr/lib/python3.11/site-packages
ENV CHROMA_DB_PATH=/app/vector_indexes
ENV NODE_ENV=production

# Create database initialization script
RUN echo '#!/bin/sh\n\
echo "Waiting for PostgreSQL to be ready..."\n\
until pg_isready -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER; do\n\
  echo "PostgreSQL is unavailable - sleeping"\n\
  sleep 1\n\
done\n\
echo "PostgreSQL is up - executing command"\n\
exec "$@"' > /app/wait-for-postgres.sh && chmod +x /app/wait-for-postgres.sh

# Expose port
EXPOSE 3000

# Use wait script and start the application
CMD ["/app/wait-for-postgres.sh", "npm", "start"]
