# Gilgal Backend - Development Guide

This guide helps you set up and work on the Gilgal backend locally.

## Quick Start

### 1. Set Up Environment

```bash
cd backend
cp .env.example .env
```

Edit `.env` with your local database credentials.

### 2. Install Dependencies

```bash
npm install
```

### 3. Start PostgreSQL

Using the docker-compose setup (recommended):
```bash
docker-compose up
```

Or if you have PostgreSQL installed locally:
```bash
brew services start postgresql@15
createdb gilgal_dev
```

### 4. Run Migrations

```bash
npm run db:migrate
```

### 5. Seed Sample Data (Optional)

```bash
npm run db:seed
```

### 6. Start Development Server

```bash
npm run dev
```

The API will be available at `http://localhost:3000`

## API Endpoints Reference

### Authentication

**Register User**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "username": "username",
    "password": "securepassword123",
    "fullName": "Full Name"
  }'
```

**Login**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword123"
  }'
```

**Get Current User**
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Projects

**List Projects**
```bash
curl -X GET http://localhost:3000/api/projects \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Create Project**
```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My React App",
    "description": "Beautiful React application",
    "framework": "react",
    "repositoryUrl": "https://github.com/user/repo"
  }'
```

**Get Project**
```bash
curl -X GET http://localhost:3000/api/projects/PROJECT_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Update Project**
```bash
curl -X PUT http://localhost:3000/api/projects/PROJECT_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Name",
    "description": "Updated description"
  }'
```

**Delete Project**
```bash
curl -X DELETE http://localhost:3000/api/projects/PROJECT_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Database

### View Schema

```bash
psql gilgal_dev
```

Common queries:
```sql
-- List all users
SELECT id, email, username, full_name FROM users;

-- List all projects
SELECT id, name, user_id, framework FROM projects;

-- View deployments for a project
SELECT * FROM deployments WHERE project_id = 'PROJECT_ID';
```

### Reset Database

```bash
# Drop all tables and recreate
npm run db:migrate
```

### Add Test Data

```bash
npm run db:seed
```

## Development Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Run production server |
| `npm run db:migrate` | Execute database migrations |
| `npm run db:seed` | Seed database with sample data |
| `npm run lint` | Run ESLint to check code quality |
| `npm run format` | Format code with Prettier |
| `npm run type-check` | Check TypeScript types without compilation |

## Common Tasks

### Add a New Route

1. Create service in `src/services/YourService.ts`
2. Create routes in `src/routes/your-routes.ts`
3. Import and register in `src/index.ts`:
   ```typescript
   import yourRoutes from './routes/your-routes';
   app.use('/api/your-endpoint', yourRoutes);
   ```

### Add a Database Migration

1. Create SQL in `src/database/migrations.ts`
2. Run migrations: `npm run db:migrate`

### Fix TypeScript Errors

Check errors:
```bash
npm run type-check
```

The error message will show file location and line number.

## Testing Locally

### Using REST Client (VS Code Extension)

Install "REST Client" extension, create `requests.http`:
```
@baseUrl = http://localhost:3000
@token = YOUR_ACCESS_TOKEN

### Register
POST {{baseUrl}}/api/auth/register
Content-Type: application/json

{
  "email": "test@example.com",
  "username": "testuser",
  "password": "password123",
  "fullName": "Test User"
}

### Get Projects
GET {{baseUrl}}/api/projects
Authorization: Bearer {{token}}
```

Click "Send Request" above each request.

### Using Postman

1. Create new Collection
2. Create requests for each endpoint
3. Use environment variables for `baseUrl` and `token`
4. Save and share with team

## Debugging

### Enable Debug Logging

Set in `.env`:
```
LOG_LEVEL=debug
NODE_ENV=development
```

### View Database Logs

In `psql`:
```sql
-- View recent queries
SELECT query, calls, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;
```

### Debug API Requests

Use VS Code debugger:
1. Add breakpoint in code
2. Press F5 to start debugging
3. Requests will pause at breakpoints

## Docker Development

### Rebuild Docker Image

```bash
docker-compose down
docker-compose up --build
```

### View Container Logs

```bash
docker-compose logs -f api
```

### Access PostgreSQL in Container

```bash
docker-compose exec postgres psql -U postgres -d gilgal_dev
```

### Clean Up

```bash
docker-compose down -v  # Remove containers and volumes
```

## Code Style

The project uses:
- **Prettier** for code formatting
- **ESLint** for linting
- **TypeScript** strict mode

Before committing:
```bash
npm run format
npm run lint
npm run type-check
```

## Performance Tips

1. Add indexes to frequently queried columns
2. Use connection pooling (already configured)
3. Implement caching for read-heavy operations
4. Monitor query performance with `EXPLAIN ANALYZE`

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000
# Kill it
kill -9 <PID>
```

### Database Connection Refused

- Ensure PostgreSQL is running
- Check `.env` database credentials
- Verify database exists: `createdb gilgal_dev`

### Migrations Fail

- Check PostgreSQL logs for errors
- Ensure database is clean: `npm run db:migrate` (idempotent)
- Manual fix: Connect to `psql` and check table schemas

### Dependency Issues

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

## Next Steps

- Implement deployment service
- Add WebSocket support for real-time logs
- Create admin dashboard API
- Set up integration tests
- Configure CI/CD pipeline

For questions, check the ARCHITECTURE.md for design patterns and structure overview.
