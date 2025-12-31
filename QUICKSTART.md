# Gilgal Backend - Quick Start

## What You Have

A **professional, production-ready backend** for the Gilgal PaaS platform built with:

- TypeScript + Node.js
- Express.js API framework
- PostgreSQL database
- Docker containerization
- JWT authentication
- Professional code organization

## Start in 5 Minutes

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Start Database (choose one)

**Option A: With Docker (recommended)**
```bash
docker-compose up
```

**Option B: Local PostgreSQL**
```bash
createdb gilgal_dev
```

### 3. Run Migrations
```bash
npm run db:migrate
```

### 4. Start Development Server
```bash
npm run dev
```

Access API at: `http://localhost:3000`

## Test It Out

### Create Account
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "you@example.com",
    "username": "yourname",
    "password": "securepassword123",
    "fullName": "Your Full Name"
  }'
```

Save the `accessToken` from response.

### Create Project
```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My React App",
    "framework": "react",
    "description": "A beautiful React app"
  }'
```

### List Projects
```bash
curl -X GET http://localhost:3000/api/projects \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Project Files Overview

```
backend/
├── src/
│   ├── config/              Configuration (database, JWT, etc)
│   ├── constants/           HTTP codes, error codes, routes
│   ├── database/            PostgreSQL setup, migrations
│   ├── middleware/          Authentication, logging
│   ├── routes/              API endpoints
│   ├── services/            Business logic (UserService, ProjectService)
│   ├── types/               TypeScript definitions
│   ├── utils/               Helper functions (JWT, error handling)
│   ├── app.ts               Express app setup
│   └── index.ts             Server startup
│
├── Documentation:
│   ├── README.md             Main overview
│   ├── SETUP_SUMMARY.md      What was created
│   ├── ARCHITECTURE.md       Design patterns
│   ├── DEVELOPMENT.md        Local development guide
│   └── DOCKER.md             Docker & deployment guide
│
├── Config Files:
│   ├── package.json          Dependencies & scripts
│   ├── tsconfig.json         TypeScript configuration
│   ├── .eslintrc.json        Code linting rules
│   ├── .prettierrc.json      Code formatting rules
│   ├── .env.example          Environment variables
│   ├── Dockerfile            Production container
│   └── docker-compose.yml    Local dev containers
```

## Key Features Implemented

### Authentication System
- User registration and login
- JWT token generation
- Protected routes
- Password hashing

### Project Management
- Create, read, update, delete projects
- User project isolation
- Project metadata storage

### Database
- PostgreSQL with 6 core tables
- Automated migrations
- Connection pooling
- Sample data seeding

### API
- RESTful endpoints
- Consistent error handling
- Request logging
- Health checks

### Security
- JWT authentication
- Password hashing (bcryptjs)
- CORS protection
- Security headers (Helmet)

## API Endpoints

### Health & Info
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/health` | API health check |
| GET | `/version` | API version |

### Authentication
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/register` | Create new account |
| POST | `/api/auth/login` | Login to account |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/refresh` | Refresh JWT token |
| POST | `/api/auth/logout` | Logout (client-side) |

### Projects (protected)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/projects` | List all projects |
| POST | `/api/projects` | Create new project |
| GET | `/api/projects/:id` | Get project details |
| PUT | `/api/projects/:id` | Update project |
| DELETE | `/api/projects/:id` | Delete project |

### Users (protected)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/users/me` | Get user profile |

## Useful Commands

```bash
npm run dev              # Start dev server with hot reload
npm run build            # Compile TypeScript to JavaScript
npm start                # Run production build
npm run db:migrate       # Execute database migrations
npm run db:seed          # Seed sample data
npm run lint             # Check code quality with ESLint
npm run format           # Auto-format code with Prettier
npm run type-check       # Check TypeScript without compiling
```

## Database

### Connect to PostgreSQL

```bash
psql gilgal_dev
```

### Useful Queries

```sql
-- View all users
SELECT id, email, username, full_name FROM users;

-- View all projects
SELECT id, name, user_id, framework FROM projects;

-- Count projects per user
SELECT user_id, COUNT(*) FROM projects GROUP BY user_id;
```

## Docker Commands

```bash
# Start services
docker-compose up

# Stop services
docker-compose down

# View logs
docker-compose logs -f api

# Run command in container
docker-compose exec api npm run db:migrate

# Rebuild image
docker-compose up --build
```

## Code Style

The project is configured with:

- **ESLint** - Enforces code quality rules
- **Prettier** - Automatic code formatting
- **TypeScript** - Strict type checking

Before committing:
```bash
npm run format    # Auto-format code
npm run lint      # Check for issues
npm run type-check # Check types
```

## Response Format

### Success Response (HTTP 200)
```json
{
  "success": true,
  "data": { /* data */ },
  "message": "Operation successful"
}
```

### Error Response (HTTP 400+)
```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable error message"
}
```

## Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Key variables:
- `DATABASE_URL` - PostgreSQL connection string
- `PORT` - Server port (default 3000)
- `JWT_SECRET` - JWT signing key
- `NODE_ENV` - Environment (development/production)
- `CORS_ORIGIN` - Allowed origins

## Troubleshooting

### Port 3000 already in use
```bash
lsof -i :3000              # Find process
kill -9 <PID>              # Kill process
```

### Database connection failed
```bash
# Check PostgreSQL is running
brew services list | grep postgresql

# Recreate database
createdb gilgal_dev
npm run db:migrate
```

### Clear everything and restart
```bash
npm run build              # Compile TypeScript
npm run db:migrate         # Run migrations
npm run dev                # Start server
```

## Next Steps

1. Test the API with the curl examples above
2. Read [ARCHITECTURE.md](ARCHITECTURE.md) to understand the design
3. Read [DEVELOPMENT.md](DEVELOPMENT.md) for local development setup
4. Read [DOCKER.md](DOCKER.md) for production deployment
5. Implement deployment service (containerizing user applications)
6. Build the frontend dashboard (React/Next.js)
7. Deploy to production (AWS/Railway/etc)

## Project Status

✓ Backend structure complete
✓ Authentication system implemented
✓ Database schema created
✓ Project CRUD operations
✓ Docker setup ready
✓ Professional code organization
✓ Comprehensive documentation

Ready for: Local development, Docker deployment, Kubernetes orchestration

## Support

For detailed information, see:
- [SETUP_SUMMARY.md](SETUP_SUMMARY.md) - Complete setup details
- [ARCHITECTURE.md](ARCHITECTURE.md) - Design patterns and structure
- [DEVELOPMENT.md](DEVELOPMENT.md) - Development guides
- [DOCKER.md](DOCKER.md) - Docker deployment guide

---

**Your Gilgal PaaS backend is ready! Start with `npm run dev`**
