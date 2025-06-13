# Use Python 3.11 slim as base image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DEBIAN_FRONTEND=noninteractive
ENV POSTGRES_DB=government_contracts
ENV POSTGRES_USER=postgres
ENV POSTGRES_PASSWORD=postgres
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/government_contracts

# Set work directory
WORKDIR /app

# Install system dependencies including PostgreSQL
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    postgresql \
    postgresql-contrib \
    postgresql-client \
    libpq-dev \
    gcc \
    g++ \
    sudo \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY pyproject.toml ./

# ✅ FIXED: Install Python dependencies with proper quoting
# Copy requirements
COPY requirements.txt ./

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create directories
RUN mkdir -p /app/chromadb_data /var/run/postgresql /var/lib/postgresql/data

# Initialize PostgreSQL
USER postgres
RUN /etc/init.d/postgresql start && \
    psql --command "ALTER USER postgres PASSWORD 'postgres';" && \
    createdb -O postgres government_contracts

USER root

# ✅ FIXED: Copy startup script instead of using HERE-DOC
COPY docker-start.sh /app/docker-start.sh
RUN chmod +x /app/docker-start.sh


# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/ || exit 1

# Run the application with database setup
CMD ["/app/docker-start.sh"]