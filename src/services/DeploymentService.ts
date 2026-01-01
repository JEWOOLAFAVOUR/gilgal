import { query, transaction } from '../database';
import { Deployment, DeploymentLog, CreateDeploymentRequest } from '../types';
import { HTTP_STATUS, ERROR_CODES, DEPLOYMENT_STATUS } from '../constants';
import { ApiError } from '../utils/error';
import { DockerService } from './DockerService';
import { NginxConfigService } from './NginxConfigService';
import { v4 as uuidv4 } from 'uuid';

/**
 * Deployment Service
 * Orchestrates the deployment process including building, running, and monitoring containers
 */
export class DeploymentService {
  /**
   * Create and trigger a new deployment
   * Orchestrates the entire deployment pipeline
   */
  static async createDeployment(
    projectId: string,
    userId: string,
    data: CreateDeploymentRequest
  ): Promise<Deployment> {
    const deploymentId = uuidv4();

    // Verify project ownership
    const projectCheck = await query(
      'SELECT id, repository_url FROM projects WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [projectId, userId]
    );

    if (projectCheck.rowCount === 0) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.PROJECT_NOT_FOUND, 'Project not found');
    }

    // Verify environment exists and belongs to project
    const envCheck = await query(
      'SELECT id FROM environments WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL',
      [data.environmentId, projectId]
    );

    if (envCheck.rowCount === 0) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, 'Environment not found');
    }

    // Create deployment record
    const result = await query<Deployment>(
      `
      INSERT INTO deployments (id, project_id, environment_id, commit_sha, commit_message, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, project_id, environment_id, commit_sha, commit_message, status, 
                duration_seconds, deployed_at, container_id, error_message, created_at, updated_at
      `,
      [
        deploymentId,
        projectId,
        data.environmentId,
        data.commitSha || null,
        data.commitMessage || null,
        DEPLOYMENT_STATUS.PENDING,
      ]
    );

    if (result.rowCount === 0) {
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.DATABASE_ERROR,
        'Failed to create deployment'
      );
    }

    const deployment = result.rows[0];

    // Trigger deployment pipeline asynchronously
    this.executeDeployment(deploymentId, projectId, data.environmentId, userId).catch((error) => {
      console.error('[Deployment] Pipeline error:', error);
    });

    return deployment;
  }

  /**
   * Execute an existing deployment (for webhooks)
   * Triggers the build and deployment process asynchronously
   */
  static async executeWebhookDeployment(deploymentId: string): Promise<void> {
    try {
      // Fetch deployment details
      const result = await query(
        `SELECT d.id, d.project_id, d.environment_id
         FROM deployments d
         WHERE d.id = $1`,
        [deploymentId]
      );

      if (result.rows.length === 0) {
        console.error(`[Webhook] Deployment not found: ${deploymentId}`);
        return;
      }

      const deployment = result.rows[0];

      // Get the project owner's user ID for deployment tracking
      const projectResult = await query('SELECT user_id FROM projects WHERE id = $1', [
        deployment.project_id,
      ]);

      if (projectResult.rows.length === 0) {
        console.error(`[Webhook] Project not found: ${deployment.project_id}`);
        return;
      }

      const userId = projectResult.rows[0].user_id;

      // Trigger deployment asynchronously
      this.executeDeployment(
        deployment.id,
        deployment.project_id,
        deployment.environment_id,
        userId
      ).catch((error) => {
        console.error(`[Webhook] Error executing deployment ${deploymentId}:`, error);
      });
    } catch (error) {
      console.error(`[Webhook] Error in executeWebhookDeployment:`, error);
    }
  }

  /**
   * Execute the deployment pipeline asynchronously
   * Builds image, runs container, and updates status
   */
  private static async executeDeployment(
    deploymentId: string,
    projectId: string,
    environmentId: string,
    userId: string
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Update status to building
      await query('UPDATE deployments SET status = $1 WHERE id = $2', [
        DEPLOYMENT_STATUS.BUILDING,
        deploymentId,
      ]);

      await this.addDeploymentLog(deploymentId, 'info', 'Starting deployment pipeline...');

      // Get environment configuration
      const envResult = await query<any>(
        'SELECT environment_variables FROM environments WHERE id = $1',
        [environmentId]
      );

      const envVariables = envResult.rows[0]?.environment_variables || {};

      // Get project repository URL
      const projectResult = await query('SELECT repository_url FROM projects WHERE id = $1', [
        projectId,
      ]);
      const repositoryUrl = projectResult.rows[0]?.repository_url;

      // Build Docker image
      await this.addDeploymentLog(deploymentId, 'info', 'Building Docker image...');
      const { imageId, imageName, framework } = await DockerService.buildImage(
        projectId,
        deploymentId,
        repositoryUrl
      );

      await this.addDeploymentLog(deploymentId, 'info', `Docker image built: ${imageName}`);

      // Run container
      await this.addDeploymentLog(deploymentId, 'info', 'Starting container...');
      const { containerId, port } = await DockerService.runContainer(
        imageName,
        projectId,
        environmentId,
        envVariables,
        framework
      );

      await this.addDeploymentLog(deploymentId, 'info', `Container running on port ${port}`);

      // Update deployment with success status
      const duration = Math.floor((Date.now() - startTime) / 1000);

      await query(
        `
        UPDATE deployments 
        SET status = $1, container_id = $2, container_port = $3, duration_seconds = $4, deployed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
        `,
        [DEPLOYMENT_STATUS.SUCCESS, containerId, port, duration, deploymentId]
      );

      await this.addDeploymentLog(
        deploymentId,
        'info',
        `Deployment completed successfully in ${duration}s`
      );

      // Regenerate nginx config with new deployment
      await this.addDeploymentLog(deploymentId, 'info', 'Updating nginx configuration...');
      try {
        await NginxConfigService.applyNginxConfig();
        await this.addDeploymentLog(
          deploymentId,
          'info',
          'Nginx configuration updated - app now accessible at subdomain'
        );
      } catch (nginxError) {
        console.warn('[Deployment] Nginx config update failed:', nginxError);
        await this.addDeploymentLog(
          deploymentId,
          'warn',
          'Deployment successful but nginx config update failed (may require manual setup)'
        );
      }

      console.log(`[Deployment] Deployment ${deploymentId} completed successfully`);
    } catch (error) {
      const duration = Math.floor((Date.now() - startTime) / 1000);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await query(
        `
        UPDATE deployments 
        SET status = $1, error_message = $2, duration_seconds = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        `,
        [DEPLOYMENT_STATUS.FAILED, errorMessage, duration, deploymentId]
      );

      await this.addDeploymentLog(deploymentId, 'error', `Deployment failed: ${errorMessage}`);

      console.error(`[Deployment] Deployment ${deploymentId} failed:`, error);
    }
  }

  /**
   * Get deployments for a project
   */
  static async getProjectDeployments(
    projectId: string,
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ deployments: Deployment[]; total: number }> {
    // Verify project ownership
    const projectCheck = await query(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [projectId, userId]
    );

    if (projectCheck.rowCount === 0) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.PROJECT_NOT_FOUND, 'Project not found');
    }

    const deploymentsResult = await query<Deployment>(
      `
      SELECT id, project_id, environment_id, commit_sha, commit_message, status, 
             duration_seconds, deployed_at, container_id, error_message, created_at, updated_at
      FROM deployments
      WHERE project_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
      `,
      [projectId, limit, offset]
    );

    const countResult = await query<{ count: number }>(
      'SELECT COUNT(*) as count FROM deployments WHERE project_id = $1',
      [projectId]
    );

    return {
      deployments: deploymentsResult.rows,
      total: parseInt(String(countResult.rows[0]?.count || '0'), 10),
    };
  }

  /**
   * Get deployment by ID
   */
  static async getDeployment(deploymentId: string, userId: string): Promise<Deployment> {
    const result = await query<Deployment>(
      `
      SELECT d.id, d.project_id, d.environment_id, d.commit_sha, d.commit_message, d.status,
             d.duration_seconds, d.deployed_at, d.container_id, d.error_message, d.created_at, d.updated_at
      FROM deployments d
      JOIN projects p ON d.project_id = p.id
      WHERE d.id = $1 AND p.user_id = $2
      `,
      [deploymentId, userId]
    );

    if (result.rowCount === 0) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, 'Deployment not found');
    }

    return result.rows[0];
  }

  /**
   * Get deployment logs
   */
  static async getDeploymentLogs(deploymentId: string, userId: string): Promise<DeploymentLog[]> {
    // Verify access
    const deployCheck = await query(
      `
      SELECT d.id FROM deployments d
      JOIN projects p ON d.project_id = p.id
      WHERE d.id = $1 AND p.user_id = $2
      `,
      [deploymentId, userId]
    );

    if (deployCheck.rowCount === 0) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, 'Deployment not found');
    }

    const result = await query<DeploymentLog>(
      `
      SELECT id, deployment_id, log_level, message, timestamp
      FROM deployment_logs
      WHERE deployment_id = $1
      ORDER BY timestamp ASC
      `,
      [deploymentId]
    );

    return result.rows;
  }

  /**
   * Add log entry to deployment
   */
  static async addDeploymentLog(
    deploymentId: string,
    level: string,
    message: string
  ): Promise<void> {
    await query(
      `
      INSERT INTO deployment_logs (id, deployment_id, log_level, message)
      VALUES ($1, $2, $3, $4)
      `,
      [uuidv4(), deploymentId, level, message]
    );
  }

  /**
   * Rollback deployment to previous version
   */
  static async rollbackDeployment(deploymentId: string, userId: string): Promise<Deployment> {
    // Get current deployment
    const currentDeployment = await this.getDeployment(deploymentId, userId);

    // Find previous successful deployment
    const previousResult = await query<Deployment>(
      `
      SELECT id, project_id, environment_id, commit_sha, commit_message, status,
             duration_seconds, deployed_at, container_id, error_message, created_at, updated_at
      FROM deployments
      WHERE project_id = $1 AND environment_id = $2 AND status = $3 AND created_at < $4
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [
        currentDeployment.projectId,
        currentDeployment.environmentId,
        DEPLOYMENT_STATUS.SUCCESS,
        currentDeployment.createdAt,
      ]
    );

    if (previousResult.rowCount === 0) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        'No previous successful deployment found'
      );
    }

    const previousDeployment = previousResult.rows[0];

    // Stop current container
    if (currentDeployment.containerId) {
      try {
        await DockerService.stopContainer(currentDeployment.containerId);
      } catch (error) {
        console.error('[Deployment] Failed to stop current container:', error);
      }
    }

    // Restart previous container (in production, this would be more sophisticated)
    await this.addDeploymentLog(
      deploymentId,
      'info',
      `Rolling back to deployment ${previousDeployment.id}`
    );

    return previousDeployment;
  }

  /**
   * Cancel deployment
   */
  static async cancelDeployment(deploymentId: string, userId: string): Promise<void> {
    const deployment = await this.getDeployment(deploymentId, userId);

    if (
      deployment.status !== DEPLOYMENT_STATUS.PENDING &&
      deployment.status !== DEPLOYMENT_STATUS.BUILDING
    ) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        'Cannot cancel completed deployment'
      );
    }

    // Stop container if running
    if (deployment.containerId) {
      try {
        await DockerService.stopContainer(deployment.containerId);
      } catch (error) {
        console.error('[Deployment] Failed to stop container:', error);
      }
    }

    await query(
      'UPDATE deployments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['cancelled', deploymentId]
    );

    await this.addDeploymentLog(deploymentId, 'info', 'Deployment cancelled by user');
  }
}
