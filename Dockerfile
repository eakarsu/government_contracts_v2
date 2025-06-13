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

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir chromadb>=1.0.12 \
                              email-validator>=2.2.0 \
                              flask-login>=0.6.3 \
                              flask>=3.1.1 \
                              flask-sqlalchemy>=3.1.1 \
                              gunicorn>=23.0.0 \
                              openai>=1.84.0 \
                              psycopg2-binary>=2.9.10 \
                              pypdf2>=3.0.1 \
                              python-docx>=1.1.2 \
                              requests>=2.32.3 \
                              sqlalchemy>=2.0.41 \
                              trafilatura>=2.0.0 \
                              werkzeug>=3.1.3

# Copy application code
COPY . .

# Create directories
RUN mkdir -p /app/chromadb_data /var/run/postgresql /var/lib/postgresql/data

# Initialize PostgreSQL
USER postgres
RUN /etc/init.d/postgresql start && \
    psql --command "CREATE USER postgres WITH SUPERUSER PASSWORD 'postgres';" && \
    createdb -O postgres government_contracts

USER root

# Create startup script that handles PostgreSQL and database restoration
RUN cat > /app/docker-start.sh << 'EOF'
#!/bin/bash
set -e

echo "Starting PostgreSQL..."
service postgresql start

# Wait for PostgreSQL to be ready
until pg_isready -U postgres -h localhost; do
  echo "Waiting for PostgreSQL to start..."
  sleep 2
done

echo "PostgreSQL is ready"

# Start database initialization in background
python /app/init-database.py &

echo "Starting Flask application..."
exec gunicorn --bind 0.0.0.0:5000 --reuse-port --reload main:app
EOF

RUN chmod +x /app/docker-start.sh

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/ || exit 1

# Run the application with database setup
CMD ["/app/docker-start.sh"]