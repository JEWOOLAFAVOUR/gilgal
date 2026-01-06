import { Router, Request, Response, NextFunction } from 'express';
import { ProjectService } from '../services/ProjectService';
import { DeploymentService } from '../services/DeploymentService';
import { GitHubOAuthService } from '../services/GitHubOAuthService';
import { sendSuccess, sendError } from '../utils/error';
import { HTTP_STATUS, ERROR_CODES, PAGINATION } from '../constants';
import { authMiddleware, requireAuth } from '../middleware/auth';
import { query } from '../database';
import { v4 as uuidv4 } from 'uuid';

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
 * Trigger deployment for a project
 * POST /api/projects/:projectId/deployments
 */
router.post(
  '/:projectId/deployments',
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

      const projectId = req.params.projectId;
      const { environmentId } = req.body;

      // Get project to verify ownership
      const project = await ProjectService.getProject(projectId, req.user.userId);
      if (!project) {
        sendError(res, HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, 'Project not found');
        return;
      }

      // Validate environmentId
      if (!environmentId) {
        sendError(
          res,
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR,
          'Environment ID is required'
        );
        return;
      }

      // Update project status to deploying
      await ProjectService.updateProject(projectId, req.user.userId, {
        status: 'deploying',
      });

      // Create deployment record
      const deploymentId = uuidv4();

      // Trigger actual deployment process (fire and forget)
      DeploymentService.executeDeployment(
        deploymentId,
        projectId,
        environmentId,
        req.user.userId
      ).catch((error: any) => {
        console.error('[Deployment Error]', error);
      });

      sendSuccess(
        res,
        { projectId, environmentId, status: 'deploying' },
        'Deployment started',
        HTTP_STATUS.ACCEPTED
      );
    } catch (error) {
      next(error);
    }
  }
);

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

/**
 * Enable auto-deploy (creates GitHub webhook automatically)
 * POST /api/projects/:projectId/webhooks/enable
 */
router.post(
  '/:projectId/webhooks/enable',
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

      // Get project details
      const projectResult = await query(
        'SELECT id, user_id, repository_url FROM projects WHERE id = $1 AND deleted_at IS NULL',
        [req.params.projectId]
      );

      if (projectResult.rows.length === 0) {
        sendError(res, HTTP_STATUS.NOT_FOUND, ERROR_CODES.PROJECT_NOT_FOUND, 'Project not found');
        return;
      }

      const project = projectResult.rows[0];

      if (project.user_id !== req.user.userId) {
        sendError(
          res,
          HTTP_STATUS.FORBIDDEN,
          ERROR_CODES.INSUFFICIENT_PERMISSIONS,
          'You do not have permission to modify this project'
        );
        return;
      }

      // Check if GitHub token exists
      const githubToken = await GitHubOAuthService.getGitHubToken(req.user.userId);
      if (!githubToken) {
        sendError(
          res,
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR,
          'GitHub account not connected. Please connect your GitHub account first.'
        );
        return;
      }

      // Parse repository URL
      const repoInfo = GitHubOAuthService.parseRepositoryUrl(project.repository_url);
      if (!repoInfo) {
        sendError(
          res,
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR,
          'Invalid repository URL format'
        );
        return;
      }

      // Generate webhook secret
      const webhookSecret = require('crypto').randomBytes(32).toString('hex');

      // Create webhook URL
      const webhookUrl = `${process.env.API_BASE_URL || 'https://api.gilgal.tech'}/webhooks/github/${req.params.projectId}`;

      // Create GitHub webhook
      const webhookResult = await GitHubOAuthService.createWebhook(
        repoInfo.owner,
        repoInfo.repo,
        githubToken.token,
        webhookUrl,
        webhookSecret
      );

      // Update project with webhook details
      await query(
        `
        UPDATE projects 
        SET auto_deploy_enabled = true,
            webhook_secret = $1,
            github_webhook_id = $2
        WHERE id = $3
        `,
        [webhookSecret, webhookResult.id, req.params.projectId]
      );

      sendSuccess(
        res,
        {
          projectId: req.params.projectId,
          webhookUrl,
          autoDeployEnabled: true,
        },
        'Auto-deploy enabled successfully',
        HTTP_STATUS.CREATED
      );
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Disable auto-deploy (deletes GitHub webhook)
 * POST /api/projects/:projectId/webhooks/disable
 */
router.post(
  '/:projectId/webhooks/disable',
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

      // Get project details
      const projectResult = await query(
        `
        SELECT id, user_id, repository_url, github_webhook_id 
        FROM projects 
        WHERE id = $1 AND deleted_at IS NULL
        `,
        [req.params.projectId]
      );

      if (projectResult.rows.length === 0) {
        sendError(res, HTTP_STATUS.NOT_FOUND, ERROR_CODES.PROJECT_NOT_FOUND, 'Project not found');
        return;
      }

      const project = projectResult.rows[0];

      if (project.user_id !== req.user.userId) {
        sendError(
          res,
          HTTP_STATUS.FORBIDDEN,
          ERROR_CODES.INSUFFICIENT_PERMISSIONS,
          'You do not have permission to modify this project'
        );
        return;
      }

      // Check if GitHub token exists
      const githubToken = await GitHubOAuthService.getGitHubToken(req.user.userId);
      if (!githubToken) {
        sendError(
          res,
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR,
          'GitHub account not connected'
        );
        return;
      }

      // Parse repository URL
      const repoInfo = GitHubOAuthService.parseRepositoryUrl(project.repository_url);
      if (!repoInfo) {
        sendError(
          res,
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR,
          'Invalid repository URL format'
        );
        return;
      }

      // Delete GitHub webhook if exists
      if (project.github_webhook_id) {
        try {
          await GitHubOAuthService.deleteWebhook(
            repoInfo.owner,
            repoInfo.repo,
            project.github_webhook_id,
            githubToken.token
          );
        } catch (error) {
          console.error('Error deleting GitHub webhook:', error);
          // Continue anyway - webhook might already be deleted
        }
      }

      // Update project
      await query(
        `
        UPDATE projects 
        SET auto_deploy_enabled = false,
            webhook_secret = NULL,
            github_webhook_id = NULL
        WHERE id = $1
        `,
        [req.params.projectId]
      );

      sendSuccess(res, {}, 'Auto-deploy disabled successfully');
    } catch (error) {
      next(error);
    }
  }
);

export default router;
