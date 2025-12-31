import { Router, Request, Response, NextFunction } from 'express';
import { ProjectService } from '../services/ProjectService';
import { sendSuccess, sendError } from '../utils/error';
import { HTTP_STATUS, ERROR_CODES, PAGINATION } from '../constants';
import { authMiddleware, requireAuth } from '../middleware/auth';

const router = Router();

/**
 * Project Routes
 * GET /api/projects - List user projects
 * POST /api/projects - Create project
 * GET /api/projects/:id - Get project details
 * PUT /api/projects/:id - Update project
 * DELETE /api/projects/:id - Delete project
 */

/**
 * List all projects for authenticated user
 * GET /api/projects
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

    const { projects, total } = await ProjectService.getUserProjects(
      req.user.userId,
      limit,
      offset
    );

    sendSuccess(res, {
      items: projects,
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
 * Create new project
 * POST /api/projects
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

    const { name, description, repositoryUrl, framework } = req.body;

    // Validation
    if (!name || !framework) {
      sendError(
        res,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        'Name and framework are required'
      );
      return;
    }

    const project = await ProjectService.createProject(req.user.userId, {
      name,
      description,
      repositoryUrl,
      framework,
    });

    sendSuccess(res, project, 'Project created successfully', HTTP_STATUS.CREATED);
  } catch (error) {
    next(error);
  }
});

/**
 * Get project by ID
 * GET /api/projects/:id
 */
router.get('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      sendError(res, HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED, 'Authentication required');
      return;
    }

    const project = await ProjectService.getProject(req.params.id, req.user.userId);
    sendSuccess(res, project);
  } catch (error) {
    next(error);
  }
});

/**
 * Update project
 * PUT /api/projects/:id
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

    const { name, description, repositoryUrl } = req.body;
    const project = await ProjectService.updateProject(req.params.id, req.user.userId, {
      name,
      description,
      repositoryUrl,
    });

    sendSuccess(res, project, 'Project updated successfully');
  } catch (error) {
    next(error);
  }
});

/**
 * Delete project
 * DELETE /api/projects/:id
 */
router.delete('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      sendError(res, HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED, 'Authentication required');
      return;
    }

    await ProjectService.deleteProject(req.params.id, req.user.userId);
    sendSuccess(res, null, 'Project deleted successfully');
  } catch (error) {
    next(error);
  }
});

export default router;
