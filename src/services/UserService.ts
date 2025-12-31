import { query } from '../database';
import { User, CreateUserRequest } from '../types';
import { HTTP_STATUS, ERROR_CODES } from '../constants';
import { ApiError } from '../utils/error';
import bcrypt from 'bcryptjs';

/**
 * User Service
 * Handles all user-related business logic
 */
export class UserService {
  /**
   * Create a new user account
   */
  static async createUser(data: CreateUserRequest): Promise<User> {
    // Check if email already exists
    const existingEmail = await query<User>(
      'SELECT id FROM users WHERE email = $1',
      [data.email]
    );
    if (existingEmail.rowCount > 0) {
      throw new ApiError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.EMAIL_ALREADY_EXISTS,
        'Email already exists'
      );
    }

    // Check if username already exists
    const existingUsername = await query<User>(
      'SELECT id FROM users WHERE username = $1',
      [data.username]
    );
    if (existingUsername.rowCount > 0) {
      throw new ApiError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.USERNAME_ALREADY_EXISTS,
        'Username already exists'
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Create user
    const result = await query<User>(
      `
      INSERT INTO users (email, username, password_hash, full_name)
      VALUES ($1, $2, $3, $4)
      RETURNING id, email, username, full_name, avatar_url, bio, created_at, updated_at
      `,
      [data.email, data.username, passwordHash, data.fullName]
    );

    if (result.rowCount === 0) {
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.DATABASE_ERROR,
        'Failed to create user'
      );
    }

    return result.rows[0];
  }

  /**
   * Get user by email (for login)
   */
  static async getUserByEmail(email: string): Promise<User & { passwordHash: string } | null> {
    const result = await query<User & { passwordHash: string }>(
      `
      SELECT id, email, username, password_hash as "passwordHash", full_name, avatar_url, bio, created_at, updated_at
      FROM users
      WHERE email = $1 AND deleted_at IS NULL
      `,
      [email]
    );

    return result.rows[0] || null;
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: string): Promise<User | null> {
    const result = await query<User>(
      `
      SELECT id, email, username, full_name, avatar_url, bio, created_at, updated_at
      FROM users
      WHERE id = $1 AND deleted_at IS NULL
      `,
      [userId]
    );

    return result.rows[0] || null;
  }

  /**
   * Verify password
   */
  static async verifyPassword(storedHash: string, plainPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, storedHash);
  }

  /**
   * Update user profile
   */
  static async updateUser(userId: string, data: Partial<User>): Promise<User> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.fullName !== undefined) {
      updates.push(`full_name = $${paramCount++}`);
      values.push(data.fullName);
    }
    if (data.bio !== undefined) {
      updates.push(`bio = $${paramCount++}`);
      values.push(data.bio);
    }

    if (updates.length === 0) {
      return (await this.getUserById(userId)) as User;
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const result = await query<User>(
      `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, email, username, full_name, avatar_url, bio, created_at, updated_at
      `,
      values
    );

    if (result.rowCount === 0) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.USER_NOT_FOUND, 'User not found');
    }

    return result.rows[0];
  }
}
