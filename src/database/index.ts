import { Pool, PoolClient } from 'pg';
import config from '../config';

// Create connection pool for database operations
const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.name,
  ssl: {
    rejectUnauthorized: false, // Required for Neon
  },
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

/**
 * Execute a database query with connection pooling
 * Automatically handles connection management
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<{ rows: T[]; rowCount: number }> {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('[DB Query]', { text, duration: `${duration}ms`, rows: result.rowCount });
    return {
      rows: result.rows,
      rowCount: result.rowCount || 0,
    };
  } catch (error) {
    console.error('[DB Error]', { text, error });
    throw error;
  }
}

/**
 * Execute a transaction with multiple queries
 * All queries succeed or all are rolled back
 */
export async function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close database connection pool
 * Call this when shutting down the application
 */
export async function closePool(): Promise<void> {
  await pool.end();
}

export { pool };
