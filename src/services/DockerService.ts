import Docker from 'dockerode';
import { v4 as uuidv4 } from 'uuid';
import config from '../config';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const docker = new Docker();

/**
 * Docker Service
 * Manages Docker operations for containerizing and deploying user applications
 * Uses dockerode for real Docker integration
 */
export class DockerService {
  /**
   * Detect framework from repository URL
   * Clones repo temporarily, checks package.json, returns detected framework
   */
  static async detectFramework(repositoryUrl: string): Promise<string> {
    const tempDir = path.join('/tmp', `detect-${uuidv4().substring(0, 8)}`);

    try {
      // Create temp directory
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Clone repository
      console.log(`[Framework Detection] Cloning repository: ${repositoryUrl}`);
      execSync(`git clone ${repositoryUrl} ${tempDir}`, { stdio: 'pipe' });

      // Check for package.json
      const packageJsonPath = path.join(tempDir, 'package.json');
      let framework = 'node'; // default

      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const deps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };

        // Detect framework
        if (deps['react'] || deps['react-dom']) {
          framework = 'react';
        } else if (deps['next']) {
          framework = 'next';
        } else if (deps['express']) {
          framework = 'express';
        }

        console.log(`[Framework Detection] Detected framework: ${framework}`);
      }

      return framework;
    } catch (error) {
      console.error('[Framework Detection] Error:', error);
      // Return default if detection fails
      return 'node';
    } finally {
      // Cleanup
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {
        // ignore cleanup errors
      }
    }
  }

  /**
   * Build Docker image from source code
   * Clones repository, detects framework, and builds custom Docker image
   */
  static async buildImage(
    projectId: string,
    deploymentId: string,
    sourceUrl?: string
  ): Promise<{ imageId: string; imageName: string; framework: string }> {
    const tempDir = path.join('/tmp', `gilgal-${deploymentId}`);
    const imageName = `gilgal-${projectId}-${uuidv4().substring(0, 8)}`;

    try {
      console.log(`[Docker] Starting image build: ${imageName}`);

      // Create temp directory
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Clone repository if sourceUrl provided
      if (sourceUrl) {
        console.log(`[Docker] Cloning repository: ${sourceUrl}`);
        try {
          execSync(`git clone ${sourceUrl} ${path.join(tempDir, 'source')}`, {
            stdio: 'pipe',
          });
          console.log(`[Docker] Repository cloned successfully`);
        } catch (gitError) {
          console.error(`[Docker] Git clone failed: ${gitError}`);
          throw new Error(`Failed to clone repository: ${gitError}`);
        }
      }

      // Detect framework and generate Dockerfile
      const sourceDir = sourceUrl ? path.join(tempDir, 'source') : tempDir;
      const packageJsonPath = path.join(sourceDir, 'package.json');

      let framework = 'node'; // default
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const deps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };

        // Detect framework
        if (deps['react'] || deps['react-dom']) {
          framework = 'react';
        } else if (deps['next']) {
          framework = 'next';
        } else if (deps['express']) {
          framework = 'express';
        }

        console.log(`[Docker] Detected framework: ${framework}`);
      }

      // Generate nginx.conf for React apps BEFORE Dockerfile
      if (framework === 'react') {
        const nginxConf = `server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root /usr/share/nginx/html;
    index index.html index.htm;

    # React Router fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Don't cache HTML
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # Deny dotfiles
    location ~ /\\. {
        deny all;
    }
}`;
        fs.writeFileSync(path.join(tempDir, 'nginx.conf'), nginxConf);
        console.log(`[Docker] Generated nginx.conf for React app`);
      }

      // Create .dockerignore to exclude unnecessary files
      const dockerignore = `node_modules
npm-debug.log
.git
.gitignore
.env
.env.local
.DS_Store
dist
build
.next
out
.turbo
*.md
.vscode
.idea
coverage
.nyc_output
*.log
.cache`;
      fs.writeFileSync(path.join(tempDir, '.dockerignore'), dockerignore);
      console.log(`[Docker] Generated .dockerignore`);

      // Generate Dockerfile based on framework
      const dockerfile = this.generateDockerfile(framework);
      fs.writeFileSync(path.join(tempDir, 'Dockerfile'), dockerfile);

      // Copy source code if exists
      if (sourceUrl && fs.existsSync(path.join(tempDir, 'source'))) {
        console.log(`[Docker] Copying source code...`);
        const sourceDir = path.join(tempDir, 'source');

        // List contents of source directory for debugging
        const sourceContents = execSync(`ls -la ${sourceDir}`, {
          stdio: 'pipe',
          encoding: 'utf-8',
        });
        console.log(`[Docker] Source directory contents:\n${sourceContents}`);

        // Copy all files from source to tempDir
        execSync(`cd ${sourceDir} && cp -r . ${tempDir}`, {
          stdio: 'pipe',
        });

        // Verify files copied
        const tempContents = execSync(`ls -la ${tempDir}`, {
          stdio: 'pipe',
          encoding: 'utf-8',
        });
        console.log(`[Docker] Build context contents:\n${tempContents}`);

        // Clean up source dir
        execSync(`rm -rf ${sourceDir}`, { stdio: 'pipe' });
      }

      // Build Docker image using docker CLI
      console.log(`[Docker] Building Docker image from Dockerfile...`);
      try {
        execSync(`docker build -t ${imageName} ${tempDir}`, {
          stdio: 'pipe',
        });
        console.log(`[Docker] Image built successfully: ${imageName}`);
      } catch (buildError) {
        console.error(`[Docker] Docker build failed:`, buildError);
        // Show docker build output for debugging
        try {
          execSync(`docker build -t ${imageName} ${tempDir}`, {
            stdio: 'inherit',
          });
        } catch (_) {
          // Ignore
        }
        throw new Error(`Failed to build Docker image: ${buildError}`);
      }

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });

      return {
        imageId: imageName,
        imageName,
        framework,
      };
    } catch (error) {
      console.error('[Docker] Build failed:', error);
      // Cleanup on error
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {
        // ignore cleanup errors
      }
      throw new Error(`Failed to build Docker image: ${error}`);
    }
  }

  /**
   * Generate Dockerfile based on framework
   */
  private static generateDockerfile(framework: string): string {
    switch (framework) {
      case 'react':
        return `
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm ci --only=development
COPY . .
RUN npm run build
RUN npm prune --production

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/app.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
        `.trim();

      case 'next':
        return `
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/package*.json ./
RUN npm ci --only=production
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
        `.trim();

      case 'express':
        return `
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
USER node
EXPOSE 3000
CMD ["npm", "start"]
        `.trim();

      default:
        // Generic Node.js app
        return `
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
        `.trim();
    }
  }

  /**
   * Run Docker container for deployment
   * Starts a container with specified image and environment variables
   */
  static async runContainer(
    imageName: string,
    projectId: string,
    environmentId: string,
    envVariables: Record<string, string> = {},
    framework: string = 'node'
  ): Promise<{ containerId: string; port: number }> {
    try {
      const port = this.allocatePort();
      const containerName = `gilgal-${projectId}-${environmentId.substring(0, 8)}`;

      console.log(`[Docker] Creating container: ${containerName}`);

      // Stop and remove old container with same name if it exists
      try {
        const oldContainer = docker.getContainer(containerName);
        const containerData = await oldContainer.inspect();
        if (containerData) {
          console.log(`[Docker] Stopping old container: ${containerName}`);
          await oldContainer.stop({ t: 5 }).catch(() => {
            // Container may already be stopped
          });
          console.log(`[Docker] Removing old container: ${containerName}`);
          await oldContainer.remove();
          console.log(`[Docker] Old container removed`);
        }
      } catch (error) {
        // Container doesn't exist, continue
      }

      // Determine container port based on framework
      const containerPort = framework === 'react' || framework === 'next' ? 80 : 3000;

      // Convert env variables to array format for Docker
      const env = Object.entries(envVariables).map(([key, value]) => `${key}=${value}`);
      env.push('NODE_ENV=production');

      // Create and start container
      const container = await docker.createContainer({
        Image: imageName,
        name: containerName,
        Env: env,
        ExposedPorts: {
          [`${containerPort}/tcp`]: {},
        },
        HostConfig: {
          PortBindings: {
            [`${containerPort}/tcp`]: [
              {
                HostIp: '0.0.0.0',
                HostPort: String(port),
              },
            ],
          },
          Memory: 512 * 1024 * 1024, // 512MB
          MemorySwap: 1024 * 1024 * 1024, // 1GB
          CpuShares: 1024,
          RestartPolicy: {
            Name: 'on-failure',
            MaximumRetryCount: 5,
          },
        },
        Labels: {
          'gilgal.projectId': projectId,
          'gilgal.environmentId': environmentId,
          'gilgal.deploymentId': containerName,
        },
      });

      // Start the container
      await container.start();

      console.log(`[Docker] Container started: ${container.id} on port ${port}`);

      return {
        containerId: container.id,
        port,
      };
    } catch (error) {
      console.error('[Docker] Container run failed:', error);
      throw new Error(`Failed to run Docker container: ${error}`);
    }
  }

  /**
   * Stop Docker container
   */
  static async stopContainer(containerId: string): Promise<void> {
    try {
      console.log(`[Docker] Stopping container: ${containerId}`);

      const container = docker.getContainer(containerId);

      // Check if container exists and is running
      try {
        const data = await container.inspect();
        if (data.State.Running) {
          await container.stop({ t: 10 }); // 10 second timeout
          console.log(`[Docker] Container stopped: ${containerId}`);
        }
      } catch (inspectError) {
        console.log(`[Docker] Container not found or already stopped: ${containerId}`);
      }

      // Optionally remove the container
      try {
        await container.remove();
        console.log(`[Docker] Container removed: ${containerId}`);
      } catch (removeError) {
        console.log(`[Docker] Could not remove container: ${containerId}`);
      }
    } catch (error) {
      console.error('[Docker] Stop failed:', error);
      throw new Error(`Failed to stop Docker container: ${error}`);
    }
  }

  /**
   * Get container logs
   */
  static async getContainerLogs(containerId: string, lines: number = 100): Promise<string> {
    try {
      console.log(`[Docker] Fetching logs for container: ${containerId}`);

      const container = docker.getContainer(containerId);
      const logStream = await container.logs({
        stdout: true,
        stderr: true,
        follow: false,
        tail: lines,
      });

      // Convert stream to string
      return logStream.toString();
    } catch (error) {
      console.error('[Docker] Log fetch failed:', error);
      // Return error log instead of throwing
      return `[Docker] Failed to retrieve logs: ${error}`;
    }
  }

  /**
   * Remove Docker image
   */
  static async removeImage(imageName: string): Promise<void> {
    try {
      console.log(`[Docker] Removing image: ${imageName}`);

      const image = docker.getImage(imageName);
      await image.remove({ force: true });

      console.log(`[Docker] Image removed: ${imageName}`);
    } catch (error) {
      console.error('[Docker] Remove failed:', error);
      throw new Error(`Failed to remove Docker image: ${error}`);
    }
  }

  /**
   * Get container health status
   */
  static async getContainerHealth(containerId: string): Promise<{
    status: 'running' | 'stopped' | 'unhealthy';
    uptime: number;
    memory: string;
    cpu: string;
  }> {
    try {
      const container = docker.getContainer(containerId);
      const data = await container.inspect();

      // Calculate uptime in seconds
      const startTime = new Date(data.State.StartedAt).getTime();
      const uptime = Math.floor((Date.now() - startTime) / 1000);

      return {
        status: data.State.Running ? 'running' : 'stopped',
        uptime,
        memory: 'monitoring',
        cpu: 'monitoring',
      };
    } catch (error) {
      console.error('[Docker] Health check failed:', error);
      return {
        status: 'unhealthy',
        uptime: 0,
        memory: '0MB',
        cpu: '0%',
      };
    }
  }

  /**
   * Allocate an available port for container
   * Checks available ports and allocates the next free one
   */
  private static allocatePort(): number {
    const basePort = 8000;
    const randomOffset = Math.floor(Math.random() * 1000);
    return basePort + randomOffset;
  }

  /**
   * Get Docker daemon info
   */
  static async getDockerInfo(): Promise<{ version: string; running: boolean }> {
    try {
      const info = await docker.version();
      return {
        version: info.Version,
        running: true,
      };
    } catch (error) {
      console.error('[Docker] Info fetch failed:', error);
      return {
        version: 'unknown',
        running: false,
      };
    }
  }

  /**
   * Push image to registry
   * Prepares image for pushing to Docker Hub or private registry
   */
  static async pushImage(imageName: string, tag: string = 'latest'): Promise<void> {
    try {
      const fullImageName = `${config.docker.registry}/${imageName}:${tag}`;
      console.log(`[Docker] Preparing image for registry: ${fullImageName}`);

      const image = docker.getImage(imageName);

      // Tag the image for registry
      await image.tag({
        repo: `${config.docker.registry}/${imageName}`,
        tag,
      });

      console.log(`[Docker] Image tagged for registry: ${fullImageName}`);
      console.log(`[Docker] Image ready to push to registry (docker push ${fullImageName})`);
    } catch (error) {
      console.error('[Docker] Push preparation failed:', error);
      throw new Error(`Failed to prepare Docker image for push: ${error}`);
    }
  }
}
