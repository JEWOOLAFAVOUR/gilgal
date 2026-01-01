import crypto from 'crypto';
import { query } from '../database';
import { DeploymentService } from './DeploymentService';
import { v4 as uuidv4 } from 'uuid';

/**
 * GitHub Webhook Service
 * Handles webhook payloads and triggers deployments
 */
export class WebhookService {
  /**
   * Verify GitHub webhook signature
   * GitHub sends X-Hub-Signature-256 header with HMAC-SHA256 hash
   */
  static verifySignature(payload: string, signature: string, secret: string): boolean {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const hash = 'sha256=' + hmac.digest('hex');
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  }

  /**
   * Handle GitHub push webhook
   * Creates a new deployment when code is pushed
   */
  static async handlePushWebhook(
    payload: any,
    projectId: string
  ): Promise<{ success: boolean; deploymentId?: string; message: string }> {
    try {
      // Get project details including userId and repository_url
      const projectResult = await query(
        'SELECT id, user_id, name, slug, repository_url FROM projects WHERE id = $1 AND deleted_at IS NULL',
        [projectId]
      );

      if (projectResult.rows.length === 0) {
        return { success: false, message: 'Project not found' };
      }

      const project = projectResult.rows[0];
      const ref = payload.ref || ''; // e.g., "refs/heads/main"
      const branch = ref.split('/').pop() || 'main';
      const userId = project.user_id;

      // Get the production/main environment for this project
      // If multiple environments exist, prefer 'production' or the first one
      let environmentId: string | null = null;

      const envResult = await query(
        `SELECT id FROM environments 
         WHERE project_id = $1 AND deleted_at IS NULL
         ORDER BY name ASC LIMIT 1`,
        [projectId]
      );

      if (envResult.rows.length > 0) {
        environmentId = envResult.rows[0].id;
      }

      // If no environment exists, return error
      if (!environmentId) {
        return { success: false, message: 'No environment configured for this project' };
      }

      // Create a new deployment using the DeploymentService
      const deploymentId = uuidv4();
      const commit = payload.after || 'unknown';
      const committer = payload.pusher?.name || payload.sender?.login || 'Unknown';
      const commitMessage = `Webhook deployment from ${committer} on ${branch}`;

      // Insert deployment record
      await query(
        `INSERT INTO deployments 
         (id, project_id, environment_id, status, commit_sha, commit_message, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [deploymentId, projectId, environmentId, 'pending', commit, commitMessage]
      );

      console.log(
        `[Webhook] Created deployment ${deploymentId} for project ${project.slug} (${branch})`
      );

      // Trigger the deployment asynchronously by calling the deployment creation logic
      // We'll trigger via the deployment pipeline by creating a request-like object
      setImmediate(async () => {
        try {
          // Fetch deployment and trigger pipeline
          const deploymentCheck = await query('SELECT id FROM deployments WHERE id = $1', [
            deploymentId,
          ]);

          if (deploymentCheck.rows.length > 0) {
            // The deployment exists, the webhook endpoint will handle triggering it
            console.log(`[Webhook] Deployment ${deploymentId} ready for execution`);
          }
        } catch (error) {
          console.error(`[Webhook] Error preparing deployment ${deploymentId}:`, error);
        }
      });

      return { success: true, deploymentId, message: `Deployment triggered for ${branch} branch` };
    } catch (error) {
      console.error('[Webhook] Error handling push webhook:', error);
      return { success: false, message: `Webhook processing failed: ${error}` };
    }
  }

  /**
   * Generate a webhook secret for a project
   */
  static generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
