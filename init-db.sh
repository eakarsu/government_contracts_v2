#!/bin/bash
set -e

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
mkdir -p /app/vector_indexes
mkdir -p /app/vector_indexes/contracts
mkdir -p /app/vector_indexes/documents
chmod -R 755 /app/vector_indexes
echo "✅ Vector database directories created!"

# Initialize ChromaDB collections
echo "🔍 Initializing ChromaDB collections..."
python3 -c "
import chromadb
import os
import sys

try:
    # Initialize ChromaDB client
    client = chromadb.PersistentClient(path='/app/vector_indexes')
    
    # Create contracts collection if it doesn't exist
    try:
        contracts_collection = client.get_collection('contracts')
        print('✅ Contracts collection already exists')
    except:
        contracts_collection = client.create_collection('contracts')
        print('✅ Created contracts collection')
    
    # Create documents collection if it doesn't exist
    try:
        documents_collection = client.get_collection('documents')
        print('✅ Documents collection already exists')
    except:
        documents_collection = client.create_collection('documents')
        print('✅ Created documents collection')
    
    print('✅ ChromaDB initialization completed successfully!')
    
except Exception as e:
    print(f'❌ ChromaDB initialization failed: {e}')
    sys.exit(1)
"

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
