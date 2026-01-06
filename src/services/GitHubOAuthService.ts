import config from '../config';
import { query } from '../database';
import { HTTP_STATUS, ERROR_CODES } from '../constants';
import { ApiError } from '../utils/error';

/**
 * GitHub OAuth Service
 * Handles GitHub OAuth flow and webhook management
 */
export class GitHubOAuthService {
  private static readonly GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';
  private static readonly GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
  private static readonly GITHUB_API_URL = 'https://api.github.com';

  /**
   * Get GitHub OAuth authorization URL
   * Redirect user to this URL to start OAuth flow
   */
  static getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: config.github.clientId,
      redirect_uri: config.github.callbackUrl,
      scope: 'repo admin:repo_hook user',
      state,
      allow_signup: 'true',
    });

    return `${this.GITHUB_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  static async exchangeCodeForToken(code: string): Promise<{
    access_token: string;
    token_type: string;
    scope: string;
  }> {
    const response = await fetch(this.GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: config.github.clientId,
        client_secret: config.github.clientSecret,
        code,
        redirect_uri: config.github.callbackUrl,
      }),
    });

    if (!response.ok) {
      const error = (await response.json()) as any;
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.INVALID_TOKEN,
        `GitHub OAuth failed: ${error.error_description || 'Unknown error'}`
      );
    }

    const data = (await response.json()) as {
      access_token: string;
      token_type: string;
      scope: string;
    };
    return data;
  }

  /**
   * Get GitHub user info
   */
  static async getUserInfo(accessToken: string): Promise<{
    id: number;
    login: string;
    name: string;
    email: string;
    avatar_url: string;
  }> {
    const response = await fetch(`${this.GITHUB_API_URL}/user`, {
      headers: {
        Authorization: `token ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new ApiError(
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.UNAUTHORIZED,
        'Failed to fetch GitHub user info'
      );
    }

    return (await response.json()) as {
      id: number;
      login: string;
      name: string;
      email: string;
      avatar_url: string;
    };
  }

  /**
   * Create webhook on GitHub repository
   */
  static async createWebhook(
    owner: string,
    repo: string,
    accessToken: string,
    webhookUrl: string,
    secret: string
  ): Promise<{ id: string }> {
    const response = await fetch(`${this.GITHUB_API_URL}/repos/${owner}/${repo}/hooks`, {
      method: 'POST',
      headers: {
        Authorization: `token ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'web',
        active: true,
        events: ['push'],
        config: {
          url: webhookUrl,
          content_type: 'json',
          secret,
          insecure_ssl: '0',
        },
      }),
    });

    if (!response.ok) {
      const error = (await response.json()) as any;
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        `Failed to create webhook: ${error.message || 'Unknown error'}`
      );
    }

    const data = (await response.json()) as any;
    return { id: data.id };
  }

  /**
   * Delete webhook from GitHub repository
   */
  static async deleteWebhook(
    owner: string,
    repo: string,
    hookId: string,
    accessToken: string
  ): Promise<void> {
    const response = await fetch(`${this.GITHUB_API_URL}/repos/${owner}/${repo}/hooks/${hookId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `token ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok && response.status !== 404) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        'Failed to delete webhook'
      );
    }
  }

  /**
   * Get repository info to extract owner and repo name from URL
   */
  static parseRepositoryUrl(repoUrl: string): { owner: string; repo: string } | null {
    // Handle both https://github.com/owner/repo and git@github.com:owner/repo
    const httpsMatch = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?$/);
    const sshMatch = repoUrl.match(/git@github\.com:([^\/]+)\/([^\/]+?)(?:\.git)?$/);

    const match = httpsMatch || sshMatch;
    if (match) {
      return { owner: match[1], repo: match[2] };
    }

    return null;
  }

  /**
   * Store GitHub token for user
   */
  static async storeGitHubToken(
    userId: string,
    accessToken: string,
    githubUsername: string
  ): Promise<void> {
    // GitHub tokens don't expire by default, but set a long expiry for safety
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    await query(
      `
      UPDATE users 
      SET github_token = $1, 
          github_token_expires_at = $2,
          github_username = $3
      WHERE id = $4
      `,
      [accessToken, expiresAt, githubUsername, userId]
    );
  }

  /**
   * Get stored GitHub token for user
   */
  static async getGitHubToken(userId: string): Promise<{ token: string; username: string } | null> {
    const result = await query(
      `
      SELECT github_token, github_username
      FROM users
      WHERE id = $1 AND github_token IS NOT NULL
      `,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      token: row.github_token,
      username: row.github_username,
    };
  }

  /**
   * Get user's repositories from GitHub
   */
  static async getUserRepositories(
    accessToken: string,
    page: number = 1,
    perPage: number = 30
  ): Promise<
    Array<{
      id: number;
      name: string;
      full_name: string;
      description: string | null;
      url: string;
      html_url: string;
      language: string | null;
      stargazers_count: number;
      forks_count: number;
      private: boolean;
    }>
  > {
    const response = await fetch(
      `${this.GITHUB_API_URL}/user/repos?page=${page}&per_page=${perPage}&sort=updated&direction=desc`,
      {
        headers: {
          Authorization: `token ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (!response.ok) {
      throw new ApiError(
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.UNAUTHORIZED,
        'Failed to fetch GitHub repositories'
      );
    }

    return (await response.json()) as Array<{
      id: number;
      name: string;
      full_name: string;
      description: string | null;
      url: string;
      html_url: string;
      language: string | null;
      stargazers_count: number;
      forks_count: number;
      private: boolean;
    }>;
  }
}
