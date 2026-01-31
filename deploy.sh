#!/bin/bash

# ================================
# Instagram Automation Dashboard
# Docker Deployment Script
# ================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
print_info() {
    echo -e "${BLUE}ℹ ${1}${NC}"
}

print_success() {
    echo -e "${GREEN}✓ ${1}${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ ${1}${NC}"
}

print_error() {
    echo -e "${RED}✗ ${1}${NC}"
}

print_header() {
    echo ""
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}${1}${NC}"
    echo -e "${BLUE}================================${NC}"
    echo ""
}

# Check if Docker is installed
check_docker() {
    print_header "Checking Prerequisites"

    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        echo "Visit: https://docs.docker.com/engine/install/"
        exit 1
    fi
    print_success "Docker is installed: $(docker --version)"

    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed."
        exit 1
    fi
    print_success "Docker Compose is installed: $(docker-compose --version)"
}

# Check if .env.production exists
check_env_file() {
    print_header "Checking Environment Configuration"

    if [ ! -f ".env.production" ]; then
        print_error ".env.production file not found!"
        echo "Please create .env.production with your configuration."
        exit 1
    fi
    print_success ".env.production file found"

    # Check for placeholder values
    if grep -q "YOUR_PRODUCTION_APP_ID" .env.production; then
        print_warning "Found placeholder values in .env.production"
        print_warning "Please update VITE_META_APP_ID and VITE_META_APP_SECRET"
    fi

    if grep -q "your_prod_encryption_key_must_be_different" .env.production; then
        print_warning "Found default ENCRYPTION_KEY - please generate a secure key"
        echo "Run: openssl rand -hex 32"
    fi

    if grep -q "your_prod_jwt_secret_must_be_different" .env.production; then
        print_warning "Found default JWT_SECRET - please generate a secure key"
        echo "Run: openssl rand -base64 64"
    fi
}

# Check for port conflicts
check_ports() {
    print_header "Checking Port Availability"

    # Check if lsof is available
    if ! command -v lsof &> /dev/null; then
        print_warning "lsof not installed - skipping port check"
        return 0
    fi

    # Check port 8080 (frontend)
    if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        print_warning "Port 8080 is already in use!"
        echo "Process using port 8080:"
        lsof -Pi :8080 -sTCP:LISTEN
        echo ""
        echo "This may be:"
        echo "  - A previous deployment (run './deploy.sh --stop' first)"
        echo "  - Another web service"
        echo ""
        read -p "Continue anyway? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_error "Deployment cancelled"
            exit 1
        fi
    else
        print_success "Port 8080 is available"
    fi

    # Check port 3001 (backend)
    if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        print_warning "Port 3001 is already in use!"
        echo "Process using port 3001:"
        lsof -Pi :3001 -sTCP:LISTEN
        echo ""
        read -p "Continue anyway? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_error "Deployment cancelled"
            exit 1
        fi
    else
        print_success "Port 3001 is available"
    fi

    # Check if host Nginx is running on port 80 (informational only)
    if lsof -Pi :80 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        print_info "Port 80 is in use (likely host Nginx for SSL - this is normal)"
    fi
}

# Stop existing containers
stop_containers() {
    print_header "Stopping Existing Containers"

    if [ "$(docker-compose ps -q)" ]; then
        print_info "Stopping running containers..."
        docker-compose down
        print_success "Containers stopped"
    else
        print_info "No running containers found"
    fi
}

# Build images
build_images() {
    print_header "Building Docker Images"

    print_info "Building frontend and backend images..."
    print_info "This may take 5-10 minutes on first build..."

    if [ "$1" == "--no-cache" ]; then
        print_info "Building with --no-cache flag"
        docker-compose build --no-cache
    else
        docker-compose build
    fi

    print_success "Docker images built successfully"
}

# Start containers
start_containers() {
    print_header "Starting Containers"

    print_info "Starting frontend and backend services..."
    docker-compose up -d

    print_success "Containers started"

    # Wait for health checks
    print_info "Waiting for services to be healthy..."
    sleep 5

    # Check container status
    docker-compose ps
}

# Show logs
show_logs() {
    print_header "Container Logs"

    echo "Showing last 50 lines of logs..."
    echo "Press Ctrl+C to stop following logs"
    echo ""
    sleep 2
    docker-compose logs --tail=50 -f
}

# Display access information
show_access_info() {
    print_header "Deployment Complete!"

    # Get VPS IP (works on most Linux systems)
    if command -v hostname &> /dev/null; then
        VPS_IP=$(hostname -I | awk '{print $1}')
    else
        VPS_IP="your-vps-ip"
    fi

    print_success "Application is now running!"
    echo ""
    echo "Access your application:"
    echo "  Frontend: http://${VPS_IP}:8080"
    echo "  Backend:  http://${VPS_IP}:3001/health"
    echo ""
    echo "⚠️  For production with SSL, see: HETZNER_DEPLOYMENT.md"
    echo "   SSL setup will expose frontend on ports 80/443"
    echo ""
    echo "Useful commands:"
    echo "  View logs:       docker-compose logs -f"
    echo "  Check status:    docker-compose ps"
    echo "  Stop services:   docker-compose down"
    echo "  Restart:         docker-compose restart"
    echo ""
}

# Main deployment function
deploy() {
    print_header "Instagram Automation Dashboard - Docker Deployment"

    check_docker
    check_env_file
    check_ports
    stop_containers
    build_images "$1"
    start_containers
    show_access_info

    # Ask if user wants to see logs
    read -p "Do you want to view logs? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        show_logs
    fi
}

# Parse command line arguments
case "${1:-}" in
    --no-cache)
        deploy --no-cache
        ;;
    --rebuild)
        deploy --no-cache
        ;;
    --stop)
        print_header "Stopping All Containers"
        docker-compose down
        print_success "All containers stopped"
        ;;
    --logs)
        print_header "Viewing Logs"
        docker-compose logs -f
        ;;
    --status)
        print_header "Container Status"
        docker-compose ps
        echo ""
        docker stats --no-stream
        ;;
    --help|-h)
        echo "Instagram Automation Dashboard - Deployment Script"
        echo ""
        echo "Usage: ./deploy.sh [OPTION]"
        echo ""
        echo "Options:"
        echo "  (no args)      Deploy with cached builds"
        echo "  --no-cache     Deploy with fresh build (no cache)"
        echo "  --rebuild      Same as --no-cache"
        echo "  --stop         Stop all containers"
        echo "  --logs         View container logs"
        echo "  --status       Show container status and stats"
        echo "  --help, -h     Show this help message"
        echo ""
        ;;
    *)
        deploy
        ;;
esac
