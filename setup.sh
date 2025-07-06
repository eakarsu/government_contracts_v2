#!/bin/bash

# Contract Indexer Setup Script
# This script helps set up the development environment

set -e

echo "🔧 Setting up Contract Indexer Development Environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[SETUP]${NC} $1"
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

# Check if .env file exists and create if needed
setup_env_file() {
    if [ ! -f ".env" ]; then
        print_status "Creating .env file from .env.example..."
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_success ".env file created"
            print_warning "Please edit .env file with your actual API keys:"
            echo "  • SAM_GOV_API_KEY: Get from https://sam.gov/data-services"
            echo "  • OPENROUTER_API_KEY: Get from https://openrouter.ai"
        else
            print_error ".env.example file not found"
            exit 1
        fi
    else
        print_success ".env file already exists"
    fi
}

# Setup Python virtual environment
setup_python() {
    print_status "Setting up Python virtual environment..."
    
    if [ ! -d "venv" ]; then
        python3 -m venv venv
        print_success "Virtual environment created"
    else
        print_success "Virtual environment already exists"
    fi
    
    source venv/bin/activate
    
    if [ -f "requirements.txt" ]; then
        print_status "Installing Python dependencies..."
        pip install --upgrade pip
        pip install -r requirements.txt
        print_success "Python dependencies installed"
    fi
}

# Setup Node.js dependencies
setup_node() {
    if [ -d "client" ]; then
        print_status "Setting up React client dependencies..."
        cd client
        npm install
        cd ..
        print_success "React dependencies installed"
    else
        print_warning "Client directory not found"
    fi
}

# Create necessary directories
create_directories() {
    print_status "Creating necessary directories..."
    
    directories=(
        "logs"
        "uploads"
        "documents" 
        "queue_documents"
        "processed_queue_documents"
        "chromadb_data"
        "test_documents"
    )
    
    for dir in "${directories[@]}"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
            print_status "Created directory: $dir"
        fi
    done
    
    print_success "Directories created"
}

# Make scripts executable
setup_scripts() {
    print_status "Making scripts executable..."
    chmod +x start.sh stop.sh dev.sh setup.sh
    print_success "Scripts are now executable"
}

# Main setup function
main() {
    echo "🏗️  Contract Indexer Setup"
    echo "=========================="
    
    setup_env_file
    setup_python
    setup_node
    create_directories
    setup_scripts
    
    echo ""
    print_success "🎉 Setup complete!"
    echo ""
    echo "Next steps:"
    echo "  1. Edit .env file with your API keys"
    echo "  2. Run: ./start.sh"
    echo ""
    echo "Available commands:"
    echo "  • ./start.sh  - Start all services"
    echo "  • ./stop.sh   - Stop all services"
    echo "  • ./dev.sh    - Start in development mode"
    echo ""
}

main "$@"
