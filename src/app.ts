import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import config from './config';
import { errorHandler, sendSuccess, sendError } from './utils/error';
import { requestLogger, requestIdMiddleware } from './middleware/logging';
import { HTTP_STATUS } from './constants';
import { NginxConfigService } from './services/NginxConfigService';

// Import route handlers
import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import environmentRoutes from './routes/environments';
import deploymentRoutes from './routes/deployments';
import webhookRoutes from './routes/webhooks';

/**
 * Create and configure Express application
 */
export function createApp(): Express {
  const app = express();

  // Security middleware
  app.use(helmet());

  // CORS configuration
  app.use(
    cors({
      origin: config.cors.origin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    })
  );

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Middleware to validate Content-Type for POST/PUT/DELETE requests
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      if (!req.is('json') && Object.keys(req.body || {}).length === 0) {
        // Only enforce if body is empty, allow GET requests through
        const contentType = req.headers['content-type'];
        if (!contentType || !contentType.includes('application/json')) {
          return sendError(
            res,
            HTTP_STATUS.BAD_REQUEST,
            'INVALID_CONTENT_TYPE',
            'Content-Type: application/json header is required for this request'
          );
        }
      }
    }
    next();
  });

  // Request tracing middleware
  app.use(requestIdMiddleware);
  app.use(requestLogger);

  // Health check endpoint (no auth required)
  app.get('/health', (req: Request, res: Response) => {
    sendSuccess(res, { status: 'healthy', timestamp: new Date() }, 'Service is healthy');
  });

  // Version endpoint
  app.get('/version', (req: Request, res: Response) => {
    sendSuccess(res, { version: '1.0.0' }, 'API version');
  });

  // Public endpoint: Active deployments (for nginx config generation)
  app.get('/api/deployments/active', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const deployments = await NginxConfigService.getActiveDeployments();
      sendSuccess(res, {
        deployments,
        total: deployments.length,
        domain: 'gilgal.tech',
      });
    } catch (error) {
      next(error);
    }
  });

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/projects/:projectId/environments', environmentRoutes);
  app.use('/api/projects/:projectId/deployments', deploymentRoutes);
  app.use('/api/deployments', deploymentRoutes);

  // Webhook Routes (must be after raw body middleware)
  app.use('/webhooks', webhookRoutes);

  // 404 handler
  app.use((req: Request, res: Response) => {
    sendError(res, HTTP_STATUS.NOT_FOUND, 'NOT_FOUND', 'Endpoint not found');
  });

  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
}
