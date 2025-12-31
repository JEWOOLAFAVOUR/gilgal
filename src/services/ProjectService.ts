import { query } from '../database';
import { Project, CreateProjectRequest } from '../types';
import { HTTP_STATUS, ERROR_CODES } from '../constants';
import { ApiError } from '../utils/error';
import { DockerService } from './DockerService';
import { v4 as uuidv4 } from 'uuid';

/**
 * Project Service
 * Handles all project-related business logic
 */
export class ProjectService {
  /**
   * Create a new project
   */
  static async createProject(userId: string, data: CreateProjectRequest): Promise<Project> {
    const projectId = uuidv4();
    const slug = data.name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]/g, '');

    // Validation: Check if slug already exists for an active project BEFORE doing expensive operations
    try {
      const slugCheck = await query(
        'SELECT id FROM projects WHERE slug = $1 AND deleted_at IS NULL',
        [slug]
      );

      if (slugCheck.rowCount > 0) {
        throw new ApiError(
          HTTP_STATUS.CONFLICT,
          ERROR_CODES.VALIDATION_ERROR,
          `Project name "${data.name}" already exists. Please use a different name.`
        );
      }
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      console.error('[Project] Slug validation error:', error);
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.DATABASE_ERROR,
        'Failed to validate project name'
      );
    }

    // Auto-detect framework from repo if URL provided (only after slug validation)
    let framework = data.framework || 'node';
    if (data.repositoryUrl) {
      try {
        console.log(`[Project] Auto-detecting framework for ${data.repositoryUrl}`);
        const detectedFramework = await DockerService.detectFramework(data.repositoryUrl);

        if (detectedFramework && detectedFramework !== 'node') {
          console.log(
            `[Project] Framework auto-detected: ${detectedFramework} (user provided: ${framework})`
          );
          framework = detectedFramework;
        }
      } catch (error) {
        console.error(`[Project] Framework detection failed, using provided: ${framework}`, error);
        // Use provided framework if detection fails
      }
    }

    const result = await query<Project>(
      `
      INSERT INTO projects (id, user_id, name, slug, description, repository_url, framework)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, user_id, name, slug, description, repository_url, framework, status, created_at, updated_at
      `,
      [
        projectId,
        userId,
        data.name,
        slug,
        data.description || null,
        data.repositoryUrl || null,
        framework,
      ]
    );

    if (result.rowCount === 0) {
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.DATABASE_ERROR,
        'Failed to create project'
      );
    }

    return result.rows[0];
  }

  /**
   * Get projects for a user
   */
  static async getUserProjects(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ projects: Project[]; total: number }> {
    const projectsResult = await query<Project>(
      `
      SELECT id, user_id, name, slug, description, repository_url, framework, status, created_at, updated_at
      FROM projects
      WHERE user_id = $1 AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
      `,
      [userId, limit, offset]
    );

    const countResult = await query<{ count: number }>(
      'SELECT COUNT(*) as count FROM projects WHERE user_id = $1 AND deleted_at IS NULL',
      [userId]
    );

    return {
      projects: projectsResult.rows,
      total: parseInt(String(countResult.rows[0]?.count || '0'), 10),
    };
  }

  /**
   * Get project by ID with ownership verification
   */
  static async getProject(projectId: string, userId?: string): Promise<Project> {
    let query_text = `
      SELECT id, user_id, name, slug, description, repository_url, framework, status, created_at, updated_at
      FROM projects
      WHERE id = $1 AND deleted_at IS NULL
    `;
    const params: any[] = [projectId];

    if (userId) {
      query_text += ' AND user_id = $2';
      params.push(userId);
    }

    const result = await query<Project>(query_text, params);

    if (result.rowCount === 0) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.PROJECT_NOT_FOUND, 'Project not found');
    }

    return result.rows[0];
  }

  /**
   * Update project
   */
  static async updateProject(
    projectId: string,
    userId: string,
    data: Partial<CreateProjectRequest>
  ): Promise<Project> {
    // Verify ownership
    await this.getProject(projectId, userId);

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(data.description);
    }
    if (data.repositoryUrl !== undefined) {
      updates.push(`repository_url = $${paramCount++}`);
      values.push(data.repositoryUrl);
    }

    if (updates.length === 0) {
      return this.getProject(projectId, userId);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(projectId);
    values.push(userId);

    const result = await query<Project>(
      `
      UPDATE projects
      SET ${updates.join(', ')}
      WHERE id = $${paramCount++} AND user_id = $${paramCount}
      RETURNING id, user_id, name, slug, description, repository_url, framework, status, created_at, updated_at
      `,
      values
    );

    if (result.rowCount === 0) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.PROJECT_NOT_FOUND, 'Project not found');
    }

    return result.rows[0];
  }

  /**
   * Delete project (soft delete)
   */
  static async deleteProject(projectId: string, userId: string): Promise<void> {
    // Verify ownership
    await this.getProject(projectId, userId);

    const result = await query(
      'UPDATE projects SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2',
      [projectId, userId]
    );

    if (result.rowCount === 0) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.PROJECT_NOT_FOUND, 'Project not found');
    }
  }
}
