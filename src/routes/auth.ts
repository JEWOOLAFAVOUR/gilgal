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
router.get('/github/login', authMiddleware, (req: Request, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED, 'Authentication required');
      return;
    }

    const state = Buffer.from(JSON.stringify({ userId: req.user.userId })).toString('base64');
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
 * GET /api/auth/github/callback?code=xxx&state=yyy
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

    if (!state || typeof state !== 'string') {
      sendError(
        res,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        'Missing state parameter'
      );
      return;
    }

    // Decode state to get userId
    let userId: string;
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
      userId = stateData.userId;
    } catch (err) {
      sendError(
        res,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        'Invalid state parameter'
      );
      return;
    }

    // Exchange code for access token
    const tokenData = await GitHubOAuthService.exchangeCodeForToken(code);

    // Get GitHub user info
    const githubUser = await GitHubOAuthService.getUserInfo(tokenData.access_token);

    // Store GitHub token for the user
    await GitHubOAuthService.storeGitHubToken(userId, tokenData.access_token, githubUser.login);

    // Redirect back to frontend dashboard
    const redirectUrl = new URL(process.env.FRONTEND_URL || 'http://localhost:3000');
    redirectUrl.pathname = '/dashboard/create-project';
    redirectUrl.searchParams.append('github', 'success');

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

/**
 * Get user's GitHub repositories
 * GET /api/auth/github/repositories
 */
router.get(
  '/github/repositories',
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

      if (!githubToken) {
        sendError(
          res,
          HTTP_STATUS.UNAUTHORIZED,
          ERROR_CODES.UNAUTHORIZED,
          'GitHub not connected. Please connect your GitHub account first.'
        );
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const perPage = parseInt(req.query.perPage as string) || 30;

      const repositories = await GitHubOAuthService.getUserRepositories(
        githubToken.token,
        page,
        perPage
      );

      sendSuccess(res, {
        repositories,
        page,
        perPage,
        total: repositories.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
