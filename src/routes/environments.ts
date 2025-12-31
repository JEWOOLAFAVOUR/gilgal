import { Router, Request, Response, NextFunction } from 'express';
import { EnvironmentService } from '../services/EnvironmentService';
import { sendSuccess, sendError } from '../utils/error';
import { HTTP_STATUS, ERROR_CODES, PAGINATION } from '../constants';
import { authMiddleware } from '../middleware/auth';

const router = Router({ mergeParams: true });

/**
 * Environment Routes
 * GET /api/projects/:projectId/environments - List environments
 * POST /api/projects/:projectId/environments - Create environment
 * PUT /api/environments/:id - Update environment
 * DELETE /api/environments/:id - Delete environment
 */

/**
 * List all environments for a project
 * GET /api/projects/:projectId/environments
 */
router.get('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      sendError(res, HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED, 'Authentication required');
      return;
    }

    const environments = await EnvironmentService.getProjectEnvironments(
      req.params.projectId,
      req.user.userId
    );

    sendSuccess(res, {
      items: environments,
      total: environments.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Create new environment
 * POST /api/projects/:projectId/environments
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

    const { name, type, domain, environmentVariables } = req.body;

    // Validation
    if (!name || !type) {
      sendError(
        res,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        'Name and type are required'
      );
      return;
    }

    const validTypes = ['production', 'staging', 'development'];
    if (!validTypes.includes(type)) {
      sendError(
        res,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        'Invalid environment type'
      );
      return;
    }

    const environment = await EnvironmentService.createEnvironment(
      req.params.projectId,
      req.user.userId,
      {
        name,
        type,
        domain,
        environmentVariables,
      }
    );

    sendSuccess(res, environment, 'Environment created successfully', HTTP_STATUS.CREATED);
  } catch (error) {
    next(error);
  }
});

/**
 * Update environment
 * PUT /api/environments/:id
 */
router.put('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
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

    const { name, domain, environmentVariables } = req.body;

    const environment = await EnvironmentService.updateEnvironment(req.params.id, req.user.userId, {
      name,
      domain,
      environmentVariables,
    });

    sendSuccess(res, environment, 'Environment updated successfully');
  } catch (error) {
    next(error);
  }
});

/**
 * Delete environment
 * DELETE /api/environments/:id
 */
router.delete('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      sendError(res, HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED, 'Authentication required');
      return;
    }

    await EnvironmentService.deleteEnvironment(req.params.id, req.user.userId);

    sendSuccess(res, null, 'Environment deleted successfully');
  } catch (error) {
    next(error);
  }
});

export default router;
