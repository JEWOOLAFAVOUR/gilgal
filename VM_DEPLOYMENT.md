## Virtual Machine Deployment Guide

Complete guide for deploying Gilgal PaaS platform to a virtual machine in production.

### Prerequisites

- Ubuntu 20.04 LTS or newer (recommended)
- Minimum 4GB RAM, 2 CPU cores
- 50GB+ storage for applications and Docker images
- SSH access to the VM
- Domain name (optional, for HTTPS)

### Infrastructure Setup

#### 1. System Updates

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install essential tools
sudo apt install -y curl wget git build-essential
```

#### 2. Docker Installation

```bash
# Install Docker
sudo apt install -y docker.io docker-compose

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group (to run without sudo)
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker-compose --version
```

#### 3. PostgreSQL Installation

```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo sudo -u postgres psql <<EOF
CREATE DATABASE gilgal_prod;
CREATE USER gilgal WITH PASSWORD 'your-secure-password';
ALTER ROLE gilgal SET client_encoding TO 'utf8';
ALTER ROLE gilgal SET default_transaction_isolation TO 'read committed';
ALTER ROLE gilgal SET default_transaction_deferrable TO on;
ALTER ROLE gilgal SET default_transaction_read_committed TO on;
GRANT ALL PRIVILEGES ON DATABASE gilgal_prod TO gilgal;
\q
EOF
```

#### 4. Node.js Installation

```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

### Application Deployment

#### 1. Clone Repository

```bash
# Create application directory
mkdir -p /opt/gilgal
cd /opt/gilgal

# Clone backend repository
git clone <repository-url> backend
cd backend
```

#### 2. Environment Configuration

```bash
# Copy environment file
cp .env.example .env

# Edit environment variables
nano .env
```

**Production .env settings:**

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://gilgal:your-secure-password@localhost:5432/gilgal_prod
JWT_SECRET=generate-a-long-random-secret-key
LOG_LEVEL=info
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com
```

#### 3. Install Dependencies & Build

```bash
# Install dependencies
npm install

# Run migrations
npm run db:migrate

# Build TypeScript
npm run build

# Verify build
ls -la dist/
```

#### 4. Docker Containerization

```bash
# Build Docker image
docker build -t gilgal-api:latest .

# Tag for registry
docker tag gilgal-api:latest your-registry/gilgal-api:latest

# (Optional) Push to registry
docker push your-registry/gilgal-api:latest
```

#### 5. Run with Docker Compose

```bash
# Create docker-compose.prod.yml
cat > docker-compose.prod.yml <<'EOF'
version: '3.8'

services:
  api:
    image: gilgal-api:latest
    container_name: gilgal-api
    restart: always
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://gilgal:password@postgres:5432/gilgal_prod
      JWT_SECRET: your-secret-key
      PORT: 3000
    ports:
      - "3000:3000"
    depends_on:
      - postgres
    networks:
      - gilgal-network
    volumes:
      - ./logs:/app/logs

  postgres:
    image: postgres:15-alpine
    container_name: gilgal-postgres
    restart: always
    environment:
      POSTGRES_USER: gilgal
      POSTGRES_PASSWORD: your-secure-password
      POSTGRES_DB: gilgal_prod
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - gilgal-network

networks:
  gilgal-network:
    driver: bridge

volumes:
  postgres_data:
EOF

# Start services
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f api
```

### Reverse Proxy Setup (Nginx)

#### 1. Install Nginx

```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

#### 2. Configure Nginx

```bash
# Create nginx config
sudo tee /etc/nginx/sites-available/gilgal <<'EOF'
upstream gilgal_api {
    server localhost:3000;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL certificates (use Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;

    # API proxy
    location /api/ {
        proxy_pass http://gilgal_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check
    location /health {
        proxy_pass http://gilgal_api;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/gilgal /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Test nginx config
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

#### 3. SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot certonly --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal
sudo systemctl enable certbot.timer
```

### Monitoring & Logging

#### 1. Container Logs

```bash
# View logs
docker-compose -f docker-compose.prod.yml logs -f api

# Save logs to file
docker-compose -f docker-compose.prod.yml logs api > /var/log/gilgal-api.log
```

#### 2. System Monitoring

```bash
# Install htop for monitoring
sudo apt install -y htop
htop

# Check disk space
df -h

# Check Docker resource usage
docker stats

# Check database connections
sudo -u postgres psql -d gilgal_prod -c "SELECT datname, usename, count(*) FROM pg_stat_activity GROUP BY datname, usename;"
```

