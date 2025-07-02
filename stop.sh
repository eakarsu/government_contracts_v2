#!/bin/bash

# Contract Indexer Stop Script
# This script stops all running services

set -e

echo "🛑 Stopping Contract Indexer services..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Stop Node.js server
if [ -f logs/server.pid ]; then
    SERVER_PID=$(cat logs/server.pid)
    if kill -0 $SERVER_PID 2>/dev/null; then
        print_status "Stopping Node.js server (PID: $SERVER_PID)..."
        kill $SERVER_PID
        print_success "Node.js server stopped"
    fi
    rm -f logs/server.pid
fi

# Stop React client
if [ -f logs/client.pid ]; then
    CLIENT_PID=$(cat logs/client.pid)
    if kill -0 $CLIENT_PID 2>/dev/null; then
        print_status "Stopping React client (PID: $CLIENT_PID)..."
        kill $CLIENT_PID
        print_success "React client stopped"
    fi
    rm -f logs/client.pid
fi

# Stop any remaining node processes on ports 3000 and 3001
print_status "Cleaning up any remaining processes..."
pkill -f "node.*3000" 2>/dev/null || true
pkill -f "node.*3001" 2>/dev/null || true

# Stop database
if [ -f docker-compose.yml ]; then
    print_status "Stopping PostgreSQL database..."
    docker-compose down
    print_success "Database stopped"
fi

print_success "All services stopped successfully!"
