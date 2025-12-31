import { Router, Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/error';
import { HTTP_STATUS, ERROR_CODES } from '../constants';
import { authMiddleware } from '../middleware/auth';

const router = Router();

/**
 * User Routes
 * GET /api/users/me - Get current user profile
 * PUT /api/users/:id - Update user profile
 */

/**
 * Get current user profile
 * GET /api/users/me
 */
router.get('/me', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      sendError(res, HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED, 'Authentication required');
      return;
    }

    // In a real implementation, fetch full user data from database
    sendSuccess(res, {
      userId: req.user.userId,
      email: req.user.email,
      username: req.user.username,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Update user profile
 * PUT /api/users/:id
 */
router.put('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      sendError(res, HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED, 'Authentication required');
      return;
    }

    // Verify user is updating their own profile
    if (req.user.userId !== req.params.id) {
      sendError(res, HTTP_STATUS.FORBIDDEN, ERROR_CODES.INSUFFICIENT_PERMISSIONS, 'Cannot update other users');
      return;
    }

    // Update logic here
    sendSuccess(res, null, 'Profile updated successfully');
  } catch (error) {
    next(error);
  }
});

export default router;
