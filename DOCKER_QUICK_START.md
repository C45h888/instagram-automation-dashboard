# 🚀 Quick Start - Docker Deployment

Fast deployment guide for getting your Instagram Automation Dashboard running on a VPS.

---

## ⚡ 5-Minute Setup

### 1. Prerequisites
- VPS with Ubuntu 22.04+ (2GB RAM, 2 CPU cores)
- Docker & Docker Compose installed
- Domain name (optional, for SSL)

### 2. Install Docker (if not installed)

```bash
# One-line Docker installation
curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh

# Add your user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version
```

### 3. Clone Repository

```bash
git clone <your-repository-url>
cd instagram-automation-dashboard
```

### 4. Configure Environment

```bash
# Edit .env.production
nano .env.production

# REQUIRED: Update these values:
# - VITE_META_APP_ID (replace YOUR_PRODUCTION_APP_ID)
# - VITE_META_APP_SECRET (replace YOUR_PRODUCTION_APP_SECRET)
# - ENCRYPTION_KEY (generate: openssl rand -hex 32)
# - JWT_SECRET (generate: openssl rand -base64 64)
# - BACKEND_STATIC_IP (your VPS IP address)
```

### 5. Deploy

```bash
# Option A: Use deployment script (recommended)
./deploy.sh

# Option B: Manual deployment
docker-compose build
docker-compose up -d
```

### 6. Verify

```bash
# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Access application
# Frontend: http://YOUR_VPS_IP:8080 (Docker container port)
# Backend: http://YOUR_VPS_IP:3001/health

# For production with SSL, see HETZNER_DEPLOYMENT.md
```

> **📖 Complete Production Setup**: For full Hetzner VPS deployment with Let's Encrypt SSL, see **[HETZNER_DEPLOYMENT.md](HETZNER_DEPLOYMENT.md)**

---

## 📁 Files Created

### Docker Configuration Files

| File | Purpose | Location |
|------|---------|----------|
| `Dockerfile` | Frontend build (Vite → Nginx) | Root directory |
| `backend.api/Dockerfile` | Backend build (Node.js) | backend.api/ |
| `docker-compose.yml` | Orchestration config | Root directory |
| `nginx.conf` | Nginx config for SPA routing | Root directory |
| `.dockerignore` | Frontend build exclusions | Root directory |
| `backend.api/.dockerignore` | Backend build exclusions | backend.api/ |

### Scripts & Documentation

| File | Purpose |
|------|---------|
| `deploy.sh` | Automated deployment script |
| `README.docker.md` | Complete Docker deployment guide |
| `DOCKER_QUICK_START.md` | This quick start guide |
| `HETZNER_DEPLOYMENT.md` | **Complete Hetzner VPS deployment with SSL** |
| `nginx-host.conf` | Host-level Nginx config template for SSL |

### Environment Configuration

| File | Purpose |
|------|---------|
| `.env.production` | Production environment variables (already exists) |

---

## 🛠️ Common Commands

```bash
# Deploy / Start
./deploy.sh                    # Deploy with cached builds
./deploy.sh --no-cache         # Deploy with fresh build
docker-compose up -d           # Start services

# Monitor
./deploy.sh --status           # Check status
./deploy.sh --logs             # View logs
docker-compose logs -f         # Follow logs

# Stop / Restart
./deploy.sh --stop             # Stop all containers
docker-compose restart         # Restart services
docker-compose restart backend # Restart specific service

# Update after code changes
git pull                       # Pull latest code
./deploy.sh --rebuild          # Rebuild and redeploy

# Clean up
docker-compose down            # Stop and remove containers
docker-compose down -v         # Also remove volumes
docker system prune -a         # Clean all unused resources
```

---

## 🔧 Troubleshooting Quick Fixes

### Frontend won't start
```bash
# Check logs
docker-compose logs frontend

# Verify environment variables
grep "VITE_" .env.production

# Rebuild
docker-compose build --no-cache frontend
docker-compose restart frontend
```

