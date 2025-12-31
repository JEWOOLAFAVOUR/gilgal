## Deployment Engine Architecture

The Gilgal deployment engine is responsible for building, running, and managing containerized applications for users. It provides a complete deployment pipeline with Docker support.

### Core Components

#### 1. Deployment Service (`DeploymentService`)
The main orchestrator that manages the deployment lifecycle:

- **createDeployment()** - Initiates a new deployment process
  - Creates deployment record with status 'pending'
  - Triggers async pipeline execution
  - Returns deployment details immediately

- **executeDeployment()** - Executes the deployment pipeline asynchronously
  - Changes status to 'building'
  - Builds Docker image
  - Runs container with environment variables
  - Updates status to 'success' or 'failed'
  - Logs all steps

- **getProjectDeployments()** - Lists all deployments for a project with pagination
- **getDeployment()** - Retrieves specific deployment details
- **getDeploymentLogs()** - Fetches deployment execution logs
- **rollbackDeployment()** - Reverts to previous successful deployment
- **cancelDeployment()** - Stops ongoing deployment

#### 2. Docker Service (`DockerService`)
Handles all Docker operations:

- **buildImage()** - Creates Docker image from source code
  - Pulls source from repository
  - Generates appropriate Dockerfile
  - Runs docker build
  - Returns image ID and name

- **runContainer()** - Starts container with configuration
  - Allocates available port
  - Sets environment variables
  - Applies resource limits (in production)
  - Returns container ID

- **stopContainer()** - Gracefully stops running container
- **getContainerLogs()** - Retrieves container logs (last N lines)
- **removeImage()** - Cleans up Docker image
- **getContainerHealth()** - Gets container status and metrics
- **pushImage()** - Pushes image to Docker registry

#### 3. Environment Service (`EnvironmentService`)
Manages deployment environments:

- **createEnvironment()** - Sets up new environment (prod/staging/dev)
- **getProjectEnvironments()** - Lists all environments for a project
- **getEnvironment()** - Retrieves environment with ownership verification
- **updateEnvironment()** - Updates environment configuration and variables
- **deleteEnvironment()** - Soft deletes environment

### Deployment Pipeline

```
User triggers deployment
        ↓
Create deployment record (status: pending)
        ↓
Update status → "building"
        ↓
Build Docker image
    ↙          ↘
Success    Failure → Log error, update status, end
    ↓
Get environment configuration
    ↓
Run Docker container
    ↙          ↘
Success    Failure → Log error, update status, end
    ↓
Update status → "success"
    ↓
Log completion time and container ID
```

### Database Schema for Deployments

```sql
deployments
├── id (UUID, PK)
├── project_id (FK → projects)
├── environment_id (FK → environments)
├── commit_sha (source code commit)
├── commit_message (deployment message)
├── status (pending | building | success | failed | cancelled)
├── duration_seconds (deployment time)
├── deployed_at (timestamp)
├── container_id (running container)
├── error_message (if failed)
├── created_at
└── updated_at

deployment_logs
├── id (UUID, PK)
├── deployment_id (FK → deployments)
├── log_level (info | warning | error | debug)
├── message (log message)
└── timestamp
```

### API Endpoints

#### Trigger Deployment
```http
POST /api/projects/:projectId/deployments
Content-Type: application/json
Authorization: Bearer <token>

{
  "environmentId": "env-uuid",
  "commitSha": "abc123def456",
  "commitMessage": "Deploy feature X"
}

Response: 201 Created
{
  "id": "deployment-uuid",
  "projectId": "project-uuid",
  "environmentId": "env-uuid",
  "status": "pending",
  "createdAt": "2025-12-30T10:30:00Z"
}
```

#### List Deployments
```http
GET /api/projects/:projectId/deployments?page=1&limit=20
Authorization: Bearer <token>

Response: 200 OK
{
  "items": [...],
  "total": 42,
  "page": 1,
  "limit": 20,
  "hasMore": true
}
```

#### Get Deployment Details
```http
GET /api/deployments/:id
Authorization: Bearer <token>

Response: 200 OK
{
  "id": "deployment-uuid",
  "status": "success",
  "duration_seconds": 240,
  "container_id": "container-uuid",
  "deployed_at": "2025-12-30T10:35:00Z"
}
```

#### Get Deployment Logs
```http
GET /api/deployments/:id/logs
Authorization: Bearer <token>

Response: 200 OK
{
  "items": [
    {
      "timestamp": "2025-12-30T10:30:00Z",
      "level": "info",
      "message": "Starting deployment..."
    },
    ...
  ],
  "total": 15
}
```

#### Rollback Deployment
```http
POST /api/deployments/:id/rollback
Authorization: Bearer <token>

Response: 200 OK
{
  "id": "previous-deployment-uuid",
  "status": "success",
  "message": "Rolled back to previous deployment"
}
```

#### Cancel Deployment
```http
DELETE /api/deployments/:id
Authorization: Bearer <token>

Response: 200 OK
{
  "message": "Deployment cancelled"
}
```

### Environment Configuration

Create different environments with specific settings:

```http
POST /api/projects/:projectId/environments
Authorization: Bearer <token>

{
  "name": "Production",
  "type": "production",
  "domain": "myapp.gilgal.dev",
  "environmentVariables": {
    "NODE_ENV": "production",
    "API_URL": "https://api.example.com",
    "LOG_LEVEL": "error"
  }
}
```

### Docker Integration Details

#### Image Building
- Supports multiple frameworks (Next.js, React, Node.js, Django, etc.)
- Automatically generates Dockerfile based on project type
- Includes build caching for faster subsequent builds
- Optimizes final image size with multi-stage builds

#### Container Management
- Allocates dynamic ports (prevents conflicts)
- Injects environment variables at runtime
- Sets resource limits (CPU, memory)
- Configures health checks
- Manages container lifecycle (start, stop, restart)

#### Registry Support
- Push to Docker Hub
- Support for private registries
- Image tagging with version info
- Automatic cleanup of old images

### Monitoring and Logs

Every deployment creates detailed logs:

```
[2025-12-30T10:30:00Z] info: Starting deployment pipeline...
[2025-12-30T10:30:01Z] info: Building Docker image...
[2025-12-30T10:30:45Z] info: Docker image built: gilgal-proj-a1b2c3d4
[2025-12-30T10:30:45Z] info: Starting container...
[2025-12-30T10:31:10Z] info: Container running on port 8342
[2025-12-30T10:31:10Z] info: Deployment completed successfully in 130s
```

### Rollback Strategy

Automatic rollback capability allows reverting to last successful deployment:

1. Identify previous successful deployment
2. Stop current container
3. Restart previous container
4. Update deployment status
5. Log rollback action

### Error Handling

- **Build failures** - Logged with docker build output
- **Runtime errors** - Captured in container logs
- **Network issues** - Retry logic with exponential backoff
- **Resource limits** - Deployment fails gracefully if limits exceeded

### Performance Optimization

- **Build caching** - Reuses Docker layers for faster builds
- **Parallel operations** - Asynchronous pipeline execution
- **Database connection pooling** - Efficient database queries
- **Log streaming** - Real-time log delivery to client

### Future Enhancements

- [ ] Auto-scaling based on load
- [ ] Blue-green deployments
- [ ] Canary releases
- [ ] Webhook integration for CI/CD
- [ ] Custom resource allocation
- [ ] Application health monitoring
- [ ] Automatic container restart on failure
- [ ] Multi-region deployment support
