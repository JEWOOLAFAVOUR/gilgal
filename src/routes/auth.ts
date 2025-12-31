import { Router, Request, Response, NextFunction } from 'express';
import { UserService } from '../services/UserService';
import { generateAccessToken } from '../utils/jwt';
import { sendSuccess, sendError, ApiError } from '../utils/error';
import { HTTP_STATUS, ERROR_CODES } from '../constants';
import { authMiddleware, requireAuth } from '../middleware/auth';

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

export default router;
