FROM node:24-slim

# Set environment variables for non-interactive package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies including full PostgreSQL server
RUN apt-get update && apt-get install -y \
    libffi-dev \
    libssl-dev \
    build-essential \
    sqlite3 \
    libsqlite3-dev \
    postgresql-15 \
    postgresql-client-15 \
    postgresql-contrib-15 \
    libpq-dev \
    libreoffice \
    tesseract-ocr \
    tesseract-ocr-eng \
    imagemagick \
    poppler-utils \
    openjdk-17-jre-headless \
    git \
    curl \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Set Java environment variables
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV PATH=$JAVA_HOME/bin:$PATH

# Pre-configure LibreOffice Java settings
RUN mkdir -p /root/.config/libreoffice/4/user/config && \
    echo '/usr/lib/jvm/java-17-openjdk-amd64' > /root/.config/libreoffice/4/user/config/javasettings_Linux_x86_64.xml

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Install nodemon globally
RUN npm install -g nodemon

# Create necessary directories
RUN mkdir -p downloaded_documents temp_downloads temp_conversions vector_indexes temp_images uploads documents logs

# Set environment variables
ENV PYTHONPATH=/usr/lib/python3/site-packages
ENV CHROMA_DB_PATH=/app/vector_indexes
ENV NODE_ENV=production

# Make start2.sh executable
RUN chmod +x start2.sh

# Start the application with initialization
CMD ["sh", "-c", "./start2.sh"]