### Backend won't start
```bash
# Check logs
docker-compose logs backend

# Test Supabase connection
docker-compose exec backend curl https://uromexjprcrjfmhkmgxa.supabase.co

# Rebuild
docker-compose build --no-cache backend
docker-compose restart backend
```

### Port already in use
```bash
# Find what's using port 80
sudo lsof -i :80

# Stop nginx if it's running
sudo systemctl stop nginx

# Or change port in docker-compose.yml
```

### Can't access from browser
```bash
# Check firewall
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Check containers are running
docker-compose ps

# Check if nginx is listening
docker-compose exec frontend netstat -tuln | grep 80
```

---

## 🔐 Security Checklist

Before going to production:

- [ ] Update `ENCRYPTION_KEY` in .env.production
- [ ] Update `JWT_SECRET` in .env.production
- [ ] Update `ADMIN_PASSWORD` in .env.production
- [ ] Replace `VITE_META_APP_ID` and `VITE_META_APP_SECRET`
- [ ] Set `BACKEND_STATIC_IP` to your VPS IP
- [ ] Configure firewall (allow ports 22, 80, 443)
- [ ] Set up SSL certificate (Let's Encrypt)
- [ ] Never commit `.env.production` to Git

---

## 📊 Resource Usage

Expected resource usage:
- **Frontend**: 256-512 MB RAM, 0.25-0.5 CPU
- **Backend**: 512 MB-1 GB RAM, 0.5-1.0 CPU
- **Total**: ~1-2 GB RAM, 1-2 CPU cores

For VPS with limited resources, adjust limits in [docker-compose.yml](docker-compose.yml):
```yaml
deploy:
  resources:
    limits:
      memory: 512M  # Reduce if needed
```

---

## 🌐 Setup SSL (Production)

> **📖 Complete SSL Guide**: For detailed step-by-step SSL setup, see **[HETZNER_DEPLOYMENT.md](HETZNER_DEPLOYMENT.md#setup-lets-encrypt-ssl)**

### Quick SSL Setup with Let's Encrypt

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx -y

# Install nginx on host
sudo apt install nginx -y

# Deploy the nginx configuration template
sudo cp nginx-host.conf /etc/nginx/sites-available/instagram-dashboard
sudo ln -s /etc/nginx/sites-available/instagram-dashboard /etc/nginx/sites-enabled/

# Get SSL certificates for your domains
sudo certbot certonly --nginx \
  -d your-domain.com \
  -d api.your-domain.com \
  --email your-email@example.com \
  --agree-tos

# Test nginx configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx

# Restart Docker containers
docker-compose up -d
```

**Note**: Frontend Docker container listens on port 8080, allowing host Nginx to handle SSL on ports 80/443.

---

## 📞 Need Help?

- **Full Documentation**: [README.docker.md](README.docker.md)
- **Check Logs**: `docker-compose logs -f`
- **Container Status**: `docker-compose ps`
- **Resource Usage**: `docker stats`

---

## ✅ Deployment Checklist

**Pre-deployment:**
- [ ] Docker installed
- [ ] .env.production configured
- [ ] Firewall configured
- [ ] Domain DNS pointed to VPS (if using domain)

**Deployment:**
- [ ] `./deploy.sh` completed successfully
- [ ] Containers are healthy (`docker-compose ps`)
- [ ] Frontend accessible (http://YOUR_IP:8080)
- [ ] Backend health check works (http://YOUR_IP:3001/health)

**Post-deployment:**
- [ ] SSL certificate installed (production)
- [ ] Test authentication flow
- [ ] Monitor logs for errors
- [ ] Set up automated backups

---

**Quick Command Reference**

```bash
# Deploy
./deploy.sh

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Restart
docker-compose restart

# Stop
docker-compose down

# Update
git pull && ./deploy.sh --rebuild
```

---

🎉 **You're ready to deploy!** Run `./deploy.sh` to get started.
