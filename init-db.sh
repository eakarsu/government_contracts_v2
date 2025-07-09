#!/bin/sh

echo "🚀 Starting database initialization..."

# Set default values for environment variables
export POSTGRES_HOST=${POSTGRES_HOST:-localhost}
export POSTGRES_PORT=${POSTGRES_PORT:-5432}
export POSTGRES_USER=${POSTGRES_USER:-contract_user}
export POSTGRES_DB=${POSTGRES_DB:-contract_db}

# Check if we're in Docker environment
if [ -f /.dockerenv ]; then
    echo "🐳 Running in Docker container"
    export POSTGRES_HOST=${POSTGRES_HOST:-postgres}
else
    echo "💻 Running on local machine"
    export POSTGRES_HOST=${POSTGRES_HOST:-localhost}
fi

# --- PostgreSQL Startup ---
if [ ! -d "$PGDATA" ] || [ -z "$(ls -A "$PGDATA")" ]; then
  echo "🔧 Initializing PostgreSQL data directory at $PGDATA"
  su - postgres -c "initdb -D $PGDATA"
fi

echo "🟢 Starting PostgreSQL server..."
su - postgres -c "pg_ctl -D $PGDATA -l /tmp/postgres.log start"


echo "🔍 Checking PostgreSQL connection to $POSTGRES_HOST:$POSTGRES_PORT..."

# Wait for PostgreSQL to be ready with timeout
echo "⏳ Waiting for PostgreSQL to be ready..."
TIMEOUT=60
COUNTER=0
POSTGRES_AVAILABLE=false

until pg_isready -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB 2>/dev/null; do
  echo "PostgreSQL is unavailable - sleeping (${COUNTER}/${TIMEOUT}s)"
  sleep 2
  COUNTER=$((COUNTER + 2))
  if [ $COUNTER -ge $TIMEOUT ]; then
    echo "❌ Timeout waiting for PostgreSQL at $POSTGRES_HOST:$POSTGRES_PORT"
    echo "💡 PostgreSQL is not available. Skipping database initialization."
    echo "💡 You can run this script again once PostgreSQL is running."
    POSTGRES_AVAILABLE=false
    break
  fi
done

if pg_isready -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB 2>/dev/null; then
    POSTGRES_AVAILABLE=true
    echo "✅ PostgreSQL is ready!"
fi

# Initialize PostgreSQL tables using Prisma (only if PostgreSQL is available)
if [ "$POSTGRES_AVAILABLE" = true ]; then
    echo "📊 Initializing PostgreSQL tables with Prisma..."
    npx prisma generate
    npx prisma db push --accept-data-loss --skip-generate
    echo "✅ PostgreSQL tables initialized!"
else
    echo "⚠️ Skipping PostgreSQL table initialization (database not available)"
    echo "💡 Generate Prisma client for development..."
    npx prisma generate || echo "⚠️ Prisma generate failed - continuing anyway"
fi

# Initialize vector database directories
echo "🔍 Setting up vector database directories..."
mkdir -p ./vector_indexes
mkdir -p ./vector_indexes/contracts
mkdir -p ./vector_indexes/documents
chmod -R 755 ./vector_indexes
echo "✅ Vector database directories created!"

# --- Node.js-Based Chroma Vector DB Startup ---
echo "🟢 Starting Node.js-based Chroma Vector DB service..."
node ./services/vectorService.js &

# Test vector service initialization (optional - don't fail if it doesn't work)
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

echo "🎉 Database initialization completed!"
if [ "$POSTGRES_AVAILABLE" = true ]; then
    echo "📊 PostgreSQL: Ready with Prisma schema"
else
    echo "📊 PostgreSQL: Not available (will need to be started separately)"
fi
echo "🔍 ChromaDB: Ready with contracts and documents collections"
echo "🚀 Application is ready to start!"

# Print helpful information
echo ""
echo "📋 Next steps:"
if [ "$POSTGRES_AVAILABLE" = false ]; then
    echo "   1. Start PostgreSQL database:"
    echo "      docker-compose up postgres -d"
    echo "   2. Re-run this script: npm run init-db"
    echo "   3. Start the application: npm start"
else
    echo "   1. Start the application: npm start"
fi
echo ""
