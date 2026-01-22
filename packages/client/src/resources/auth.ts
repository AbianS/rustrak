import {
  authResponseSchema,
  loginRequestSchema,
  registerRequestSchema,
  userSchema,
} from '../schemas/user.js';
import type {
  LoginRequest,
  LoginResult,
  RegisterRequest,
  User,
} from '../types/user.js';
import { BaseResource } from './base.js';

/**
 * Authentication API resource
 * Handles user registration, login, logout, and session management
 */
export class AuthResource extends BaseResource {
  /**
   * Register a new user account
   * Creates a new user and automatically logs them in (sets session cookie)
   * @param credentials - Email and password for the new account
   * @returns LoginResult with user information and session cookies
   */
  async register(credentials: RegisterRequest): Promise<LoginResult> {
    // Validate input
    const validatedInput = this.validate(credentials, registerRequestSchema);

    const response = await this.http.post('auth/register', {
      json: validatedInput,
    });

    // Extract Set-Cookie headers for Server Actions
    const cookies = response.headers.getSetCookie();

    const data = await response.json();
    const authResponse = this.validate(data, authResponseSchema);

    return {
      user: authResponse.user,
      cookies,
    };
  }

  /**
   * Login with email and password
   * Authenticates the user and sets a session cookie
   * @param credentials - Email and password
   * @returns LoginResult with user information and session cookies
   */
  async login(credentials: LoginRequest): Promise<LoginResult> {
    // Validate input
    const validatedInput = this.validate(credentials, loginRequestSchema);

    const response = await this.http.post('auth/login', {
      json: validatedInput,
    });

    // Extract Set-Cookie headers for Server Actions
    const cookies = response.headers.getSetCookie();

    const data = await response.json();
    const authResponse = this.validate(data, authResponseSchema);

    return {
      user: authResponse.user,
      cookies,
    };
  }

  /**
   * Logout the current user
   * Clears the session cookie
   * @returns Array of Set-Cookie headers (typically clearing cookies)
   */
  async logout(): Promise<string[]> {
    const response = await this.http.post('auth/logout');
    return response.headers.getSetCookie();
  }

  /**
   * Get current authenticated user
   * Requires a valid session cookie
   * @returns User information
   */
  async getCurrentUser(): Promise<User> {
    const data = await this.http.get('auth/me').json();
    return this.validate(data, userSchema);
  }
}
