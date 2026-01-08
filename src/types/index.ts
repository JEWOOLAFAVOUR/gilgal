/**
 * Type definitions for API responses
 */

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message: string;
  error?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * User related types
 */
export interface User {
  id: string;
  email: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
  bio?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserRequest {
  email: string;
  username: string;
  password: string;
  fullName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Project related types
 */
export interface Project {
  id: string;
  userId: string;
  name: string;
  slug: string;
  description?: string;
  repositoryUrl?: string;
  deployedUrl?: string;
  framework: string;
  status: 'active' | 'inactive' | 'archived' | 'success' | 'deploying';
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  repositoryUrl?: string;
  framework: string;
  status?: 'active' | 'inactive' | 'deploying' | 'failed';
}

/**
 * Environment related types
 */
export interface Environment {
  id: string;
  projectId: string;
  name: string;
  type: 'production' | 'staging' | 'development';
  domain?: string;
  environmentVariables: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEnvironmentRequest {
  name: string;
  type: 'production' | 'staging' | 'development';
  domain?: string;
  environmentVariables?: Record<string, string>;
}

/**
 * Deployment related types
 */
export interface Deployment {
  id: string;
  projectId: string;
  environmentId: string;
  commitSha?: string;
  commitMessage?: string;
  status: 'pending' | 'building' | 'success' | 'failed';
  durationSeconds?: number;
  deployedAt?: Date;
  containerId?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDeploymentRequest {
  environmentId: string;
  commitSha?: string;
  commitMessage?: string;
}

/**
 * Deployment Log related types
 */
export interface DeploymentLog {
  id: string;
  deploymentId: string;
  logLevel: 'info' | 'warning' | 'error' | 'debug';
  message: string;
  timestamp: Date;
}

/**
 * API Key related types
 */
export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  lastUsedAt?: Date;
  createdAt: Date;
}

/**
 * JWT Token Payload
 */
export interface JwtPayload {
  userId: string;
  email: string;
  username: string;
  iat: number;
  exp: number;
}
