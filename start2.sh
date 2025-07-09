#!/bin/sh
set -e

OS_TYPE="$(uname)"
echo "Detected OS: $OS_TYPE"

# Load .env if present
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

# Set default environment variables
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-sel33man}"
POSTGRES_DB="${POSTGRES_DB:-db}"
PGDATA="${PGDATA:-/var/lib/postgresql/data}"

if [ "$OS_TYPE" = "Darwin" ]; then
  echo "🟢 macOS detected: Skipping installations. Ensure all dependencies are present."
else
  echo "🔵 Debian/Ubuntu detected: Installing dependencies..."

  # Update package index
  apt-get update

  # Install Node.js (LTS) and build tools if needed
  if ! command -v node >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
    apt-get install -y nodejs
    apt-get install -y build-essential
  fi

  # Install PostgreSQL server and client if needed
  if ! command -v postgres >/dev/null 2>&1; then
    apt-get install -y postgresql-15 postgresql-client-15 postgresql-contrib-15 libpq-dev
  fi

  # Install additional system dependencies if needed
  apt-get install -y libffi-dev libssl-dev openjdk-17-jre-headless \
    sqlite3 libsqlite3-dev libreoffice tesseract-ocr tesseract-ocr-eng imagemagick git

  if ! command -v npx >/dev/null 2>&1; then
    apt-get install -y npm
  fi

  echo "✅ All system dependencies installed."

  # Create postgres user if missing
  if ! id postgres >/dev/null 2>&1; then
    useradd -m postgres
  fi

  # Initialize PostgreSQL data directory if needed
  if [ ! -d "$PGDATA" ] || [ -z "$(ls -A "$PGDATA" 2>/dev/null)" ]; then
    echo "🔧 Initializing PostgreSQL data directory at $PGDATA"
    mkdir -p "$PGDATA"
    chown -R postgres:postgres "$PGDATA"
    # Use full path to initdb for PostgreSQL 15
    su - postgres -c "/usr/lib/postgresql/15/bin/initdb -D $PGDATA"
  fi

  # Start PostgreSQL server in background
  echo "🟢 Starting PostgreSQL server..."
  su - postgres -c "/usr/lib/postgresql/15/bin/postgres -D $PGDATA" &
  PG_PID=$!

  # Wait for PostgreSQL to be ready
  echo "⏳ Waiting for PostgreSQL to be ready..."
  TIMEOUT=60
  COUNTER=0
  until su - postgres -c "pg_isready -h localhost -p 5432" >/dev/null 2>&1; do
    echo "PostgreSQL is unavailable - sleeping (${COUNTER}/${TIMEOUT}s)"
    sleep 2
    COUNTER=$((COUNTER + 2))
    if [ $COUNTER -ge $TIMEOUT ]; then
      echo "❌ Timeout waiting for PostgreSQL at localhost:5432"
      kill $PG_PID 2>/dev/null || true
      exit 1
    fi
  done
  echo "✅ PostgreSQL is ready!"

  # Create application user and database if missing
  echo "Creating PostgreSQL user and database..."
  
  # Create user (handle if already exists)
  su - postgres -c "psql -c \"SELECT 1 FROM pg_user WHERE usename = '$POSTGRES_USER'\" | grep -q 1 || psql -c \"CREATE USER $POSTGRES_USER WITH PASSWORD '$POSTGRES_PASSWORD';\""
  
  # Create database (handle if already exists)  
  su - postgres -c "psql -c \"SELECT 1 FROM pg_database WHERE datname = '$POSTGRES_DB'\" | grep -q 1 || psql -c \"CREATE DATABASE $POSTGRES_DB OWNER $POSTGRES_USER;\""
  
  # Grant privileges
  su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE $POSTGRES_DB TO $POSTGRES_USER;\""
fi

# Continue with rest of your script...
export PGPASSWORD="$POSTGRES_PASSWORD"

# Prisma schema push
if [ -f prisma/schema.prisma ]; then
  echo "Running Prisma generate and db push..."
  npx prisma generate
  npx prisma db push --accept-data-loss --skip-generate
  echo "✅ Prisma schema pushed to PostgreSQL."
else
  echo "⚠️ Prisma schema.prisma not found. Skipping Prisma setup."
fi

# Set up vector database directories
echo "Setting up vector database directories..."
mkdir -p ./vector_indexes/contracts ./vector_indexes/documents
chmod -R 755 ./vector_indexes
echo "✅ Vector database directories created!"

# Start Node.js-based vector DB service (if present)
if [ -f ./services/vectorService.js ]; then
  echo "🟢 Starting Node.js-based Chroma Vector DB service..."
  node ./services/vectorService.js &
fi

# Test vector service initialization
echo "🧪 Testing vector service initialization..."
node -e "
const vectorService = require('./services/vectorService');
(async () => {
  try {
    await vectorService.initialize();
    console.log('✅ Vector service initialized successfully!');
  } catch (error) {
    console.warn('⚠️ Vector service initialization warning:', error.message);
    console.log('📝 Vector service will be initialized when the application starts');
  }
})();
" || echo "⚠️ Vector service test skipped - will initialize at runtime"

# Install Node.js dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Install client dependencies if needed
if [ -d "client" ] && [ ! -d "client/node_modules" ]; then
  echo "Installing client dependencies..."
  cd client
  npm install
  cd ..
fi

# Create necessary directories
mkdir -p uploads documents logs

echo "Starting Node.js server and React client..."
echo "API Server will be available at: http://localhost:3000"
echo "React Client will be available at: http://localhost:3001"
echo "Vector Database: Vectra (Pure Node.js - embedded)"
echo "Press Ctrl+C to stop all servers"

# Start the API server in background
npm run dev &
SERVER_PID=$!
echo $SERVER_PID > logs/server.pid

sleep 3

# Start the React client
if [ -d "client" ]; then
  echo "Starting React client..."
  cd client
  PORT=3001 BROWSER=none npm start &
  CLIENT_PID=$!
  echo $CLIENT_PID > ../logs/client.pid
  cd ..
  sleep 5
  echo "🎉 Both servers are running!"
  echo ""
  echo "📊 Services:"
  echo " • Node.js API Server:  http://localhost:3000"
  echo " • React Client:        http://localhost:3001"
  echo " • Vector Database:     Vectra (embedded in Node.js)"
  echo ""
  echo "📁 Data Storage:"
  echo " • Vector Indexes:      ./vector_indexes/"
  echo " • Uploaded Files:      ./uploads/"
  echo " • Documents:           ./documents/"
  echo ""
  echo "🌐 Open your browser to: http://localhost:3001"
else
  echo "Client directory not found. Only API server is running."
fi

echo "🎉 Environment setup and application startup complete!"

# Setup cleanup and wait indefinitely
cleanup() {
    echo -e "\n\n${YELLOW}🛑 Shutting down all services...${NC}"
    kill $SERVER_PID 2>/dev/null
    kill $CLIENT_PID 2>/dev/null
    echo -e "${GREEN}✅ Done.${NC}"
    exit 0
}

trap cleanup INT TERM
wait  # Wait indefinitely for any background process

echo "One or more services stopped. Container exiting."
