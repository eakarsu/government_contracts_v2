FROM node:24-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_ENV=production
ENV PORT=5013

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl wget ca-certificates build-essential git \
    postgresql-client-15 libpq-dev postgresql-15 postgresql-contrib-15 \
    tesseract-ocr tesseract-ocr-eng imagemagick poppler-utils \
    openjdk-17-jre-headless \
    && rm -rf /var/lib/apt/lists/*

ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV PATH=$JAVA_HOME/bin:$PATH

WORKDIR /app

# Copy and install dependencies
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy client and build
COPY client/package*.json ./client/
RUN cd client && npm install && cd ..

COPY client/ ./client/
RUN cd client && npm run build && cd ..

# Copy server code
COPY . .

# Create directories
RUN mkdir -p vector_indexes uploads documents logs /var/lib/postgresql/data

# Generate Prisma client
RUN npx prisma generate

RUN chmod +x start2.sh

EXPOSE 5013

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:5013/api/health || exit 1

CMD ["./start2.sh", "hosting"]

