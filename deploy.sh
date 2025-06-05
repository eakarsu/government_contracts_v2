#!/bin/bash

echo "Government Contract Intelligence Platform - Docker Deployment"
echo "============================================================"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo ""
    echo "⚠️  IMPORTANT: Please edit .env file and add your API keys:"
    echo "   - OPENROUTER_API_KEY (required for AI analysis)"
    echo "   - SAM_GOV_API_KEY (required for contract fetching)"
    echo ""
    echo "After updating .env, run this script again."
    exit 1
fi

# Check if required API keys are set
if ! grep -q "^OPENROUTER_API_KEY=.*[^=]" .env || ! grep -q "^SAM_GOV_API_KEY=.*[^=]" .env; then
    echo "⚠️  Please set your API keys in .env file:"
    echo "   - OPENROUTER_API_KEY"
    echo "   - SAM_GOV_API_KEY"
    echo ""
    echo "Edit .env file and run this script again."
    exit 1
fi

echo "✅ Environment configuration found"

# Create necessary directories
mkdir -p chromadb_data
mkdir -p test_documents

echo "✅ Created data directories"

# Build and start services
echo "🚀 Building and starting services..."
docker-compose down --remove-orphans
docker-compose up --build -d

echo ""
echo "⏳ Waiting for services to start..."
sleep 10

# Check service health
echo "🔍 Checking service health..."

# Check PostgreSQL
if docker-compose exec postgres pg_isready -U contract_user -d contract_db >/dev/null 2>&1; then
    echo "✅ PostgreSQL is ready"
else
    echo "❌ PostgreSQL is not ready"
fi

# Check application
if curl -sf http://localhost:5000/ >/dev/null 2>&1; then
    echo "✅ Application is running"
else
    echo "❌ Application is not responding"
    echo "Check logs with: docker-compose logs app"
fi

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "Access your application:"
echo "  Web Interface: http://localhost:5000"
echo "  API Docs: http://localhost:5000/api/docs"
echo ""
echo "Useful commands:"
echo "  View logs: docker-compose logs -f"
echo "  Stop services: docker-compose down"
echo "  Restart: docker-compose restart"
echo ""
echo "First steps:"
echo "  1. Visit http://localhost:5000"
echo "  2. Use 'Fetch Contracts' to load SAM.gov data"
echo "  3. Use 'Index Contracts' to enable search"
echo "  4. Search and analyze contracts with AI"