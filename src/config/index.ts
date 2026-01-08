import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server Configuration
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',

  // Database Configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    name: process.env.DB_NAME || 'gilgal_dev',
    url: process.env.DATABASE_URL,
  },

  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiry: process.env.JWT_EXPIRY || '7d',
  },

  // CORS Configuration
  cors: {
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:5173').split(','),
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
  },

  // Docker Registry (for user application containerization)
  docker: {
    registry: process.env.DOCKER_REGISTRY || 'docker.io',
    username: process.env.DOCKER_REGISTRY_USERNAME || '',
    password: process.env.DOCKER_REGISTRY_PASSWORD || '',
  },

  // Feature Flags
  features: {
    enableDeploymentLogs: true,
    enableAutoScaling: false,
    enableWebhooks: true,
  },

  // GitHub OAuth Configuration
  github: {
    clientId: process.env.GITHUB_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    callbackUrl:
      process.env.GITHUB_CALLBACK_URL || 'http://localhost:3000/api/auth/github/callback',
  },
};

export default config;
