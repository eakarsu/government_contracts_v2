#!/bin/bash

# Simple Node.js Development Starter
# Just starts the Node.js server in development mode

set -e  # Exit on any error

echo "🚀 Starting Node.js Development Server..."

# Colors for output
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

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if Node.js and npm are installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Cleanup function
cleanup() {
    print_status "Shutting down servers..."
    
    # Kill server process
    if [ -f logs/server.pid ]; then
        SERVER_PID=$(cat logs/server.pid)
        if kill -0 $SERVER_PID 2>/dev/null; then
            kill $SERVER_PID
            print_status "API server stopped"
        fi
        rm -f logs/server.pid
    fi
    
    # Kill client process
    if [ -f logs/client.pid ]; then
        CLIENT_PID=$(cat logs/client.pid)
        if kill -0 $CLIENT_PID 2>/dev/null; then
            kill $CLIENT_PID
            print_status "React client stopped"
        fi
        rm -f logs/client.pid
    fi
    
    print_success "All servers stopped!"
    exit 0
}

# Trap cleanup on script exit
trap cleanup EXIT INT TERM

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_warning ".env file not found. Creating from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        print_warning "Please edit .env file with your API keys before running the server."
    else
        print_warning "No .env.example found. You may need to create a .env file manually."
    fi
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    print_status "Installing dependencies..."
    npm install
fi

# Install client dependencies if needed
if [ -d "client" ] && [ ! -d "client/node_modules" ]; then
    print_status "Installing client dependencies..."
    cd client
    npm install
    cd ..
fi

# Create necessary directories
mkdir -p uploads documents logs

print_success "Starting Node.js server and React client..."
print_status "API Server will be available at: http://localhost:3000"
print_status "React Client will be available at: http://localhost:3001"
print_status "Vector Database: Vectra (Pure Node.js - embedded)"
print_status "Press Ctrl+C to stop all servers"

# Start the API server in background
npm run dev &
SERVER_PID=$!
echo $SERVER_PID > logs/server.pid

# Wait a moment for server to start
sleep 3

# Start the React client
if [ -d "client" ]; then
    print_status "Starting React client..."
    cd client
    PORT=3001 BROWSER=none npm start &
    CLIENT_PID=$!
    echo $CLIENT_PID > ../logs/client.pid
    cd ..
    
    # Wait for React to start
    sleep 5
    
    print_success "🎉 Both servers are running!"
    echo ""
    echo "📊 Services:"
    echo "  • Node.js API Server:  http://localhost:3000"
    echo "  • React Client:        http://localhost:3001"
    echo "  • Vector Database:     Vectra (embedded in Node.js)"
    echo ""
    echo "📁 Data Storage:"
    echo "  • Vector Indexes:      ./vector_indexes/"
    echo "  • Uploaded Files:      ./uploads/"
    echo "  • Documents:           ./documents/"
    echo ""
    echo "🌐 Open your browser to: http://localhost:3001"
    
    # Try to open browser automatically
    if command -v open &> /dev/null; then
        sleep 2
        open http://localhost:3001
    fi
    
    # Keep script running and wait for both processes
    wait $SERVER_PID $CLIENT_PID
else
    print_warning "Client directory not found. Only API server is running."
    wait $SERVER_PID
fi
