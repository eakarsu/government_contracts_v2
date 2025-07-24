FROM node:24-slim

# Set environment variables for non-interactive package installation
ENV DEBIAN_FRONTEND=noninteractive

# Configure apt retry logic and enable main repository
RUN mkdir -p /etc/apt/apt.conf.d && \
    printf 'Acquire::Retries "3";\nAcquire::http::Timeout "30";\nAcquire::https::Timeout "30";\n' > /etc/apt/apt.conf.d/99-retries

# Ensure we have proper sources configured and update with debugging
RUN echo "deb http://deb.debian.org/debian bookworm main" > /etc/apt/sources.list && \
    echo "deb http://deb.debian.org/debian bookworm-updates main" >> /etc/apt/sources.list && \
    echo "deb http://deb.debian.org/debian-security bookworm-security main" >> /etc/apt/sources.list && \
    rm -rf /var/lib/apt/lists/* && \
    apt-get clean

# Update package lists with retry logic and verification
RUN for i in 1 2 3; do \
        echo "Attempt $i: Updating package lists..." && \
        apt-get update && \
        echo "Update successful, verifying packages..." && \
        apt-cache search git | head -5 && \
        break || \
        (echo "Update failed, attempt $i/3" && sleep 5); \
    done

# Install system dependencies in stages to identify issues
RUN apt-get install -y --no-install-recommends \
    curl \
    wget \
    gnupg \
    ca-certificates \
    software-properties-common

# Install build tools
RUN apt-get install -y --no-install-recommends \
    build-essential \
    libffi-dev \
    libssl-dev \
    git

# Install database components
RUN apt-get install -y --no-install-recommends \
    sqlite3 \
    libsqlite3-dev \
    postgresql-client-15 \
    libpq-dev

# Try to install PostgreSQL server (may not be available in all architectures)
RUN apt-get install -y --no-install-recommends postgresql-15 postgresql-contrib-15 || \
    echo "PostgreSQL server not available for this architecture, skipping..."

# Install document processing tools
RUN apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    imagemagick \
    poppler-utils

# Install LibreOffice (may be large, consider removing if not essential)
RUN apt-get install -y --no-install-recommends libreoffice || \
    echo "LibreOffice not available, skipping..."

# Install Java
RUN apt-get install -y --no-install-recommends openjdk-17-jre-headless

# Clean up
RUN rm -rf /var/lib/apt/lists/* && apt-get clean

# Set Java environment variables
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV PATH=$JAVA_HOME/bin:$PATH

# Pre-configure LibreOffice Java settings
RUN mkdir -p /root/.config/libreoffice/4/user/config && \
    echo '/usr/lib/jvm/java-17-openjdk-amd64' > /root/.config/libreoffice/4/user/config/javasettings_Linux_x86_64.xml

# Set working directory
WORKDIR /app

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production && npm cache clean --force

# Install nodemon globally
RUN npm install -g nodemon && npm cache clean --force

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p downloaded_documents temp_downloads temp_conversions vector_indexes temp_images uploads documents logs

# Set environment variables
ENV PYTHONPATH=/usr/lib/python3/site-packages
ENV CHROMA_DB_PATH=/app/vector_indexes
ENV NODE_ENV=production

# Make start2.sh executable
RUN chmod +x start2.sh

# Start the application with initialization
CMD ["sh", "-c", "./start2.sh hosting"]

