/**
 * HTTP Status Codes and Error Handling Constants
 */

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

export const ERROR_CODES = {
  // Authentication errors
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',

  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_EMAIL: 'INVALID_EMAIL',
  WEAK_PASSWORD: 'WEAK_PASSWORD',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  USERNAME_ALREADY_EXISTS: 'USERNAME_ALREADY_EXISTS',

  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  RESOURCE_DELETED: 'RESOURCE_DELETED',

  // Permission errors
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',

  // Server errors
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
};

export const API_ROUTES = {
  // Health
  HEALTH: '/health',

  // Authentication
  AUTH_REGISTER: '/api/auth/register',
  AUTH_LOGIN: '/api/auth/login',
  AUTH_LOGOUT: '/api/auth/logout',
  AUTH_REFRESH: '/api/auth/refresh',

  // Users
  USERS_ME: '/api/users/me',
  USERS_UPDATE: '/api/users/:id',

  // Projects
  PROJECTS_LIST: '/api/projects',
  PROJECTS_CREATE: '/api/projects',
  PROJECTS_GET: '/api/projects/:id',
  PROJECTS_UPDATE: '/api/projects/:id',
  PROJECTS_DELETE: '/api/projects/:id',

  // Environments
  ENVIRONMENTS_LIST: '/api/projects/:projectId/environments',
  ENVIRONMENTS_CREATE: '/api/projects/:projectId/environments',
  ENVIRONMENTS_DELETE: '/api/environments/:id',

  // Deployments
  DEPLOYMENTS_LIST: '/api/projects/:projectId/deployments',
  DEPLOYMENTS_CREATE: '/api/projects/:projectId/deployments',
  DEPLOYMENTS_GET: '/api/deployments/:id',
  DEPLOYMENTS_LOGS: '/api/deployments/:id/logs',
};

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};

export const DEPLOYMENT_STATUS = {
  PENDING: 'pending',
  BUILDING: 'building',
  SUCCESS: 'success',
  FAILED: 'failed',
};

export const PROJECT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ARCHIVED: 'archived',
};

export const ENVIRONMENT_TYPES = {
  PRODUCTION: 'production',
  STAGING: 'staging',
  DEVELOPMENT: 'development',
};
