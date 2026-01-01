import { Router, Request, Response, NextFunction } from 'express';
import { DeploymentService } from '../services/DeploymentService';
import { NginxConfigService } from '../services/NginxConfigService';
import { sendSuccess, sendError } from '../utils/error';
import { HTTP_STATUS, ERROR_CODES, PAGINATION } from '../constants';
import { authMiddleware } from '../middleware/auth';

const router = Router({ mergeParams: true });

/**
 * Deployment Routes
 * GET /api/projects/:projectId/deployments - List deployments
 * POST /api/projects/:projectId/deployments - Create/trigger deployment
 * GET /api/deployments/:id - Get deployment details
 * GET /api/deployments/:id/logs - Get deployment logs
 * POST /api/deployments/:id/rollback - Rollback deployment
 * DELETE /api/deployments/:id - Cancel deployment
 */

/**
 * List all deployments for a project
 * GET /api/projects/:projectId/deployments
 */
router.get('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      sendError(res, HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED, 'Authentication required');
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string) || PAGINATION.DEFAULT_PAGE);
    const limit = Math.min(
      parseInt(req.query.limit as string) || PAGINATION.DEFAULT_LIMIT,
      PAGINATION.MAX_LIMIT
    );
    const offset = (page - 1) * limit;

    const { deployments, total } = await DeploymentService.getProjectDeployments(
      req.params.projectId,
      req.user.userId,
      limit,
      offset
    );

    sendSuccess(res, {
      items: deployments,
      total,
      page,
      limit,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Create and trigger new deployment
 * POST /api/projects/:projectId/deployments
 */
router.post('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      sendError(res, HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED, 'Authentication required');
      return;
    }

    // Check if body is empty or missing
    if (!req.body || Object.keys(req.body).length === 0) {
      sendError(
        res,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        'Request body is required'
      );
      return;
    }

    const { environmentId, commitSha, commitMessage } = req.body;

    // Validation
    if (!environmentId) {
      sendError(
        res,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        'Environment ID is required'
      );
      return;
    }

    const deployment = await DeploymentService.createDeployment(
      req.params.projectId,
      req.user.userId,
      {
        environmentId,
        commitSha,
        commitMessage,
      }
    );

    sendSuccess(res, deployment, 'Deployment started', HTTP_STATUS.CREATED);
  } catch (error) {
    next(error);
  }
});

/**
 * Get deployment details
 * GET /api/deployments/:id
 */
router.get('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      sendError(res, HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED, 'Authentication required');
      return;
    }

    const deployment = await DeploymentService.getDeployment(req.params.id, req.user.userId);

    sendSuccess(res, deployment);
  } catch (error) {
    next(error);
  }
});

/**
 * Get deployment logs with filtering and pagination
 * GET /api/deployments/:id/logs?level=info&limit=50&offset=0
 */
router.get('/:id/logs', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      sendError(res, HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED, 'Authentication required');
      return;
    }

    const deploymentId = req.params.id;
    const logLevel = (req.query.level as string) || undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const offset = parseInt(req.query.offset as string) || 0;

    const logs = await DeploymentService.getDeploymentLogs(deploymentId, req.user.userId);

    // Filter by log level if specified
    let filteredLogs = logLevel ? logs.filter((log: any) => log.log_level === logLevel) : logs;

    // Apply pagination
    const paginatedLogs = filteredLogs.slice(offset, offset + limit);

    sendSuccess(res, {
      items: paginatedLogs,
      total: filteredLogs.length,
      limit,
      offset,
      availableLevels: [...new Set(logs.map((log: any) => log.log_level))],
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Rollback to previous deployment
 * POST /api/deployments/:id/rollback
 */
router.post(
  '/:id/rollback',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        sendError(
          res,
          HTTP_STATUS.UNAUTHORIZED,
          ERROR_CODES.UNAUTHORIZED,
          'Authentication required'
        );
        return;
      }

      const previousDeployment = await DeploymentService.rollbackDeployment(
        req.params.id,
        req.user.userId
      );

      sendSuccess(res, previousDeployment, 'Deployment rolled back successfully');
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Cancel ongoing deployment
 * DELETE /api/deployments/:id
 */
router.delete('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      sendError(res, HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED, 'Authentication required');
      return;
    }

    await DeploymentService.cancelDeployment(req.params.id, req.user.userId);

    sendSuccess(res, null, 'Deployment cancelled');
  } catch (error) {
    next(error);
  }
});

/**
 * Get all active deployments (for nginx config generation)
 * GET /api/deployments/active
 * Public endpoint - no auth required (used by nginx config generator)
 */
router.get('/active', async (req: Request, res: Response, next: NextFunction) => {
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

export default router;
