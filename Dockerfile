FROM node:24-slim AS client-build

WORKDIR /app/client

COPY client/package*.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

FROM node:24-slim

# Set environment variables for non-interactive package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install document-processing runtime dependencies. PostgreSQL runs separately.
RUN apt-get update && apt-get install -y \
    libffi-dev \
    libssl-dev \
    build-essential \
    sqlite3 \
    libsqlite3-dev \
    postgresql-client-15 \
    libpq-dev \
    libreoffice \
    tesseract-ocr \
    tesseract-ocr-eng \
    clamav \
    openssl \
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

# Install dependencies needed to generate the Prisma client.
RUN PUPPETEER_SKIP_DOWNLOAD=true npm ci

# Copy application code
COPY . .

# Always ship the frontend generated from the source in this release. The
# repository may contain an older tracked bundle for non-container workflows.
COPY --from=client-build /app/client/build ./client/build

# Generate the database client, then remove development-only dependencies.
RUN npx prisma generate && npm prune --omit=dev

# Create necessary directories
RUN mkdir -p downloaded_documents temp_downloads temp_conversions vector_indexes temp_images uploads documents logs

# Set environment variables
ENV NODE_ENV=production

# Database migrations are an explicit release step; the runtime only starts the API.
CMD ["npm", "start"]
