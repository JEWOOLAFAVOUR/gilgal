import { Router, Request, Response, NextFunction } from 'express';
import { UserService } from '../services/UserService';
import { GitHubOAuthService } from '../services/GitHubOAuthService';
import { generateAccessToken } from '../utils/jwt';
import { sendSuccess, sendError, ApiError } from '../utils/error';
import { HTTP_STATUS, ERROR_CODES } from '../constants';
import { authMiddleware, requireAuth } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../database';

const router = Router();

/**
 * Authentication Routes
 * POST /api/auth/register - Register new user
 * POST /api/auth/login - Login user
 * POST /api/auth/logout - Logout user
 * POST /api/auth/refresh - Refresh JWT token
 * GET /api/auth/me - Get current user (protected)
 */

/**
 * Register new user
 * POST /api/auth/register
 */
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check if body is empty or missing
    if (!req.body || Object.keys(req.body).length === 0) {
      sendError(
        res,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        'Request body is required'
      );
      return;
    }

    const { email, username, password, fullName } = req.body;

    // Validation
    if (!email || !username || !password || !fullName) {
      sendError(
        res,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        'Missing required fields: email, username, password, fullName'
      );
      return;
    }

    if (password.length < 8) {
      sendError(
        res,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.WEAK_PASSWORD,
        'Password must be at least 8 characters'
      );
      return;
    }

    const user = await UserService.createUser({
      email,
      username,
      password,
      fullName,
    });

    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      username: user.username,
    });

    sendSuccess(
      res,
      {
        user,
        accessToken,
      },
      'User registered successfully',
      HTTP_STATUS.CREATED
    );
  } catch (error) {
    next(error);
  }
});

/**
 * Login user
 * POST /api/auth/login
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check if body is empty or missing
    if (!req.body || Object.keys(req.body).length === 0) {
      sendError(
        res,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        'Request body is required'
      );
      return;
    }

    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      sendError(
        res,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        'Email and password are required'
      );
      return;
    }

    // Get user from database
    const userWithPassword = await UserService.getUserByEmail(email);
    if (!userWithPassword) {
      sendError(
        res,
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.INVALID_CREDENTIALS,
        'Invalid email or password'
      );
      return;
    }

    // Verify password
    const isValidPassword = await UserService.verifyPassword(
      userWithPassword.passwordHash,
      password
    );
    if (!isValidPassword) {
      sendError(
        res,
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.INVALID_CREDENTIALS,
        'Invalid email or password'
      );
      return;
    }

    // Generate token
    const accessToken = generateAccessToken({
      userId: userWithPassword.id,
      email: userWithPassword.email,
      username: userWithPassword.username,
    });

    // Return user (without password)
    const { passwordHash, ...user } = userWithPassword;

    sendSuccess(res, {
      user,
      accessToken,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Logout user (client-side operation, endpoint for symmetry)
 * POST /api/auth/logout
 */
router.post('/logout', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // In a real application, you might want to:
    // 1. Invalidate tokens in a blacklist/cache
    // 2. Clear sessions
    // 3. Update user's last_logout_at timestamp

    sendSuccess(res, null, 'Logged out successfully');
  } catch (error) {
    next(error);
  }
});

/**
 * Get current user
 * GET /api/auth/me
 */
router.get('/me', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      sendError(res, HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED, 'User not found');
      return;
    }

    const user = await UserService.getUserById(req.user.userId);
    if (!user) {
      sendError(res, HTTP_STATUS.NOT_FOUND, ERROR_CODES.USER_NOT_FOUND, 'User not found');
      return;
    }

    sendSuccess(res, user);
  } catch (error) {
    next(error);
  }
});

/**
 * Refresh token (simplified implementation)
 * POST /api/auth/refresh
 */
router.post('/refresh', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      sendError(res, HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED, 'Authentication required');
      return;
    }

    const accessToken = generateAccessToken({
      userId: req.user.userId,
      email: req.user.email,
      username: req.user.username,
    });

    sendSuccess(res, { accessToken });
  } catch (error) {
    next(error);
  }
});

/**
 * GitHub OAuth - Start authorization
 * GET /api/auth/github/login
 */
router.get('/github/login', (req: Request, res: Response) => {
  try {
    const state = uuidv4();
    // Store state in session or temp storage for verification in callback
    // For now, we'll skip state validation in callback
    const authUrl = GitHubOAuthService.getAuthorizationUrl(state);
    sendSuccess(res, { authUrl });
  } catch (error) {
    sendError(
      res,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      ERROR_CODES.VALIDATION_ERROR,
      'Failed to generate GitHub auth URL'
    );
  }
});

/**
 * GitHub OAuth - Callback
 * GET /api/auth/github/callback?code=xxx
 */
router.get('/github/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, state } = req.query;

    if (!code || typeof code !== 'string') {
      sendError(
        res,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        'Missing authorization code'
      );
      return;
    }

    // Exchange code for access token
    const tokenData = await GitHubOAuthService.exchangeCodeForToken(code);

    // Get GitHub user info
    const githubUser = await GitHubOAuthService.getUserInfo(tokenData.access_token);

    // Check if user already exists (by email or GitHub username)
    const existingUser = await UserService.getUserByEmail(githubUser.email);
    let user: any = existingUser;

    if (!user) {
      // Create new user from GitHub data
      user = await UserService.createUser({
        email: githubUser.email,
        username: githubUser.login,
        password: uuidv4(), // Generate random password for GitHub users
        fullName: githubUser.name || githubUser.login,
      });
    }

    if (!user) {
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.DATABASE_ERROR,
        'Failed to create or retrieve user'
      );
    }

    // Store GitHub token
    await GitHubOAuthService.storeGitHubToken(user.id, tokenData.access_token, githubUser.login);

    // Generate application JWT token
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      username: user.username,
    });

    // Redirect to frontend with token
    const redirectUrl = new URL(process.env.FRONTEND_URL || 'http://localhost:3000');
    redirectUrl.searchParams.append('token', accessToken);
    redirectUrl.searchParams.append('github', 'true');

    res.redirect(redirectUrl.toString());
  } catch (error) {
    next(error);
  }
});

/**
 * Get current user's GitHub connection status
 * GET /api/auth/github/status
 */

router.get(
  '/github/status',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        sendError(
          res,
          HTTP_STATUS.UNAUTHORIZED,
          ERROR_CODES.UNAUTHORIZED,
          'Authentication required'
        );
        return;
      }

      const githubToken = await GitHubOAuthService.getGitHubToken(req.user.userId);

      sendSuccess(res, {
        connected: !!githubToken,
        username: githubToken?.username || null,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Disconnect GitHub account
 * POST /api/auth/github/disconnect
 */
router.post(
  '/github/disconnect',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        sendError(
          res,
          HTTP_STATUS.UNAUTHORIZED,
          ERROR_CODES.UNAUTHORIZED,
          'Authentication required'
        );
        return;
      }

      await query(
        `
        UPDATE users 
        SET github_token = NULL, 
            github_token_expires_at = NULL,
            github_username = NULL
        WHERE id = $1
        `,
        [req.user.userId]
      );

      sendSuccess(res, {}, 'GitHub account disconnected');
    } catch (error) {
      next(error);
    }
  }
);

export default router;
