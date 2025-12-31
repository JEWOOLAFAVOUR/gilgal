## Gilgal API Documentation

Complete API reference for the Gilgal PaaS platform backend.

### Base URL
```
http://localhost:3000/api
```

### Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Response Format

All API responses follow a standard format:

**Success Response:**
```json
{
  "success": true,
  "data": { /* response data */ },
  "message": "Operation successful"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable error message"
}
```

---

## Authentication Endpoints

### Register User

```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "username",
  "password": "securepassword123",
  "fullName": "John Doe"
}
```

**Response:** 201 Created
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "username": "username",
      "fullName": "John Doe",
      "createdAt": "2025-12-30T10:00:00Z"
    },
    "accessToken": "eyJhbGc..."
  }
}
```

**Errors:**
- `VALIDATION_ERROR` - Missing required fields
- `WEAK_PASSWORD` - Password less than 8 characters
- `EMAIL_ALREADY_EXISTS` - Email already registered
- `USERNAME_ALREADY_EXISTS` - Username taken

---

### Login

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "username": "username"
    },
    "accessToken": "eyJhbGc..."
  }
}
```

**Errors:**
- `INVALID_CREDENTIALS` - Wrong email or password
- `USER_NOT_FOUND` - User doesn't exist

---

### Logout

```http
POST /auth/logout
Authorization: Bearer <token>
```

**Response:** 200 OK
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### Get Current User

```http
GET /auth/me
Authorization: Bearer <token>
```

**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "username",
    "fullName": "John Doe",
    "bio": "Developer",
    "createdAt": "2025-12-30T10:00:00Z"
  }
}
```

---

### Refresh Token

```http
POST /auth/refresh
Authorization: Bearer <token>
```

**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc..."
  }
}
```

---

## Project Endpoints

### List Projects

```http
GET /projects?page=1&limit=20
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (optional, default: 1) - Page number
- `limit` (optional, default: 20, max: 100) - Items per page

**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "My React App",
        "slug": "my-react-app",
        "description": "A beautiful React application",
        "framework": "react",
        "status": "active",
        "createdAt": "2025-12-30T10:00:00Z"
      }
    ],
    "total": 5,
    "page": 1,
    "limit": 20,
    "hasMore": false
  }
}
```

---

### Create Project

```http
POST /projects
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "My React App",
  "description": "A beautiful React application",
  "repositoryUrl": "https://github.com/user/repo",
  "framework": "react"
}
```

**Response:** 201 Created
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "My React App",
    "slug": "my-react-app",
    "framework": "react",
    "status": "inactive",
    "createdAt": "2025-12-30T10:00:00Z"
  },
  "message": "Project created successfully"
}
```

**Supported Frameworks:**
- react
- next.js
- vue.js
- svelte
- node.js
- express
- django
- flask
- laravel
- other

---

### Get Project

```http
GET /projects/:id
Authorization: Bearer <token>
```

**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "My React App",
    "slug": "my-react-app",
    "description": "A beautiful React application",
    "repositoryUrl": "https://github.com/user/repo",
    "framework": "react",
    "status": "active",
    "createdAt": "2025-12-30T10:00:00Z",
    "updatedAt": "2025-12-30T11:00:00Z"
  }
}
```

---

### Update Project

```http
PUT /projects/:id
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "Updated Name",
  "description": "Updated description",
  "repositoryUrl": "https://github.com/user/repo"
}
```

**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Updated Name",
    "description": "Updated description",
    "updatedAt": "2025-12-30T11:30:00Z"
  },
  "message": "Project updated successfully"
}
```

---

### Delete Project

```http
DELETE /projects/:id
Authorization: Bearer <token>
```

**Response:** 200 OK
```json
{
  "success": true,
  "message": "Project deleted successfully"
}
```

---

## Environment Endpoints

### List Environments

```http
GET /projects/:projectId/environments
Authorization: Bearer <token>
```

**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "projectId": "uuid",
        "name": "Production",
        "type": "production",
        "domain": "myapp.gilgal.dev",
        "environmentVariables": {
          "API_URL": "https://api.example.com",
          "NODE_ENV": "production"
        },
        "createdAt": "2025-12-30T10:00:00Z"
      }
    ],
    "total": 2
  }
}
```

---

### Create Environment

```http
POST /projects/:projectId/environments
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "Staging",
  "type": "staging",
  "domain": "staging.myapp.gilgal.dev",
  "environmentVariables": {
    "API_URL": "https://staging-api.example.com",
    "NODE_ENV": "staging"
  }
}
```

**Environment Types:**
- `production` - Production environment
- `staging` - Staging/Testing environment
- `development` - Development environment

**Response:** 201 Created
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "projectId": "uuid",
    "name": "Staging",
    "type": "staging",
    "domain": "staging.myapp.gilgal.dev",
    "environmentVariables": { ... },
    "createdAt": "2025-12-30T10:00:00Z"
  },
  "message": "Environment created successfully"
}
```

---

### Update Environment

```http
PUT /environments/:id
Content-Type: application/json
Authorization: Bearer <token>

{
  "environmentVariables": {
    "API_URL": "https://new-api.example.com"
  }
}
```

**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "environmentVariables": { ... },
    "updatedAt": "2025-12-30T11:00:00Z"
  },
  "message": "Environment updated successfully"
}
```

