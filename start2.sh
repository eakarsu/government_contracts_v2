#!/bin/sh
set -e

# Port configuration - customize these for your environment
WEB_PORT=${WEB_PORT:-3001}          # React/frontend port
SERVER_PORT=${SERVER_PORT:-3000}    # API/backend server port
PROXY_PORT=${PROXY_PORT:-5013}      # Proxy port

# Function to kill processes running on a specific port
kill_port() {
    local port=$1
    local description=${2:-"port $port"}
    local pids=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$pids" ]; then
        echo "🔪 Killing processes on $description ($port): $pids"
        echo $pids | xargs kill -9 2>/dev/null
        sleep 1
    else
        echo "✅ No processes found on $description ($port)"
    fi
}

# Function to clean up all development processes
cleanup_dev_processes() {
    echo "🧹 Cleaning up existing development processes..."
    
    # Kill processes on configured ports
    kill_port $PROXY_PORT "proxy"
    kill_port $WEB_PORT "web/frontend"
    kill_port $SERVER_PORT "server/backend"
    
    # Kill specific process types
    echo "🔪 Killing development process types..."
    pkill -f nodemon 2>/dev/null || true
    pkill -f "node.*server" 2>/dev/null || true
    pkill -f "npm.*start" 2>/dev/null || true
    pkill -f "npm.*dev" 2>/dev/null || true
    pkill -f "react-scripts" 2>/dev/null || true
    
    echo "✅ Development processes cleaned up"
}

# Function to build and serve client for hosting (production)
start_client_hosting() {
  if [ -d "client" ]; then
    echo "Building React client for hosting..."
    cd client
    # Set NODE_ENV for production build
    NODE_ENV=production npm run build
    cd ..
    # Remove old build dir if it exists
    rm -rf public
    # Copy built client to your backend's static directory
    mkdir -p public
    cp -r client/build/* public/
    echo "✅ React client built and served from backend"
    
    # Debug: Show generated config
    if [ -f "public/config.js" ]; then
      echo "🔧 Generated config.js:"
      cat public/config.js
    else
      echo "⚠️ No config.js found in build"
    fi
  else
    echo "❌ Client directory not found"
  fi
}

# Function to start client in development mode for local testing
start_client_local() {
  if [ -d "client" ]; then
    echo "Starting React client in development mode..."
    cd client
    PORT=$WEB_PORT BROWSER=none npm start &
    CLIENT_PID=$!
    echo $CLIENT_PID > ../logs/client.pid
    cd ..
    echo "✅ React client started at http://localhost:$WEB_PORT"
    return $CLIENT_PID
  else
    echo "❌ Client directory not found"
    return 0
  fi
}

# Check command line arguments
MODE="hosting"  # default mode
if [ "$1" = "local" ]; then
  MODE="local"
elif [ "$1" = "hosting" ]; then
  MODE="hosting"
elif [ "$1" = "cleanup" ] || [ "$1" = "kill" ]; then
  echo "🧹 Cleanup mode: Killing all development processes and ports..."
  cleanup_dev_processes
  echo "🎉 Cleanup complete!"
  exit 0
elif [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
  echo "Usage: $0 [local|hosting|cleanup]"
  echo "  local   - Start client in development mode (separate React dev server)"
  echo "  hosting - Build client and serve from backend (default)"
  echo "  cleanup - Kill all development processes and clean ports"
  echo ""
  echo "Port Configuration (customize with environment variables):"
  echo "  WEB_PORT=$WEB_PORT          - React/frontend port"
  echo "  SERVER_PORT=$SERVER_PORT    - API/backend server port"
  echo "  PROXY_PORT=$PROXY_PORT      - Proxy port"
  echo ""
  echo "Examples:"
  echo "  WEB_PORT=3002 SERVER_PORT=8080 PROXY_PORT=8000 $0 local"
  exit 0
fi

echo "🚀 Starting in $MODE mode"

# Clean up any existing processes before starting
cleanup_dev_processes

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
echo "API Server will be available at: http://localhost:$SERVER_PORT"
echo "React Client will be available at: http://localhost:$WEB_PORT"
echo "Vector Database: Vectra (Pure Node.js - embedded)"
echo "Press Ctrl+C to stop all servers"

# Start the API server in background
PORT=$PROXY_PORT BROWSER=none npm run dev &
SERVER_PID=$!
echo $SERVER_PID > logs/server.pid

sleep 3

# Start the React client based on mode
if [ "$MODE" = "local" ]; then
  start_client_local
  CLIENT_PID=$?
  sleep 5
  echo "🎉 Both servers are running in LOCAL mode!"
  echo ""
  echo "📊 Services:"
  echo " • Node.js API Server:  http://localhost:$SERVER_PORT"
  echo " • React Dev Server:    http://localhost:$WEB_PORT"
  echo " • Vector Database:     Vectra (embedded in Node.js)"
  echo ""
  echo "🌐 Open your browser to: http://localhost:$WEB_PORT"
else
  start_client_hosting
  sleep 5
  echo "🎉 Server running in HOSTING mode!"
  echo ""
  echo "📊 Services:"
  echo " • Node.js API Server:  http://localhost:$SERVER_PORT"
  echo " • React Client:        Served from backend"
  echo " • Vector Database:     Vectra (embedded in Node.js)"
  echo ""
  echo "🌐 Open your browser to: http://localhost:$SERVER_PORT"
fi

echo ""
echo "📁 Data Storage:"
echo " • Vector Indexes:      ./vector_indexes/"
echo " • Uploaded Files:      ./uploads/"
echo " • Documents:           ./documents/"
echo ""

echo "🎉 Environment setup and application startup complete!"

# Setup cleanup and wait indefinitely
cleanup() {
    echo -e "\n\n🛑 Shutting down all services..."
    
    # Kill processes by PID if they exist (graceful first)
    if [ -n "$SERVER_PID" ]; then
        echo "📊 Stopping API server (PID: $SERVER_PID)..."
        kill $SERVER_PID 2>/dev/null
        sleep 1
    fi
    
    if [ -n "$CLIENT_PID" ]; then
        echo "⚛️  Stopping React client (PID: $CLIENT_PID)..."
        kill $CLIENT_PID 2>/dev/null
        sleep 1
    fi
    
    # Kill any remaining processes on specific ports
    echo "🔍 Final cleanup of configured ports..."
    
    # Kill processes on configured ports
    kill_port $PROXY_PORT "proxy"
    kill_port $WEB_PORT "web/frontend"
    kill_port $SERVER_PORT "server/backend"
    
    # Kill any nodemon processes
    echo "🔪 Killing nodemon processes..."
    pkill -f nodemon 2>/dev/null
    
    # Kill any node processes running our server
    echo "🔪 Killing node server processes..."
    pkill -f "node.*server.js" 2>/dev/null
    
    # Kill any npm processes
    echo "🔪 Killing npm processes..."
    pkill -f "npm.*start" 2>/dev/null
    pkill -f "npm.*dev" 2>/dev/null
    
    echo "✅ All services stopped."
    exit 0
}

# Set up signal handling for clean shutdown
trap cleanup INT TERM EXIT

# Print helpful message
echo ""
echo "💡 Press Ctrl+C to stop all services cleanly"
echo ""

# Wait for all background processes
wait  # Wait indefinitely for any background process

echo "One or more services stopped. Container exiting."
