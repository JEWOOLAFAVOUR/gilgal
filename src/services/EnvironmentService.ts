import { query } from '../database';
import { Environment, CreateEnvironmentRequest } from '../types';
import { HTTP_STATUS, ERROR_CODES } from '../constants';
import { ApiError } from '../utils/error';
import { v4 as uuidv4 } from 'uuid';

/**
 * Environment Service
 * Manages deployment environments (production, staging, development) for projects
 */
export class EnvironmentService {
  /**
   * Create a new environment for a project
   */
  static async createEnvironment(projectId: string, userId: string, data: CreateEnvironmentRequest): Promise<Environment> {
    // Verify project ownership
    const projectCheck = await query(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [projectId, userId]
    );

    if (projectCheck.rowCount === 0) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.PROJECT_NOT_FOUND, 'Project not found');
    }

    const environmentId = uuidv4();

    const result = await query<Environment>(
      `
      INSERT INTO environments (id, project_id, name, type, domain, environment_variables)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, project_id, name, type, domain, environment_variables, created_at, updated_at
      `,
      [
        environmentId,
        projectId,
        data.name,
        data.type,
        data.domain || null,
        JSON.stringify(data.environmentVariables || {}),
      ]
    );

    if (result.rowCount === 0) {
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.DATABASE_ERROR,
        'Failed to create environment'
      );
    }

    return result.rows[0];
  }

  /**
   * Get environments for a project
   */
  static async getProjectEnvironments(projectId: string, userId: string): Promise<Environment[]> {
    // Verify project ownership
    const projectCheck = await query(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [projectId, userId]
    );

    if (projectCheck.rowCount === 0) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.PROJECT_NOT_FOUND, 'Project not found');
    }

    const result = await query<Environment>(
      `
      SELECT id, project_id, name, type, domain, environment_variables, created_at, updated_at
      FROM environments
      WHERE project_id = $1 AND deleted_at IS NULL
      ORDER BY created_at ASC
      `,
      [projectId]
    );

    return result.rows;
  }

  /**
   * Get environment by ID with ownership verification
   */
  static async getEnvironment(environmentId: string, userId: string): Promise<Environment> {
    const result = await query<Environment>(
      `
      SELECT e.id, e.project_id, e.name, e.type, e.domain, e.environment_variables, e.created_at, e.updated_at
      FROM environments e
      JOIN projects p ON e.project_id = p.id
      WHERE e.id = $1 AND p.user_id = $2 AND e.deleted_at IS NULL
      `,
      [environmentId, userId]
    );

    if (result.rowCount === 0) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, 'Environment not found');
    }

    return result.rows[0];
  }

  /**
   * Update environment variables and settings
   */
  static async updateEnvironment(
    environmentId: string,
    userId: string,
    data: Partial<CreateEnvironmentRequest>
  ): Promise<Environment> {
    // Verify ownership
    await this.getEnvironment(environmentId, userId);

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(data.name);
    }
    if (data.domain !== undefined) {
      updates.push(`domain = $${paramCount++}`);
      values.push(data.domain);
    }
    if (data.environmentVariables !== undefined) {
      updates.push(`environment_variables = $${paramCount++}`);
      values.push(JSON.stringify(data.environmentVariables));
    }

    if (updates.length === 0) {
      return this.getEnvironment(environmentId, userId);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(environmentId);

    const result = await query<Environment>(
      `
      UPDATE environments
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, project_id, name, type, domain, environment_variables, created_at, updated_at
      `,
      values
    );

    if (result.rowCount === 0) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, 'Environment not found');
    }

    return result.rows[0];
  }

  /**
   * Delete environment (soft delete)
   */
  static async deleteEnvironment(environmentId: string, userId: string): Promise<void> {
    // Verify ownership
    await this.getEnvironment(environmentId, userId);

    const result = await query(
      'UPDATE environments SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1',
      [environmentId]
    );

    if (result.rowCount === 0) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, 'Environment not found');
    }
  }
}
