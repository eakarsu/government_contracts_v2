#!/bin/bash

# Contract Indexer Full Stack Startup Script
# This script starts the database, Node.js server, and React client

set -e  # Exit on any error

echo "🚀 Starting Contract Indexer Full Stack Application..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required commands exist
check_dependencies() {
    print_status "Checking dependencies..."
    
    local missing_deps=()
    
    if ! command -v node &> /dev/null; then
        missing_deps+=("node")
    fi
    
    if ! command -v npm &> /dev/null; then
        missing_deps+=("npm")
    fi
    
    if ! command -v docker &> /dev/null; then
        missing_deps+=("docker")
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        missing_deps+=("docker-compose")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_error "Missing dependencies: ${missing_deps[*]}"
        print_error "Please install the missing dependencies and try again."
        exit 1
    fi
    
    print_success "All dependencies found!"
}

# Check if .env file exists
check_env_file() {
    if [ ! -f ".env" ]; then
        print_warning ".env file not found. Creating from .env.example..."
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_warning "Please edit .env file with your actual API keys and configuration."
        else
            print_error ".env.example file not found. Please create .env file manually."
            exit 1
        fi
    fi
}

# Start PostgreSQL database using existing docker-compose
start_database() {
    print_status "Starting PostgreSQL database..."
    
    # Start PostgreSQL using existing docker-compose
    docker-compose up -d postgres
    
    # Wait for database to be ready
    print_status "Waiting for database to be ready..."
    timeout=60
    while ! docker-compose exec -T postgres pg_isready -U contract_user -d contract_db &> /dev/null; do
        sleep 2
        timeout=$((timeout - 2))
        if [ $timeout -le 0 ]; then
            print_error "Database failed to start within 60 seconds"
            exit 1
        fi
    done
    
    print_success "Database is ready!"
}

# Install dependencies
install_dependencies() {
    print_status "Installing server dependencies..."
    npm install
    
    if [ -d "client" ]; then
        print_status "Installing client dependencies..."
        cd client
        npm install
        cd ..
    else
        print_warning "Client directory not found. Skipping client dependency installation."
    fi
    
    print_success "Dependencies installed!"
}

# Setup database schema
setup_database() {
    print_status "Setting up database schema..."
    
    # Generate Prisma client
    npx prisma generate
    
    # Run database migrations
    npx prisma migrate dev --name init
    
    print_success "Database schema ready!"
}

# Start the servers
start_servers() {
    print_status "Starting servers..."
    
    # Create log directory
    mkdir -p logs
    
    # Start React client if directory exists
    if [ -d "client" ]; then
        print_status "Starting React client on port 3000..."
        cd client
        BROWSER=none npm start > ../logs/react.log 2>&1 &
        REACT_PID=$!
        echo $REACT_PID > ../logs/react.pid
        cd ..
        
        # Wait a moment for React to start
        sleep 5
        
        # Check if React client is running
        if ! kill -0 $REACT_PID 2>/dev/null; then
            print_error "Failed to start React client. Check logs/react.log for details."
            exit 1
        fi
    else
        print_warning "Client directory not found. Skipping React client startup."
    fi
    
    print_success "Servers started successfully!"
}

# Display status and URLs
show_status() {
    echo ""
    echo "🎉 Contract Indexer is now running!"
    echo ""
    echo "📊 Services:"
    echo "  • PostgreSQL Database: localhost:5432"
    echo "  • Node.js API Server:  http://localhost:3000"
    if [ -d "client" ]; then
        echo "  • React Client:        http://localhost:3001"
    fi
    echo ""
    echo "📁 Logs:"
    echo "  • Server logs: logs/server.log"
    if [ -d "client" ]; then
        echo "  • Client logs: logs/client.log"
    fi
    echo ""
    echo "🔧 Management:"
    echo "  • Stop all: ./stop.sh"
    echo "  • View logs: tail -f logs/server.log"
    echo "  • Database admin: npx prisma studio"
    echo ""
    if [ -d "client" ]; then
        echo "🌐 Open in browser: http://localhost:3001"
        
        # Try to open browser automatically
        if command -v open &> /dev/null; then
            print_status "Opening browser..."
            sleep 2
            open http://localhost:3001
        elif command -v xdg-open &> /dev/null; then
            print_status "Opening browser..."
            sleep 2
            xdg-open http://localhost:3001
        fi
    else
        echo "🌐 API available at: http://localhost:3000"
    fi
    echo ""
}

# Cleanup function
cleanup() {
    print_status "Cleaning up..."
    
    # Kill server processes
    if [ -f logs/server.pid ]; then
        SERVER_PID=$(cat logs/server.pid)
        if kill -0 $SERVER_PID 2>/dev/null; then
            kill $SERVER_PID
        fi
        rm -f logs/server.pid
    fi
    
    if [ -f logs/client.pid ]; then
        CLIENT_PID=$(cat logs/client.pid)
        if kill -0 $CLIENT_PID 2>/dev/null; then
            kill $CLIENT_PID
        fi
        rm -f logs/client.pid
    fi
    
    # Stop database
    docker-compose down
    
    print_success "Cleanup complete!"
}

# Trap cleanup on script exit
trap cleanup EXIT INT TERM

# Main execution
main() {
    echo "🏗️  Contract Indexer Full Stack Startup"
    echo "========================================"
    
    check_dependencies
    check_env_file
    start_database
    install_dependencies
    setup_database
    start_servers
    show_status
    
    # Keep script running
    print_status "Press Ctrl+C to stop all services..."
    while true; do
        sleep 1
    done
}

# Run main function
main "$@"
