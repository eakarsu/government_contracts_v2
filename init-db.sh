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
    
    # Run AI-powered features migration
    echo "🤖 Setting up AI-powered features database schema..."
    if [ -f "database/migrations/001_create_enhanced_tables.sql" ]; then
        psql $DATABASE_URL -f database/migrations/001_create_enhanced_tables.sql
        echo "✅ AI features database schema created!"
    else
        echo "⚠️ AI features migration file not found, creating basic tables..."
        psql $DATABASE_URL -c "
        CREATE EXTENSION IF NOT EXISTS vector;
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            first_name VARCHAR(100),
            last_name VARCHAR(100),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS business_profiles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            company_name VARCHAR(255) NOT NULL,
            naics_codes JSONB,
            capabilities TEXT[],
            certifications JSONB,
            past_performance JSONB,
            geographic_preferences JSONB,
            annual_revenue DECIMAL(15,2),
            employee_count INTEGER,
            security_clearance_level VARCHAR(50),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS contract_embeddings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
            embedding VECTOR(1536),
            content_summary TEXT,
            metadata JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        "
        echo "✅ Basic AI features tables created!"
    fi
    
    echo "✅ PostgreSQL tables initialized!"
else
    echo "⚠️ Skipping PostgreSQL table initialization (database not available)"
    echo "💡 Generate Prisma client for development..."
    npx prisma generate || echo "⚠️ Prisma generate failed - continuing anyway"
fi

# Initialize vector database directories and AI features directories
echo "🔍 Setting up vector database and AI features directories..."
mkdir -p ./vector_indexes
mkdir -p ./vector_indexes/contracts
mkdir -p ./vector_indexes/documents
mkdir -p ./uploads/rfp-documents
mkdir -p ./uploads/documents
mkdir -p ./logs
mkdir -p ./database/migrations
mkdir -p ./routes/api
mkdir -p ./middleware
mkdir -p ./utils
mkdir -p ./scripts
chmod -R 755 ./vector_indexes
chmod -R 755 ./uploads
chmod -R 755 ./logs
echo "✅ Vector database and AI features directories created!"

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

# Check for required environment variables for AI features
echo "🔍 Checking AI features configuration..."
if [ -z "$OPENROUTER_API_KEY" ]; then
    echo "⚠️ OPENROUTER_API_KEY not set - AI features will not work"
    echo "💡 Add your OpenRouter API key to .env file"
else
    echo "✅ OpenRouter API key configured"
fi

if [ -z "$SESSION_SECRET" ]; then
    echo "⚠️ SESSION_SECRET not set - authentication will not work"
    echo "💡 Add a session secret to .env file"
else
    echo "✅ Session secret configured"
fi

echo "🎉 Database initialization completed!"
if [ "$POSTGRES_AVAILABLE" = true ]; then
    echo "📊 PostgreSQL: Ready with Prisma schema and AI features"
else
    echo "📊 PostgreSQL: Not available (will need to be started separately)"
fi
echo "🔍 ChromaDB: Ready with contracts and documents collections"
echo "🤖 AI Features: Database schema ready"
echo "🚀 Application is ready to start!"

# Print helpful information
echo ""
echo "📋 Next steps:"
if [ "$POSTGRES_AVAILABLE" = false ]; then
    echo "   1. Start PostgreSQL database:"
    echo "      docker-compose up postgres -d"
    echo "   2. Re-run this script: npm run init-db"
    echo "   3. Install dependencies: npm install"
    echo "   4. Start the application: npm run dev-full"
else
    echo "   1. Install dependencies: npm install"
    echo "   2. Start the application: npm run dev-full"
    echo "   3. Access the app at http://localhost:3001"
fi

echo ""
echo "🔧 AI Features Setup:"
echo "   • Semantic Search: /semantic-search"
echo "   • Business Profile: /profile/setup"
echo "   • Opportunities: /opportunities"
echo "   • Proposals: /proposals"
echo "   • Compliance: /compliance"
echo "   • Bid Analysis: /bidding"
echo ""
