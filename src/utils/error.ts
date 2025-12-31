import { Request, Response, NextFunction } from 'express';
import { HTTP_STATUS, ERROR_CODES } from '../constants';
import { ApiResponse } from '../types';

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public errorCode: string,
    message: string
  ) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handling middleware
 * Catches and formats all errors consistently
 */
export function errorHandler(
  error: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('[Error]', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
  });

  if (error instanceof ApiError) {
    const response: ApiResponse<null> = {
      success: false,
      error: error.errorCode,
      message: error.message,
    };
    res.status(error.statusCode).json(response);
    return;
  }

  // Handle unexpected errors
  const response: ApiResponse<null> = {
    success: false,
    error: ERROR_CODES.INTERNAL_SERVER_ERROR,
    message: 'An unexpected error occurred',
  };
  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(response);
}

/**
 * Success response helper
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  message: string = 'Success',
  statusCode: number = HTTP_STATUS.OK
): void {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
  };
  res.status(statusCode).json(response);
}

/**
 * Error response helper
 */
export function sendError(
  res: Response,
  statusCode: number,
  errorCode: string,
  message: string
): void {
  const response: ApiResponse<null> = {
    success: false,
    error: errorCode,
    message,
  };
  res.status(statusCode).json(response);
}
