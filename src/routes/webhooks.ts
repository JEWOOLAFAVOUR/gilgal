import express, { Router, Request, Response, NextFunction } from 'express';
import { query } from '../database';
import { WebhookService } from '../services/WebhookService';
import { sendSuccess, sendError } from '../utils/error';
import { HTTP_STATUS } from '../constants';

const router = Router();

/**
 * Custom middleware to parse raw body and make it available as both raw and parsed JSON
 */
const parseWebhookBody = (req: Request, res: Response, next: NextFunction) => {
  if (Buffer.isBuffer(req.body)) {
    // Store raw body for signature verification
    (req as any).rawBody = req.body.toString('utf-8');
    // Parse JSON
    try {
      req.body = JSON.parse((req as any).rawBody);
    } catch {
      return sendError(
        res,
        HTTP_STATUS.BAD_REQUEST,
        'INVALID_JSON',
        'Request body is not valid JSON'
      );
    }
  }
  next();
};

router.use(parseWebhookBody);

/**
 * POST /webhooks/github/:projectId
 * GitHub webhook endpoint for automatic deployments
 * Requires: X-Hub-Signature-256 header with HMAC-SHA256 signature
 */
router.post('/github/:projectId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    const signature = req.headers['x-hub-signature-256'] as string;
    const rawBody = (req as any).rawBody;

    if (!signature) {
      return sendError(
        res,
        HTTP_STATUS.UNAUTHORIZED,
        'MISSING_SIGNATURE',
        'Missing X-Hub-Signature-256 header'
      );
    }

    // Get the webhook secret for this project
    const result = await query(
      'SELECT webhook_secret FROM projects WHERE id = $1 AND deleted_at IS NULL',
      [projectId]
    );

    if (result.rows.length === 0) {
      return sendError(res, HTTP_STATUS.NOT_FOUND, 'PROJECT_NOT_FOUND', 'Project not found');
    }

    const webhookSecret = result.rows[0].webhook_secret;

    if (!webhookSecret) {
      return sendError(
        res,
        HTTP_STATUS.BAD_REQUEST,
        'WEBHOOK_NOT_CONFIGURED',
        'Webhook is not configured for this project. Generate a secret first.'
      );
    }

    // Verify GitHub signature
    try {
      WebhookService.verifySignature(rawBody, signature, webhookSecret);
    } catch (error) {
      return sendError(
        res,
        HTTP_STATUS.UNAUTHORIZED,
        'INVALID_SIGNATURE',
        'Invalid webhook signature'
      );
    }

    // Check event type
    const eventType = req.headers['x-github-event'] as string;

    if (eventType === 'push') {
      const result = await WebhookService.handlePushWebhook(req.body, projectId);

      if (!result.success) {
        return sendError(res, HTTP_STATUS.BAD_REQUEST, 'WEBHOOK_FAILED', result.message);
      }

      return sendSuccess(res, { deploymentId: result.deploymentId }, result.message);
    } else if (eventType === 'ping') {
      return sendSuccess(res, { message: 'Webhook is configured correctly' }, 'Pong!');
    } else {
      return sendSuccess(res, { ignored: true }, `Event type '${eventType}' is not handled`);
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /webhooks/github/:projectId/generate-secret
 * Generate a new webhook secret for a project
 * Requires authentication
 */
router.post(
  '/github/:projectId/generate-secret',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { projectId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        return sendError(res, HTTP_STATUS.UNAUTHORIZED, 'UNAUTHORIZED', 'Authentication required');
      }

      // Verify the user owns this project
      const result = await query(
        'SELECT id FROM projects WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
        [projectId, userId]
      );

      if (result.rows.length === 0) {
        return sendError(
          res,
          HTTP_STATUS.FORBIDDEN,
          'ACCESS_DENIED',
          'You do not have access to this project'
        );
      }

      // Generate new secret
      const newSecret = WebhookService.generateSecret();

      // Update project with new secret
      await query(
        'UPDATE projects SET webhook_secret = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newSecret, projectId]
      );

      const webhookUrl = `https://api.gilgal.tech/webhooks/github/${projectId}`;

      return sendSuccess(
        res,
        {
          secret: newSecret,
          webhookUrl,
          instructions: `Add this webhook to your GitHub repository: Settings > Webhooks > Add webhook\n- Payload URL: ${webhookUrl}\n- Content type: application/json\n- Secret: ${newSecret}\n- Events: Push events`,
        },
        'Webhook secret generated'
      );
    } catch (error) {
      next(error);
    }
  }
);

export default router;
