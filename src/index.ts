import config from './config';
import { createApp } from './app';
import { runMigrations } from './database/migrations';
import { closePool } from './database';

/**
 * Gilgal Backend API
 * Main entry point for the application
 */

async function bootstrap(): Promise<void> {
  try {
    console.log(`[Server] Starting in ${config.nodeEnv} environment`);
    console.log(`[Server] Database: ${config.database.host}:${config.database.port}/${config.database.name}`);

    // Run database migrations
    console.log('[Database] Running migrations...');
    await runMigrations();
    console.log('[Database] Migrations completed');

    // Create Express application
    const app = createApp();

    // Start server
    const server = app.listen(config.port, () => {
      console.log(`[Server] API listening on http://localhost:${config.port}`);
      console.log(`[Server] Health check: http://localhost:${config.port}/health`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('[Server] SIGTERM received, shutting down gracefully...');
      server.close(async () => {
        await closePool();
        console.log('[Server] Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      console.log('[Server] SIGINT received, shutting down gracefully...');
      server.close(async () => {
        await closePool();
        console.log('[Server] Server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('[Server] Fatal error during startup:', error);
    process.exit(1);
  }
}

// Start the application
bootstrap();
