# Docker Deployment Guide

Guide for containerizing and deploying the Gilgal backend.

## Local Development with Docker

### Start Services

```bash
docker-compose up
```

This starts:
1. PostgreSQL database on port 5432
2. Gilgal API on port 3000

### Access Services

API: `http://localhost:3000`
PostgreSQL: `localhost:5432`

### View Logs

```bash
# All services
docker-compose logs -f

# Only API
docker-compose logs -f api

# Only PostgreSQL
docker-compose logs -f postgres
```

### Stop Services

```bash
docker-compose down
```

## Production Build

### Build Image

```bash
docker build -t gilgal-api:latest .
```

### Tag for Registry

```bash
# For Docker Hub
docker tag gilgal-api:latest your-username/gilgal-api:latest

# For AWS ECR
docker tag gilgal-api:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/gilgal-api:latest
```

### Push to Registry

```bash
# Docker Hub
docker push your-username/gilgal-api:latest

# AWS ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/gilgal-api:latest
```

## Docker Compose Configuration

The `docker-compose.yml` includes:

### PostgreSQL Service

```yaml
postgres:
  image: postgres:15-alpine
  environment:
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
    POSTGRES_DB: gilgal_dev
  volumes:
    - postgres_data:/var/lib/postgresql/data
  healthcheck: Ensures database is ready before API starts
```

### API Service

```yaml
api:
  build: ./
  depends_on:
    postgres:
      condition: service_healthy
  environment:
    DATABASE_URL: postgresql://postgres:postgres@postgres:5432/gilgal_dev
    NODE_ENV: development
```

## Kubernetes Deployment

### Prerequisites

- Kubernetes cluster (EKS, GKE, AKS, etc.)
- kubectl configured
- Docker image pushed to registry

### Create Namespace

```bash
kubectl create namespace gilgal
```

### Create ConfigMap for Environment

```bash
kubectl create configmap gilgal-config \
  --from-literal=NODE_ENV=production \
  --from-literal=LOG_LEVEL=info \
  -n gilgal
```

### Create Secret for Sensitive Data

```bash
kubectl create secret generic gilgal-secrets \
  --from-literal=JWT_SECRET=your-secret-key \
  --from-literal=DB_PASSWORD=your-db-password \
  -n gilgal
```

### Create Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gilgal-api
  namespace: gilgal
spec:
  replicas: 3
  selector:
    matchLabels:
      app: gilgal-api
  template:
    metadata:
      labels:
        app: gilgal-api
    spec:
      containers:
      - name: api
        image: your-registry/gilgal-api:latest
        ports:
        - containerPort: 3000
        env:
        - name: PORT
          value: "3000"
        - name: DATABASE_URL
          value: postgresql://user:password@postgres:5432/gilgal_dev
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: gilgal-secrets
              key: JWT_SECRET
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

### Create Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: gilgal-api
  namespace: gilgal
spec:
  selector:
    app: gilgal-api
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 3000
```

### Deploy to Kubernetes

```bash
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
```

### Monitor Deployment

```bash
# Watch rollout
kubectl rollout status deployment/gilgal-api -n gilgal

# View pods
kubectl get pods -n gilgal

# View logs
kubectl logs -f deployment/gilgal-api -n gilgal

# Get service IP
kubectl get svc gilgal-api -n gilgal
```

## Environment Variables

Key variables for different environments:

### Development

```
NODE_ENV=development
LOG_LEVEL=debug
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/gilgal_dev
JWT_SECRET=dev-secret-key
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
```

### Production

```
NODE_ENV=production
LOG_LEVEL=info
DATABASE_URL=postgresql://user:password@prod-db.rds.amazonaws.com/gilgal_prod
JWT_SECRET=<generate-strong-secret>
CORS_ORIGIN=https://gilgal.example.com
```

## Health Checks

API provides health check endpoint:

```bash
GET /health
```

Response:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-15T10:30:00Z"
  },
  "message": "Service is healthy"
}
```

## Scaling

### Horizontal Scaling

Run multiple instances:
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Or with Kubernetes, adjust replicas:
```bash
kubectl scale deployment gilgal-api --replicas=5 -n gilgal
```

### Load Balancing

Use Nginx or cloud load balancer to distribute traffic across instances.

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker logs gilgal-api

# Inspect container
docker inspect gilgal-api
```

### Database Connection Failed

```bash
# Verify database is running
docker ps | grep postgres

# Check environment variables
docker exec gilgal-api env | grep DATABASE
```

### Out of Memory

```bash
# Increase memory limit in docker-compose.yml
memory: 1g
memswap: 1g
```

## Best Practices

1. **Use specific versions**: Alpine images are smaller
2. **Multi-stage builds**: Reduces final image size
3. **Non-root user**: Add to Dockerfile for security
4. **Environment variables**: Don't hardcode secrets
5. **Health checks**: Essential for orchestration
6. **Resource limits**: Prevent resource exhaustion
7. **Logging**: Structured logs for observability
8. **Security scanning**: Use tools like Trivy

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - name: Build Docker image
      run: docker build -t gilgal-api:${{ github.sha }} .
    - name: Push to registry
      run: docker push myregistry/gilgal-api:${{ github.sha }}
```

## Useful Commands

```bash
# Remove stopped containers
docker container prune

# Remove unused images
docker image prune

# View resource usage
docker stats

# Execute command in container
docker exec -it gilgal-api npm run db:migrate

# Copy file from container
docker cp gilgal-api:/app/logs/app.log ./
```