#### 3. Log Aggregation

```bash
# Create log directory with rotation
sudo mkdir -p /var/log/gilgal
sudo chown $USER:$USER /var/log/gilgal

# Configure logrotate
sudo tee /etc/logrotate.d/gilgal <<'EOF'
/var/log/gilgal/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        systemctl reload nginx > /dev/null 2>&1 || true
    endscript
}
EOF
```

### Backup Strategy

#### 1. Database Backup

```bash
# Create backup directory
mkdir -p /backups/database
chmod 700 /backups/database

# Automated daily backup
sudo tee /etc/cron.daily/gilgal-backup <<'EOF'
#!/bin/bash
BACKUP_DIR="/backups/database"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker-compose -f /opt/gilgal/backend/docker-compose.prod.yml exec -T postgres pg_dump -U gilgal gilgal_prod > $BACKUP_DIR/gilgal_$TIMESTAMP.sql
gzip $BACKUP_DIR/gilgal_$TIMESTAMP.sql
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
EOF

chmod +x /etc/cron.daily/gilgal-backup
```

#### 2. Docker Image Backup

```bash
# Save Docker image to tar
docker save gilgal-api:latest -o /backups/gilgal-api-latest.tar.gz

# Restore from backup
docker load -i /backups/gilgal-api-latest.tar.gz
```

### Maintenance

#### 1. Database Maintenance

```bash
# Connect to database
docker-compose -f docker-compose.prod.yml exec postgres psql -U gilgal -d gilgal_prod

# Inside psql:
VACUUM ANALYZE;  -- Optimize database
```

#### 2. Docker Cleanup

```bash
# Remove unused images and containers
docker system prune -a

# Remove unused volumes
docker volume prune
```

#### 3. Update Application

```bash
cd /opt/gilgal/backend

# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.prod.yml down
docker build -t gilgal-api:latest .
docker-compose -f docker-compose.prod.yml up -d
```

### Security Best Practices

1. **Firewall Configuration**
```bash
sudo ufw enable
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

2. **SSH Hardening**
```bash
# Edit SSH config
sudo nano /etc/ssh/sshd_config

# Settings to apply:
# PermitRootLogin no
# PasswordAuthentication no
# X11Forwarding no

# Restart SSH
sudo systemctl restart ssh
```

3. **Environment Security**
- Use `.env.prod` for production secrets
- Rotate JWT_SECRET regularly
- Use strong database password
- Enable database SSL connections

4. **Regular Updates**
```bash
# Keep system updated
sudo apt update && sudo apt upgrade -y

# Check security patches
sudo apt list --upgradable
```

### Performance Optimization

#### 1. Database Connection Pooling

Enable in Node.js app - already configured in `database/index.ts`

#### 2. Caching Headers

Configured in Nginx for static assets (if added)

#### 3. Resource Limits

```yaml
# Add to docker-compose.prod.yml under api service:
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G
    reservations:
      cpus: '1'
      memory: 1G
```

### Troubleshooting

#### API not responding

```bash
# Check if container is running
docker ps | grep gilgal-api

# Check logs
docker logs gilgal-api

# Restart container
docker-compose -f docker-compose.prod.yml restart api
```

#### Database connection issues

```bash
# Check if postgres container is running
docker ps | grep postgres

# Check database logs
docker logs gilgal-postgres

# Verify connection
docker exec gilgal-postgres psql -U gilgal -d gilgal_prod -c "SELECT NOW();"
```

#### Nginx 502 Bad Gateway

```bash
# Check nginx logs
sudo tail -f /var/log/nginx/error.log

# Verify backend is running
curl http://localhost:3000/health

# Check nginx config
sudo nginx -t
```

### Scaling Considerations

- **Horizontal Scaling**: Use load balancer (HAProxy/AWS ELB)
- **Database Scaling**: Implement read replicas for production
- **Docker Registry**: Store images in private registry
- **Container Orchestration**: Consider Kubernetes for larger deployments

### Useful Commands

```bash
# View all containers
docker ps -a

# Execute command in container
docker exec -it gilgal-api npm run db:migrate

# Remove container
docker rm container_id

# View Docker disk usage
docker system df

# Prune everything
docker system prune -a --volumes
```
