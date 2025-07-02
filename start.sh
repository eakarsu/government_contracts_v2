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

# Create necessary directories
mkdir -p uploads documents logs

print_success "Starting Node.js server in development mode..."
print_status "Server will be available at: http://localhost:3000"
print_status "Press Ctrl+C to stop the server"

# Start the server
npm run dev
