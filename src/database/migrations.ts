import { query } from './index';

/**
 * Database Migration System
 * Executes SQL migrations to set up the database schema
 */

const migrations = [
  {
    id: '001_create_users_table',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255),
        avatar_url TEXT,
        bio TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    `,
  },
  {
    id: '002_create_projects_table',
    sql: `
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        repository_url TEXT,
        framework VARCHAR(50),
        status VARCHAR(50) DEFAULT 'inactive',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
      CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
    `,
  },
  {
    id: '003_create_environments_table',
    sql: `
      CREATE TABLE IF NOT EXISTS environments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(50) NOT NULL,
        domain VARCHAR(255) UNIQUE,
        environment_variables JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_environments_project_id ON environments(project_id);
      CREATE INDEX IF NOT EXISTS idx_environments_domain ON environments(domain);
    `,
  },
  {
    id: '004_create_deployments_table',
    sql: `
      CREATE TABLE IF NOT EXISTS deployments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
        commit_sha VARCHAR(40),
        commit_message TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        duration_seconds INTEGER,
        deployed_at TIMESTAMP,
        container_id VARCHAR(255),
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_deployments_project_id ON deployments(project_id);
      CREATE INDEX IF NOT EXISTS idx_deployments_environment_id ON deployments(environment_id);
      CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments(status);
    `,
  },
  {
    id: '005_create_deployment_logs_table',
    sql: `
      CREATE TABLE IF NOT EXISTS deployment_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
        log_level VARCHAR(20),
        message TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_deployment_logs_deployment_id ON deployment_logs(deployment_id);
    `,
  },
  {
    id: '006_create_api_keys_table',
    sql: `
      CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        key_hash VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        last_used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
    `,
  },
  {
    id: '008_fix_projects_slug_constraint',
    sql: `
      ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_slug_key;
      CREATE UNIQUE INDEX IF NOT EXISTS projects_slug_active
      ON projects(slug)
      WHERE deleted_at IS NULL;
    `,
  },
  {
    id: '009_add_container_port_to_deployments',
    sql: `
      ALTER TABLE deployments ADD COLUMN IF NOT EXISTS container_port INTEGER;
      CREATE INDEX IF NOT EXISTS idx_deployments_container_port ON deployments(container_port);
    `,
  },
];

/**
 * Run all pending migrations
 */
export async function runMigrations(): Promise<void> {
  console.log('Starting database migrations...');

  for (const migration of migrations) {
    try {
      console.log(`Running migration: ${migration.id}`);
      await query(migration.sql);
      console.log(`Completed migration: ${migration.id}`);
    } catch (error) {
      console.error(`Failed to run migration ${migration.id}:`, error);
      throw error;
    }
  }

  console.log('All migrations completed successfully');
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
