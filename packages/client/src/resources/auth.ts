import {
  acceptInvitationSchema,
  invitationInfoSchema,
} from '../schemas/invitation.js';
import {
  authResponseSchema,
  loginRequestSchema,
  registerRequestSchema,
  userSchema,
} from '../schemas/user.js';
import type { AcceptInvitation, InvitationInfo } from '../types/invitation.js';
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

  /**
   * Get the details of a pending invitation by its token (public endpoint)
   * Used by the accept-invitation page before the user has an account
   * @param token - Invitation token
   * @returns Invitation info (email, role, status, expiry)
   */
  async getInvitation(token: string): Promise<InvitationInfo> {
    const data = await this.http.get(`auth/invitation/${token}`).json();
    return this.validate(data, invitationInfoSchema);
  }

  /**
   * Accept a pending invitation, creating the user account and logging in
   * @param input - Invitation token and the new account's password
   * @returns LoginResult with user information and session cookies
   */
  async acceptInvitation(input: AcceptInvitation): Promise<LoginResult> {
    const validatedInput = this.validate(input, acceptInvitationSchema);

    const response = await this.http.post('auth/accept-invitation', {
      json: validatedInput,
    });

    const cookies = response.headers.getSetCookie();

    const data = await response.json();
    const authResponse = this.validate(data, authResponseSchema);

    return {
      user: authResponse.user,
      cookies,
    };
  }
}
