# 🚀 Hetzner VPS Manual Deployment Guide
# Instagram Automation Dashboard

Complete step-by-step guide for deploying your Instagram Automation Dashboard on Hetzner VPS with Docker and Let's Encrypt SSL.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [VPS Initial Setup](#vps-initial-setup)
3. [Install Required Software](#install-required-software)
4. [Configure DNS](#configure-dns)
5. [Deploy Application](#deploy-application)
6. [Setup Let's Encrypt SSL](#setup-lets-encrypt-ssl)
7. [Configure Supabase](#configure-supabase)
8. [Post-Deployment](#post-deployment)
9. [Monitoring & Maintenance](#monitoring--maintenance)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 Prerequisites

### Required Accounts & Services

- ✅ **Hetzner Account** - [Sign up](https://accounts.hetzner.com/signUp)
- ✅ **Domain Name** - Registered and accessible
- ✅ **Supabase Project** - Already set up with database
- ✅ **Meta Developer Account** - With app configured
- ✅ **SSH Key** - For secure VPS access

### Local Requirements

- Git installed
- SSH client
- Text editor
- Terminal/command line access

### Domain Names You'll Need

- `888intelligenceautomation.in` (main frontend)
- `api.888intelligenceautomation.in` (backend API)

---

## 🖥️ VPS Initial Setup

### Step 1: Create Hetzner VPS

1. **Login to Hetzner Cloud Console**
   - Navigate to: https://console.hetzner.cloud

2. **Create New Project**
   - Click "New Project"
   - Name: `instagram-automation`

3. **Create Server**
   - Click "Add Server"
   - **Location**: Choose closest to your users (e.g., Nuremberg, Germany)
   - **OS**: Ubuntu 22.04 LTS
   - **Type**: Recommended minimum:
     - **CX21**: 2 vCPU, 4GB RAM, 40GB SSD (€4.79/month)
     - **CX31**: 2 vCPU, 8GB RAM, 80GB SSD (€9.49/month) if higher traffic expected
   - **SSH Keys**: Add your public SSH key
   - **Volumes**: None needed (40GB is sufficient)
   - **Networking**:
     - Enable IPv4 & IPv6
     - No private network needed initially
   - **Firewall**: Configure later
   - **Name**: `instagram-automation-prod`

4. **Note Important Information**
   ```
   Server IP: [YOUR_VPS_IP]  ← Save this!
   Server Name: instagram-automation-prod
   SSH Key: [Your key name]
   ```

### Step 2: Initial SSH Connection

```bash
# Connect to your VPS
ssh root@YOUR_VPS_IP

# You should see Ubuntu welcome message
# Example: Welcome to Ubuntu 22.04.3 LTS
```

### Step 3: Secure Your VPS

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Create a non-root user with sudo privileges
sudo adduser deploy
sudo usermod -aG sudo deploy

# Add your SSH key to the new user
sudo mkdir -p /home/deploy/.ssh
sudo cp ~/.ssh/authorized_keys /home/deploy/.ssh/
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys

# Test SSH access with new user (in new terminal)
ssh deploy@YOUR_VPS_IP

# If successful, disable root SSH login (optional but recommended)
sudo nano /etc/ssh/sshd_config
# Find and change: PermitRootLogin no
# Save and exit (Ctrl+X, Y, Enter)
sudo systemctl restart sshd
```

### Step 4: Configure Firewall

```bash
# Enable UFW firewall
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

**Expected Output:**
```
Status: active

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere                   # SSH
80/tcp                     ALLOW       Anywhere                   # HTTP
443/tcp                    ALLOW       Anywhere                   # HTTPS
```

---

## 🔧 Install Required Software

### Step 1: Install Docker

```bash
# Install Docker using official script
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group
sudo usermod -aG docker deploy

# Apply group changes (logout and login, or use newgrp)
newgrp docker

# Verify Docker installation
docker --version
# Expected: Docker version 24.x.x or higher

# Test Docker
docker run hello-world
```

### Step 2: Install Docker Compose

Docker Compose v2 is included with Docker Desktop, but on Linux:

```bash
# Docker Compose v2 is usually included, verify:
docker compose version
# Expected: Docker Compose version v2.x.x

# If not installed, install manually:
sudo apt-get update
sudo apt-get install docker-compose-plugin
```

### Step 3: Install Nginx (Host-level)

```bash
# Install Nginx
sudo apt install nginx -y

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Check status
sudo systemctl status nginx
```

### Step 4: Install Certbot for Let's Encrypt

```bash
# Install Certbot and Nginx plugin
sudo apt install certbot python3-certbot-nginx -y

# Verify installation
certbot --version
```

### Step 5: Install Git

```bash
# Install Git
sudo apt install git -y

# Verify
git --version
```

### Step 6: Install Additional Utilities

```bash
# Install useful tools
sudo apt install -y curl wget htop vim nano net-tools

# Optional: Install fail2ban for security
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## 🌐 Configure DNS

### Step 1: Get Your VPS IP

```bash
# On your VPS
curl ifconfig.me

# Note this IP address
```

### Step 2: Update DNS A Records

Login to your domain registrar's DNS management panel and add these records:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | YOUR_VPS_IP | 3600 |
| A | api | YOUR_VPS_IP | 3600 |
| A | www | YOUR_VPS_IP | 3600 |

**Example for 888intelligenceautomation.in:**
```
A     @     123.45.67.89    3600   (points 888intelligenceautomation.in)
A     api   123.45.67.89    3600   (points api.888intelligenceautomation.in)
A     www   123.45.67.89    3600   (points www.888intelligenceautomation.in)
```

### Step 3: Verify DNS Propagation

```bash
# Check DNS resolution (may take 5-30 minutes)
nslookup 888intelligenceautomation.in
nslookup api.888intelligenceautomation.in

# Or use dig
dig 888intelligenceautomation.in +short
dig api.888intelligenceautomation.in +short

# Both should return YOUR_VPS_IP
```

**Wait for DNS propagation before proceeding to SSL setup!**

---

## 📦 Deploy Application

### Step 1: Clone Repository

```bash
# Navigate to home directory
cd ~

# Clone your repository
git clone https://github.com/YOUR_USERNAME/instagram-automation-dashboard.git

# Or if using SSH
git clone git@github.com:YOUR_USERNAME/instagram-automation-dashboard.git

# Navigate to project directory
cd instagram-automation-dashboard
```

### Step 2: Configure Environment Variables

```bash
# Copy and edit .env.production
nano .env.production
```

**Critical Variables to Update:**

```bash
# ===========================
# MUST UPDATE THESE:
# ===========================

# Your VPS Static IP
BACKEND_STATIC_IP=YOUR_VPS_IP  # e.g., 123.45.67.89

# Disable Fixie Proxy (use direct VPS IP)
USE_FIXIE_PROXY=false

# Generate new encryption key
ENCRYPTION_KEY=  # Run: openssl rand -hex 32

# Generate new JWT secret
JWT_SECRET=  # Run: openssl rand -base64 64

# Admin credentials (change from default)
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=YourSecurePassword123!

# Meta App credentials (if not already set)
VITE_META_APP_ID=your-production-app-id
VITE_META_APP_SECRET=your-production-app-secret

# Verify URLs are correct
VITE_API_URL=https://api.888intelligenceautomation.in
VITE_API_BASE_URL=https://api.888intelligenceautomation.in
VITE_WEBHOOK_URL=https://api.888intelligenceautomation.in
FRONTEND_URL=https://888intelligenceautomation.in
```

**Generate Secure Keys:**

```bash
# Generate encryption key (64-character hex)
openssl rand -hex 32

# Generate JWT secret
openssl rand -base64 64

# Generate webhook verify token
openssl rand -hex 32
```

### Step 3: Build Docker Images

```bash
# Build all images (takes 5-10 minutes on first build)
docker compose build

# Check for any build errors
echo $?  # Should output: 0
```

### Step 4: Start Docker Containers (HTTP Only - Testing)

```bash
# Start containers
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f
```

**Expected Output:**
```
NAME                   STATUS          PORTS
instagram-backend      Up (healthy)    0.0.0.0:3001->3001/tcp
instagram-frontend     Up (healthy)    0.0.0.0:8080->80/tcp
```

### Step 5: Test HTTP Access

```bash
# Test backend health check
curl http://localhost:3001/health

# Test frontend (from browser)
# Open: http://YOUR_VPS_IP:8080
```

---

## 🔒 Setup Let's Encrypt SSL

### Step 1: Stop Docker Frontend Temporarily

```bash
# Stop containers to free port 80 for certbot
docker compose stop frontend
```

### Step 2: Create Certbot Webroot Directory

```bash
# Create directory for ACME challenges
sudo mkdir -p /var/www/certbot
sudo chown -R www-data:www-data /var/www/certbot
```

### Step 3: Obtain SSL Certificates

```bash
# Obtain certificate for main domain
sudo certbot certonly --nginx \
  -d 888intelligenceautomation.in \
  -d www.888intelligenceautomation.in \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email

# Obtain certificate for API subdomain
sudo certbot certonly --nginx \
  -d api.888intelligenceautomation.in \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email
```

**Expected Output:**
```
Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/888intelligenceautomation.in/fullchain.pem
Key is saved at: /etc/letsencrypt/live/888intelligenceautomation.in/privkey.pem
```

### Step 4: Configure Nginx with SSL

```bash
# Copy the host nginx configuration template
sudo cp nginx-host.conf /etc/nginx/sites-available/instagram-dashboard

# Create symlink to enable site
sudo ln -s /etc/nginx/sites-available/instagram-dashboard /etc/nginx/sites-enabled/

# Remove default nginx site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test nginx configuration
sudo nginx -t
```

**Expected Output:**
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### Step 5: Restart Services

```bash
# Reload Nginx
sudo systemctl reload nginx

# Restart Docker containers
docker compose up -d
```

### Step 6: Configure Auto-Renewal

```bash
# Certbot auto-renewal is configured via systemd timer
sudo systemctl status certbot.timer

# Test renewal (dry run)
sudo certbot renew --dry-run
```

**Expected Output:**
```
Congratulations, all simulated renewals succeeded
```

### Step 7: Verify HTTPS Access

```bash
# Test from command line
curl -I https://888intelligenceautomation.in
curl -I https://api.888intelligenceautomation.in

# Open in browser:
# https://888intelligenceautomation.in
# https://api.888intelligenceautomation.in/health
```

---

## 🗄️ Configure Supabase

### Step 1: Get Your VPS Static IP

```bash
# Confirm your static IP
curl ifconfig.me
```

### Step 2: Whitelist IP in Supabase

1. **Login to Supabase Dashboard**
   - Navigate to: https://app.supabase.com

2. **Select Your Project**
   - Click on your project: `Instagram Automation`

3. **Navigate to Security Settings**
   - Settings → Security → IP Restrictions

4. **Add Your VPS IP**
   - Click "Add IP Address"
   - Enter your VPS IP: `YOUR_VPS_IP`
   - Description: `Hetzner Production VPS`
   - Click "Save"

### Step 3: Test Database Connection

```bash
# Test from VPS
docker compose exec backend node -e "
const supabase = require('./config/supabase');
supabase.checkHealth().then(result => {
  console.log('Database connection:', result ? 'SUCCESS' : 'FAILED');
  process.exit(result ? 0 : 1);
});
"
```

**Expected Output:**
```
Database connection: SUCCESS
```

---

## ✅ Post-Deployment

### Step 1: Verify All Services

```bash
# Check Docker containers
docker compose ps

# Check Nginx
sudo systemctl status nginx

# Check SSL certificates
sudo certbot certificates
```

### Step 2: Test Application Features

**Frontend Tests:**
- ✅ Access https://888intelligenceautomation.in
- ✅ Login page loads
- ✅ SSL certificate is valid (padlock icon)

**Backend API Tests:**
```bash
# Health check
curl https://api.888intelligenceautomation.in/health

# Should return: {"status":"healthy"}
```

**Webhook Tests:**
- ✅ Configure Meta webhook: `https://api.888intelligenceautomation.in/webhook/instagram`
- ✅ Send test event from Meta Developer Console
- ✅ Check logs: `docker compose logs backend | grep webhook`

### Step 3: Configure Meta Developer Console

1. **Update Webhook URL**
   - Meta Developer Console → Your App → Webhooks
   - Callback URL: `https://api.888intelligenceautomation.in/webhook/instagram`
   - Verify Token: (from your .env.production `WEBHOOK_VERIFY_TOKEN`)
   - Click "Verify and Save"

2. **Update OAuth Redirect URIs**
   - Meta Developer Console → Your App → Settings → Basic
   - Valid OAuth Redirect URIs:
     - `https://888intelligenceautomation.in/auth/callback`
     - `https://api.888intelligenceautomation.in/auth/callback`
   - Save changes

### Step 4: Setup Monitoring

```bash
# Install monitoring script (optional)
# Create uptime monitoring script
nano ~/monitor.sh
```

**monitor.sh:**
```bash
#!/bin/bash
# Simple monitoring script

# Check Docker containers
if [ $(docker compose ps -q | wc -l) -eq 2 ]; then
    echo "✓ All containers running"
else
    echo "✗ Container issue detected"
    docker compose ps
fi

# Check Nginx
if systemctl is-active --quiet nginx; then
    echo "✓ Nginx is running"
else
    echo "✗ Nginx is not running"
fi

# Check disk space
df -h | grep -E '^/dev/'
```

```bash
# Make executable
chmod +x ~/monitor.sh

# Run manually or add to crontab
./monitor.sh
```

### Step 5: Setup Automated Backups

```bash
# Create backup script
nano ~/backup.sh
```

**backup.sh:**
```bash
#!/bin/bash
BACKUP_DIR="$HOME/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup environment file
cp ~/instagram-automation-dashboard/.env.production \
   $BACKUP_DIR/env_$DATE.backup

# Backup logs
tar -czf $BACKUP_DIR/logs_$DATE.tar.gz \
   ~/instagram-automation-dashboard/backend.api/logs/

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.backup" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

```bash
# Make executable
chmod +x ~/backup.sh

# Add to crontab (daily at 2 AM)
crontab -e

# Add this line:
0 2 * * * /home/deploy/backup.sh >> /home/deploy/backup.log 2>&1
```

---

## 📊 Monitoring & Maintenance

### Daily Checks

```bash
# Check container status
docker compose ps

# Check logs
docker compose logs --tail=50

# Check disk usage
df -h

# Check memory usage
free -h

# Check recent errors
docker compose logs backend | grep -i error | tail -20
```

### Weekly Maintenance

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Clean Docker images
docker system prune -af --volumes

# Check SSL certificate expiration
sudo certbot certificates
```

### Update Application

```bash
# Navigate to project directory
cd ~/instagram-automation-dashboard

# Pull latest code
git pull

# Rebuild containers
docker compose down
docker compose build --no-cache
docker compose up -d

# Verify
docker compose ps
docker compose logs -f
```

### View Logs

```bash
# Real-time logs (all services)
docker compose logs -f

# Backend only
docker compose logs -f backend

# Frontend only
docker compose logs -f frontend

# Last 100 lines
docker compose logs --tail=100

# Save logs to file
docker compose logs > logs_$(date +%Y%m%d).txt
```

---

## 🔧 Troubleshooting

### Issue 1: DNS Not Resolving

**Symptoms:**
- Domain doesn't resolve to VPS IP
- Certificate generation fails with DNS error

**Solution:**
```bash
# Check DNS propagation
dig 888intelligenceautomation.in +short

# If not showing your IP, wait longer (up to 24 hours)
# Or check your DNS provider settings
```

### Issue 2: Port 80 Already in Use

**Symptoms:**
- `nginx: [emerg] bind() to 0.0.0.0:80 failed (98: Address already in use)`

**Solution:**
```bash
# Find what's using port 80
sudo lsof -i :80

# If it's Apache, stop it
sudo systemctl stop apache2
sudo systemctl disable apache2

# Restart Nginx
sudo systemctl restart nginx
```

### Issue 3: Docker Containers Won't Start

**Symptoms:**
- `docker compose up` fails
- Containers immediately exit

**Solution:**
```bash
# Check logs
docker compose logs

# Check environment variables
cat .env.production | grep -v "#" | grep "="

# Rebuild with no cache
docker compose build --no-cache
docker compose up
```

### Issue 4: SSL Certificate Not Obtained

**Symptoms:**
- `certbot` fails with error
- "Unable to verify domain"

**Solution:**
```bash
# Ensure DNS is propagated first
nslookup api.888intelligenceautomation.in

# Stop Nginx temporarily
sudo systemctl stop nginx

# Try standalone mode
sudo certbot certonly --standalone \
  -d api.888intelligenceautomation.in \
  --email your-email@example.com

# Restart Nginx
sudo systemctl start nginx
```

### Issue 5: Supabase Connection Fails

**Symptoms:**
- Database queries fail
- `Connection refused` errors

**Solution:**
```bash
# Verify IP is whitelisted on Supabase
curl ifconfig.me

# Check environment variable
docker compose exec backend env | grep SUPABASE_URL

# Test connection manually
docker compose exec backend node -e "
console.log(process.env.SUPABASE_URL);
"

# Check firewall allows outbound connections
sudo ufw status
```

### Issue 6: Frontend Shows 502 Bad Gateway

**Symptoms:**
- Nginx shows 502 error
- Frontend not accessible

**Solution:**
```bash
# Check if frontend container is running
docker compose ps frontend

# Check frontend logs
docker compose logs frontend

# Verify port 8080 is listening
netstat -tuln | grep 8080

# Restart frontend
docker compose restart frontend
```

### Issue 7: Meta Webhook Verification Fails

**Symptoms:**
- Meta webhook verification fails
- `Invalid verify token` error

**Solution:**
```bash
# Check webhook verify token matches
grep WEBHOOK_VERIFY_TOKEN .env.production

# Test webhook endpoint
curl -X GET "https://api.888intelligenceautomation.in/webhook/instagram?hub.mode=subscribe&hub.challenge=test&hub.verify_token=YOUR_TOKEN"

# Should return: test
```

### Issue 8: High Memory Usage

**Symptoms:**
- VPS running out of memory
- Containers being killed

**Solution:**
```bash
# Check memory usage
free -h
docker stats

# Restart containers
docker compose restart

# If persistent, upgrade VPS plan or reduce resource limits in docker-compose.yml
```

---

## 📞 Support & Resources

### Documentation
- **Main Docker Guide**: [README.docker.md](README.docker.md)
- **Quick Start**: [DOCKER_QUICK_START.md](DOCKER_QUICK_START.md)
- **Deployment Plan**: [.claude/plans/reactive-cooking-pie.md](.claude/plans/reactive-cooking-pie.md)

### External Resources
- **Hetzner Docs**: https://docs.hetzner.com
- **Docker Docs**: https://docs.docker.com
- **Let's Encrypt**: https://letsencrypt.org/docs/
- **Nginx Docs**: https://nginx.org/en/docs/
- **Supabase Docs**: https://supabase.com/docs

### Common Commands Reference

```bash
# Docker
docker compose up -d          # Start containers
docker compose down           # Stop containers
docker compose logs -f        # View logs
docker compose ps             # Check status
docker compose restart        # Restart all
docker system prune -af       # Clean up

# Nginx
sudo nginx -t                 # Test config
sudo systemctl reload nginx   # Reload config
sudo systemctl restart nginx  # Restart Nginx
sudo tail -f /var/log/nginx/error.log  # View errors

# SSL
sudo certbot certificates     # List certificates
sudo certbot renew           # Renew certificates
sudo certbot renew --dry-run # Test renewal

# System
sudo ufw status              # Check firewall
sudo systemctl status nginx  # Check Nginx
df -h                        # Check disk
free -h                      # Check memory
htop                         # Monitor processes
```

---

## ✅ Deployment Checklist

Use this checklist to ensure everything is configured correctly:

### Pre-Deployment
- [ ] Hetzner VPS created (CX21 or higher)
- [ ] SSH key added and tested
- [ ] Domain DNS A records configured
- [ ] DNS propagation verified (may take 24 hours)

### VPS Setup
- [ ] Firewall configured (ports 22, 80, 443)
- [ ] Non-root user created with sudo access
- [ ] Docker installed and tested
- [ ] Docker Compose installed
- [ ] Nginx installed
- [ ] Certbot installed
- [ ] Git installed

### Application Deployment
- [ ] Repository cloned
- [ ] .env.production configured
- [ ] `ENCRYPTION_KEY` generated and set
- [ ] `JWT_SECRET` generated and set
- [ ] `BACKEND_STATIC_IP` set to VPS IP
- [ ] `USE_FIXIE_PROXY=false` set
- [ ] Docker images built successfully
- [ ] Containers started and healthy

### SSL Configuration
- [ ] SSL certificates obtained for both domains
- [ ] nginx-host.conf deployed to /etc/nginx/sites-available/
- [ ] Nginx configuration tested (`nginx -t`)
- [ ] Nginx reloaded
- [ ] HTTPS access verified

### External Services
- [ ] Supabase IP whitelist updated with VPS IP
- [ ] Database connection tested from VPS
- [ ] Meta webhook URL updated
- [ ] Meta OAuth redirect URIs updated
- [ ] Test webhook sent from Meta console

### Post-Deployment
- [ ] Frontend accessible via HTTPS
- [ ] Backend health check responding
- [ ] SSL certificates valid (A+ rating)
- [ ] Login functionality works
- [ ] Instagram authentication tested
- [ ] Monitoring setup (optional)
- [ ] Backup script configured (optional)

---

**🎉 Congratulations!** Your Instagram Automation Dashboard is now deployed on Hetzner VPS with Docker and Let's Encrypt SSL.

**Next Steps:**
- Monitor logs regularly
- Set up uptime monitoring (e.g., UptimeRobot)
- Configure automated backups
- Test all application features thoroughly

**Estimated Total Time:** 2-3 hours (including DNS propagation wait time)

**Cost:** ~€5-10/month (compared to $25-50/month on Render = 70% savings!)
