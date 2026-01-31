# 🐳 Docker Deployment Guide - Instagram Automation Dashboard

Complete guide for deploying the Instagram Automation Dashboard using Docker on a VPS.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Configuration](#configuration)
4. [Building & Running](#building--running)
5. [Production Deployment](#production-deployment)
6. [Troubleshooting](#troubleshooting)
7. [Maintenance](#maintenance)
8. [Architecture](#architecture)

---

## 🎯 Prerequisites

### Required Software

- **Docker**: v24.0+ ([Install Docker](https://docs.docker.com/engine/install/))
- **Docker Compose**: v2.0+ (included with Docker Desktop)
- **Git**: For cloning the repository

### VPS Requirements

- **OS**: Ubuntu 22.04 LTS or similar Linux distribution
- **RAM**: Minimum 2GB (4GB recommended)
- **CPU**: 2+ cores recommended
- **Storage**: 20GB+ available disk space
- **Network**: Public IP address with ports 80 and 443 available

### External Services

- **Supabase**: PostgreSQL database (already configured)
- **Meta Developer Account**: For Instagram API access
- **Domain Name**: (Optional) For production deployment with SSL

---

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd instagram-automation-dashboard
```

### 2. Verify Environment Configuration

Check that [.env.production](.env.production) has all required values:

```bash
# View the current configuration
cat .env.production
```

**Important Variables to Update:**
- `VITE_META_APP_ID` - Replace `YOUR_PRODUCTION_APP_ID` with actual value
- `VITE_META_APP_SECRET` - Replace `YOUR_PRODUCTION_APP_SECRET` with actual value
- `ENCRYPTION_KEY` - Must be a strong 64-character hex string
- `JWT_SECRET` - Must be a strong secret key
- `BACKEND_STATIC_IP` - Your VPS public IP address

### 3. Build Docker Images

```bash
# Build both frontend and backend images
docker-compose build
```

This will:
- Build the frontend (Vite + React → Nginx)
- Build the backend (Node.js + Express)
- Use environment variables from `.env.production`

### 4. Start the Application

```bash
# Start all services in detached mode
docker-compose up -d
```

### 5. Verify Services are Running

```bash
# Check container status
docker-compose ps

# Check logs
docker-compose logs -f
```

You should see:
- ✅ `instagram-frontend` running on port 8080
- ✅ `instagram-backend` running on port 3001

**Note**: Frontend runs on port 8080 to allow host-level Nginx to handle SSL on ports 80/443.

### 6. Access the Application

- **Frontend**: http://your-vps-ip:8080 (Docker container port)
- **Backend API**: http://your-vps-ip:3001/health

**For Production with SSL**:
- See [HETZNER_DEPLOYMENT.md](HETZNER_DEPLOYMENT.md) for complete Hetzner VPS setup with Let's Encrypt SSL
- Once SSL is configured, access via:
  - Frontend: https://your-domain.com
  - Backend: https://api.your-domain.com

---

## ⚙️ Configuration

### Environment Variables

All configuration is in [.env.production](.env.production). This file is automatically loaded by Docker Compose.

#### Required Updates Before Deployment

```bash
# Edit .env.production
nano .env.production
```

**Critical Variables:**

```bash
# Meta/Facebook App (REQUIRED)
VITE_META_APP_ID=<your-actual-app-id>
VITE_META_APP_SECRET=<your-actual-app-secret>

# Security (REQUIRED - Generate new values)
ENCRYPTION_KEY=<64-character-hex-string>
JWT_SECRET=<strong-random-secret>

# Static IP (REQUIRED)
BACKEND_STATIC_IP=<your-vps-ip>

# Admin Credentials (RECOMMENDED to change)
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=<strong-password>
```

#### Generate Secure Keys

```bash
# Generate encryption key (64-character hex)
openssl rand -hex 32

# Generate JWT secret
openssl rand -base64 64

# Generate webhook verify token
openssl rand -hex 32
```

### Port Configuration

Default ports are configured in [docker-compose.yml](docker-compose.yml):
- Frontend: `80` (HTTP)
- Backend: `3001` (API)

To change ports, edit `docker-compose.yml`:

```yaml
services:
  frontend:
    ports:
      - "8080:80"  # Change 8080 to your desired external port

  backend:
    ports:
      - "3001:3001"  # Backend port
```

---

## 🏗️ Building & Running

### Development Build

```bash
# Build images
docker-compose build

# Start services with logs visible
docker-compose up
```

### Production Build

```bash
# Build with no cache (ensures fresh build)
docker-compose build --no-cache

# Start in detached mode
docker-compose up -d

# View logs
docker-compose logs -f
```

### Individual Service Management

```bash
# Build only frontend
docker-compose build frontend

# Build only backend
docker-compose build backend

# Restart specific service
docker-compose restart backend

# Stop specific service
docker-compose stop frontend
```

### Rebuild After Code Changes

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

---

## 🌐 Production Deployment

> **📖 Complete Deployment Guide**: For detailed step-by-step instructions for deploying on Hetzner VPS with Let's Encrypt SSL, see **[HETZNER_DEPLOYMENT.md](HETZNER_DEPLOYMENT.md)**

This section provides a quick overview of production deployment steps.

### Step 1: Prepare VPS

#### Install Docker on Ubuntu

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker-compose --version
```

#### Configure Firewall

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow backend API (optional - if exposing directly)
sudo ufw allow 3001/tcp

# Enable firewall
sudo ufw enable
```

### Step 2: Clone and Configure

```bash
# Clone repository
git clone <your-repository-url>
cd instagram-automation-dashboard

# Update .env.production with production values
nano .env.production
```

### Step 3: Deploy with Docker Compose

```bash
# Build images
docker-compose build --no-cache

# Start services
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs -f
```

### Step 4: Setup SSL (Optional but Recommended)

#### Using Nginx Reverse Proxy with Let's Encrypt

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx -y

# Create nginx config for reverse proxy
sudo nano /etc/nginx/sites-available/instagram-dashboard

# Use the provided nginx-host.conf template
# Or add basic configuration:
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:8080;  # Frontend Docker container
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://localhost:3001;  # Backend Docker container
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# For complete SSL configuration, see nginx-host.conf template

# Enable site
sudo ln -s /etc/nginx/sites-available/instagram-dashboard /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Obtain SSL certificate
sudo certbot --nginx -d yourdomain.com
```

### Step 5: Setup Auto-Start on Boot

Docker Compose with `restart: unless-stopped` automatically restarts containers on boot.

Verify:
```bash
# Restart VPS
sudo reboot

# After reboot, check containers
docker-compose ps
```

---

## 🔧 Troubleshooting

### Check Container Status

```bash
# View all containers
docker-compose ps

# View logs for all services
docker-compose logs

# View logs for specific service
docker-compose logs frontend
docker-compose logs backend

# Follow logs in real-time
docker-compose logs -f backend
```

### Common Issues

#### 1. Frontend Build Fails

**Error**: `VITE environment variables not found`

**Solution**:
```bash
# Ensure .env.production has all VITE_ variables
grep "VITE_" .env.production

# Rebuild with no cache
docker-compose build --no-cache frontend
```

#### 2. Backend Cannot Connect to Supabase

**Error**: `Connection refused` or `Cannot reach Supabase`

**Solution**:
```bash
# Check Supabase URL in .env.production
grep "SUPABASE_URL" .env.production

# Test connection from container
docker-compose exec backend curl https://uromexjprcrjfmhkmgxa.supabase.co

# Check backend logs
docker-compose logs backend | grep -i supabase
```

#### 3. Port Already in Use

**Error**: `port is already allocated`

**Solution**:
```bash
# Find what's using the port
sudo lsof -i :8080  # Frontend Docker container
sudo lsof -i :3001  # Backend Docker container
sudo lsof -i :80    # Host Nginx (if using SSL)

# Stop the conflicting service or change port in docker-compose.yml
sudo systemctl stop nginx  # If host nginx conflicts
```

#### 4. Container Keeps Restarting

**Solution**:
```bash
# Check logs for error details
docker-compose logs backend

# Common causes:
# - Missing environment variables
# - Database connection issues
# - Invalid configuration

# Check container exit code
docker-compose ps
```

#### 5. Health Check Failing

**Solution**:
```bash
# Test health endpoint manually
curl http://localhost:3001/health

# Check if backend is listening
docker-compose exec backend netstat -tuln | grep 3001

# View detailed logs
docker-compose logs backend
```

### Reset Everything

```bash
# Stop and remove all containers, networks, volumes
docker-compose down -v

# Remove all images
docker-compose down --rmi all

# Rebuild from scratch
docker-compose build --no-cache
docker-compose up -d
```

---

## 🔄 Maintenance

### Update Application

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### View Logs

```bash
# Real-time logs for all services
docker-compose logs -f

# Last 100 lines from backend
docker-compose logs --tail=100 backend

# Save logs to file
docker-compose logs > docker-logs.txt
```

### Backup Strategy

#### Backup Environment Configuration

```bash
# Backup .env.production (contains secrets - keep secure)
cp .env.production .env.production.backup
```

#### Backup Docker Volumes

```bash
# Backup backend logs
tar -czf backend-logs-backup.tar.gz backend.api/logs/
```

### Monitor Resource Usage

```bash
# View container stats (CPU, memory, network)
docker stats

# Specific container
docker stats instagram-backend
```

### Clean Up Docker Resources

```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove all unused resources
docker system prune -a
```

---

## 🏛️ Architecture

### Container Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        VPS Server                        │
│                                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │          Docker Network: instagram-network       │   │
│  │                                                   │   │
│  │  ┌────────────────────┐  ┌──────────────────┐  │   │
│  │  │  Frontend Container│  │ Backend Container │  │   │
│  │  │  (Nginx + React)   │  │ (Node.js/Express)│  │   │
│  │  │                    │  │                   │  │   │
│  │  │  Port: 80          │  │  Port: 3001       │  │   │
│  │  │  Image: nginx:1.25 │  │  Image: node:18   │  │   │
│  │  │                    │  │                   │  │   │
│  │  │  Resources:        │  │  Resources:       │  │   │
│  │  │  - CPU: 0.5        │  │  - CPU: 1.0       │  │   │
│  │  │  - RAM: 512MB      │  │  - RAM: 1GB       │  │   │
│  │  └────────┬───────────┘  └────────┬──────────┘  │   │
│  │           │                       │              │   │
│  │           └───────────┬───────────┘              │   │
│  │                       │                          │   │
│  └───────────────────────┼──────────────────────────┘   │
│                          │                               │
│  ┌───────────────────────┼──────────────────────────┐   │
│  │       Host Volumes    │                          │   │
│  │  - backend.api/logs ←─┘                          │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          │
                          ├─→ External: Supabase (Database)
                          ├─→ External: Meta Graph API
                          └─→ External: N8N Webhooks
```

### Build Process

#### Frontend (Multi-stage Build)

```
Stage 1: Builder (node:18-alpine)
  ├─ Install dependencies (npm ci)
  ├─ Copy source code
  ├─ Inject VITE_ environment variables
  ├─ Build with Vite (npm run build)
  └─ Output: /app/dist/

Stage 2: Production (nginx:1.25-alpine)
  ├─ Copy built assets from Stage 1
  ├─ Copy nginx.conf
  ├─ Configure health checks
  └─ Serve on port 80
```

#### Backend (Single-stage Build)

```
Production (node:18-alpine)
  ├─ Install production dependencies only
  ├─ Copy application code
  ├─ Create non-root user for security
  ├─ Expose port 3001
  └─ Run: node server.js
```

### File Structure

```
instagram-automation-dashboard/
├── Dockerfile                    # Frontend Dockerfile (multi-stage)
├── nginx.conf                    # Nginx configuration for SPA routing
├── .dockerignore                 # Frontend build exclusions
├── docker-compose.yml            # Orchestration configuration
├── .env.production               # Production environment variables
│
├── backend.api/
│   ├── Dockerfile                # Backend Dockerfile
│   ├── .dockerignore             # Backend build exclusions
│   ├── server.js                 # Express server entry point
│   ├── package.json              # Backend dependencies
│   └── logs/                     # Volume-mounted logs directory
│
├── src/                          # Frontend source code
├── public/                       # Static assets
└── dist/                         # Built frontend (created during build)
```

### Network Configuration

- **Bridge Network**: `instagram-network` (subnet: 172.20.0.0/16)
- **Internal Communication**: Backend accessible at `http://backend:3001` from frontend
- **External Access**:
  - Frontend: `http://your-vps-ip:80`
  - Backend API: `http://your-vps-ip:3001`

### Health Checks

#### Frontend Health Check
- **Endpoint**: `http://localhost/health`
- **Interval**: 30s
- **Timeout**: 5s
- **Retries**: 3

#### Backend Health Check
- **Endpoint**: `http://localhost:3001/health`
- **Interval**: 30s
- **Timeout**: 10s
- **Retries**: 3
- **Start Period**: 30s (allows time for server initialization)

---

## 📊 Resource Limits

### Default Limits (Configurable in docker-compose.yml)

| Service  | CPU Limit | CPU Reserved | Memory Limit | Memory Reserved |
|----------|-----------|--------------|--------------|-----------------|
| Frontend | 0.5 cores | 0.25 cores   | 512 MB       | 256 MB          |
| Backend  | 1.0 cores | 0.5 cores    | 1 GB         | 512 MB          |

### Adjust for Your VPS

For a VPS with **2GB RAM / 2 CPU cores**:
```yaml
# In docker-compose.yml
deploy:
  resources:
    limits:
      cpus: '0.75'      # Increase if needed
      memory: 1.5G      # Increase if needed
```

---

## 🔐 Security Checklist

- ✅ Use strong, unique values for `JWT_SECRET` and `ENCRYPTION_KEY`
- ✅ Change default admin credentials in `.env.production`
- ✅ Keep `.env.production` out of version control
- ✅ Use HTTPS in production (SSL certificate via Let's Encrypt)
- ✅ Configure firewall (UFW) to allow only necessary ports
- ✅ Run containers as non-root user (already configured in backend Dockerfile)
- ✅ Regularly update Docker images (`docker-compose pull`)
- ✅ Monitor logs for suspicious activity
- ✅ Keep VPS system updated (`sudo apt update && sudo apt upgrade`)

---

## 📞 Support & Additional Resources

- **Docker Documentation**: https://docs.docker.com
- **Docker Compose**: https://docs.docker.com/compose/
- **Nginx Documentation**: https://nginx.org/en/docs/
- **Meta Developer Docs**: https://developers.facebook.com
- **Supabase Docs**: https://supabase.com/docs

---

## 🎓 Next Steps

1. **Test Locally**: Build and run on your development machine first
2. **Deploy to VPS**: Follow the production deployment guide
3. **Configure SSL**: Set up HTTPS with Let's Encrypt
4. **Monitor**: Set up logging and monitoring
5. **Backup**: Implement regular backup strategy
6. **Scale**: Consider load balancing if traffic increases

---

**Last Updated**: 2026-01-30
**Docker Compose Version**: 3.9
**Node Version**: 18-alpine
**Nginx Version**: 1.25-alpine
