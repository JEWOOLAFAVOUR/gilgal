# Gilgal Backend

A professional PaaS platform backend for deploying web applications (React, Next.js, Node.js, etc.) with Docker containerization support.

## Architecture

```
src/
├── index.ts              # Application entry point
├── config/              # Configuration management
├── database/            # Database utilities and migrations
├── routes/              # API route definitions
├── controllers/         # Request handlers
├── services/            # Business logic
├── middleware/          # Express middleware
├── types/               # TypeScript type definitions
├── utils/               # Utility functions
└── constants/           # Application constants
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 15+ (local or via Docker)
- Docker & Docker Compose (for containerization)

### Local Development

1. Copy environment file:
```bash
cp .env.example .env
```

2. Install dependencies:
```bash
npm install
```

3. Run migrations:
```bash
npm run db:migrate
```

4. Start development server:
```bash
npm run dev
```

The API will be available at `http://localhost:3000`

### Using Docker Compose

```bash
docker-compose up
```

This starts both PostgreSQL and the API server in development mode.

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run compiled application
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed database with sample data
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run type-check` - Check TypeScript types

## API Endpoints

### Health Check
- `GET /health` - API health status

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh JWT token

### Users
- `GET /api/users/me` - Get current user profile
- `PUT /api/users/me` - Update user profile

### Projects
- `GET /api/projects` - List user projects
- `POST /api/projects` - Create new project
- `GET /api/projects/:id` - Get project details
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Deployments
- `GET /api/projects/:projectId/deployments` - List project deployments
- `POST /api/projects/:projectId/deployments` - Create deployment
- `GET /api/deployments/:id` - Get deployment details
- `GET /api/deployments/:id/logs` - Get deployment logs

### Environments
- `GET /api/projects/:projectId/environments` - List project environments
- `POST /api/projects/:projectId/environments` - Create environment
- `DELETE /api/environments/:id` - Delete environment

## Database Schema

### Core Tables
- `users` - User accounts
- `projects` - User projects
- `deployments` - Project deployments
- `environments` - Environment configurations
- `api_keys` - API key management
- `deployment_logs` - Deployment and application logs

## Deployment

### Docker Image Build
```bash
docker build -t gilgal-api .
```

### Running Container
```bash
docker run -p 3000:3000 --env-file .env gilgal-api
```

## Error Handling

All API responses follow a standard format:

Success Response:
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

Error Response:
```json
{
  "success": false,
  "error": "error_code",
  "message": "Human-readable error message"
}
```

## License

MIT