---

### Delete Environment

```http
DELETE /environments/:id
Authorization: Bearer <token>
```

**Response:** 200 OK
```json
{
  "success": true,
  "message": "Environment deleted successfully"
}
```

---

## Deployment Endpoints

### List Deployments

```http
GET /projects/:projectId/deployments?page=1&limit=20
Authorization: Bearer <token>
```

**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "projectId": "uuid",
        "environmentId": "uuid",
        "status": "success",
        "commitSha": "abc123def456",
        "commitMessage": "Fix: Auth bug",
        "durationSeconds": 245,
        "deployedAt": "2025-12-30T10:35:00Z",
        "containerId": "container-uuid",
        "createdAt": "2025-12-30T10:30:00Z"
      }
    ],
    "total": 15,
    "page": 1,
    "limit": 20,
    "hasMore": false
  }
}
```

---

### Create Deployment

```http
POST /projects/:projectId/deployments
Content-Type: application/json
Authorization: Bearer <token>

{
  "environmentId": "env-uuid",
  "commitSha": "abc123def456",
  "commitMessage": "Deploy feature X"
}
```

**Response:** 201 Created
```json
{
  "success": true,
  "data": {
    "id": "deployment-uuid",
    "projectId": "project-uuid",
    "environmentId": "env-uuid",
    "status": "pending",
    "commitSha": "abc123def456",
    "commitMessage": "Deploy feature X",
    "createdAt": "2025-12-30T10:30:00Z"
  },
  "message": "Deployment started"
}
```

**Status Values:**
- `pending` - Waiting to start
- `building` - Building Docker image
- `success` - Successfully deployed
- `failed` - Deployment failed

---

### Get Deployment

```http
GET /deployments/:id
Authorization: Bearer <token>
```

**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "projectId": "uuid",
    "environmentId": "uuid",
    "status": "success",
    "commitSha": "abc123def456",
    "durationSeconds": 245,
    "deployedAt": "2025-12-30T10:35:00Z",
    "containerId": "container-uuid",
    "createdAt": "2025-12-30T10:30:00Z"
  }
}
```

---

### Get Deployment Logs

```http
GET /deployments/:id/logs
Authorization: Bearer <token>
```

**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "deploymentId": "uuid",
        "logLevel": "info",
        "message": "Starting deployment pipeline...",
        "timestamp": "2025-12-30T10:30:00Z"
      },
      {
        "id": "uuid",
        "deploymentId": "uuid",
        "logLevel": "info",
        "message": "Building Docker image...",
        "timestamp": "2025-12-30T10:30:01Z"
      },
      {
        "id": "uuid",
        "deploymentId": "uuid",
        "logLevel": "info",
        "message": "Docker image built: gilgal-proj-a1b2c3d4",
        "timestamp": "2025-12-30T10:30:45Z"
      }
    ],
    "total": 12
  }
}
```

---

### Rollback Deployment

```http
POST /deployments/:id/rollback
Authorization: Bearer <token>
```

**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "id": "previous-deployment-uuid",
    "status": "success",
    "deployedAt": "2025-12-28T10:35:00Z"
  },
  "message": "Deployment rolled back successfully"
}
```

---

### Cancel Deployment

```http
DELETE /deployments/:id
Authorization: Bearer <token>
```

**Response:** 200 OK
```json
{
  "success": true,
  "message": "Deployment cancelled"
}
```

---

## Health Check

### Server Health

```http
GET /health
```

**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-12-30T10:00:00Z"
  },
  "message": "Service is healthy"
}
```

---

## Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `USER_NOT_FOUND` | 404 | User not found |
| `PROJECT_NOT_FOUND` | 404 | Project not found |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Missing or invalid fields |
| `EMAIL_ALREADY_EXISTS` | 409 | Email already registered |
| `INSUFFICIENT_PERMISSIONS` | 403 | Access denied |
| `INTERNAL_SERVER_ERROR` | 500 | Server error |
| `DATABASE_ERROR` | 500 | Database operation failed |

---

## Rate Limiting

API rate limits (to be implemented):
- **Standard**: 100 requests per minute per user
- **Deployment**: 10 deployments per hour per project

---

## Pagination

Endpoints that return lists support pagination:

```
?page=1&limit=20
```

Response includes:
```json
{
  "items": [...],
  "total": 150,
  "page": 1,
  "limit": 20,
  "hasMore": true
}
```

---

## Example Usage

### Complete Workflow

```bash
# 1. Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "username": "user",
    "password": "securepass123",
    "fullName": "John Doe"
  }'

# 2. Login and get token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepass123"
  }' | jq -r '.data.accessToken')

# 3. Create project
curl -X POST http://localhost:3000/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My App",
    "framework": "react"
  }'

# 4. Create environment
curl -X POST http://localhost:3000/api/projects/PROJECT_ID/environments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production",
    "type": "production"
  }'

# 5. Trigger deployment
curl -X POST http://localhost:3000/api/projects/PROJECT_ID/deployments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "environmentId": "ENV_ID",
    "commitMessage": "Initial deployment"
  }'
```
