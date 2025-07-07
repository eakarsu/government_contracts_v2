#!/bin/bash
set -e

echo "🚀 Starting database initialization..."

# Set default values for environment variables
export POSTGRES_HOST=${POSTGRES_HOST:-postgres}
export POSTGRES_PORT=${POSTGRES_PORT:-5432}
export POSTGRES_USER=${POSTGRES_USER:-contract_user}
export POSTGRES_DB=${POSTGRES_DB:-contract_db}

# Wait for PostgreSQL to be ready with timeout
echo "⏳ Waiting for PostgreSQL to be ready..."
TIMEOUT=60
COUNTER=0
until pg_isready -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB; do
  echo "PostgreSQL is unavailable - sleeping (${COUNTER}/${TIMEOUT}s)"
  sleep 2
  COUNTER=$((COUNTER + 2))
  if [ $COUNTER -ge $TIMEOUT ]; then
    echo "❌ Timeout waiting for PostgreSQL"
    exit 1
  fi
done
echo "✅ PostgreSQL is ready!"

# Initialize PostgreSQL tables using Prisma
echo "📊 Initializing PostgreSQL tables with Prisma..."
npx prisma generate
npx prisma db push --accept-data-loss --skip-generate
echo "✅ PostgreSQL tables initialized!"

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

echo "🎉 Database initialization completed successfully!"
echo "📊 PostgreSQL: Ready with Prisma schema"
echo "🔍 ChromaDB: Ready with contracts and documents collections"
echo "🚀 Application is ready to start!"
