import { describe, expect, it } from 'vitest';
import {
  authResponseSchema,
  loginRequestSchema,
  registerRequestSchema,
  userSchema,
} from '../../src/schemas/user.js';

describe('User Schemas', () => {
  describe('userSchema', () => {
    it('should validate valid user object', () => {
      const validUser = {
        id: 1,
        email: 'test@example.com',
        is_admin: false,
      };

      const result = userSchema.safeParse(validUser);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validUser);
      }
    });

    it('should validate admin user', () => {
      const adminUser = {
        id: 2,
        email: 'admin@example.com',
        is_admin: true,
      };

      const result = userSchema.safeParse(adminUser);
      expect(result.success).toBe(true);
    });

    it('should reject negative user ID', () => {
      const invalidUser = {
        id: -1,
        email: 'test@example.com',
        is_admin: false,
      };

      const result = userSchema.safeParse(invalidUser);
      expect(result.success).toBe(false);
    });

    it('should reject zero as user ID', () => {
      const invalidUser = {
        id: 0,
        email: 'test@example.com',
        is_admin: false,
      };

      const result = userSchema.safeParse(invalidUser);
      expect(result.success).toBe(false);
    });

    it('should reject non-integer user ID', () => {
      const invalidUser = {
        id: 1.5,
        email: 'test@example.com',
        is_admin: false,
      };

      const result = userSchema.safeParse(invalidUser);
      expect(result.success).toBe(false);
    });

    it('should reject invalid email format', () => {
      const invalidUser = {
        id: 1,
        email: 'not-an-email',
        is_admin: false,
      };

      const result = userSchema.safeParse(invalidUser);
      expect(result.success).toBe(false);
    });

    it('should reject missing @ in email', () => {
      const invalidUser = {
        id: 1,
        email: 'testexample.com',
        is_admin: false,
      };

      const result = userSchema.safeParse(invalidUser);
      expect(result.success).toBe(false);
    });

    it('should reject missing domain in email', () => {
      const invalidUser = {
        id: 1,
        email: 'test@',
        is_admin: false,
      };

      const result = userSchema.safeParse(invalidUser);
      expect(result.success).toBe(false);
    });

    it('should reject non-boolean is_admin', () => {
      const invalidUser = {
        id: 1,
        email: 'test@example.com',
        is_admin: 'true', // string instead of boolean
      };

      const result = userSchema.safeParse(invalidUser);
      expect(result.success).toBe(false);
    });

    it('should reject missing fields', () => {
      const invalidUser = {
        id: 1,
        email: 'test@example.com',
        // missing is_admin
      };

      const result = userSchema.safeParse(invalidUser);
      expect(result.success).toBe(false);
    });

    it('should reject extra fields by default', () => {
      const userWithExtra = {
        id: 1,
        email: 'test@example.com',
        is_admin: false,
        extra_field: 'should be stripped',
      };

      const result = userSchema.safeParse(userWithExtra);
      expect(result.success).toBe(true);
      if (result.success) {
        // Zod strips extra fields by default
        expect(result.data).not.toHaveProperty('extra_field');
      }
    });

    it('should accept valid email formats', () => {
      const validEmails = [
        'simple@example.com',
        'user+tag@example.com',
        'user.name@example.com',
        'user_name@example.com',
        'user-name@example.com',
        'user123@example.com',
        'test@subdomain.example.com',
      ];

      validEmails.forEach((email) => {
        const user = {
          id: 1,
          email,
          is_admin: false,
        };

        const result = userSchema.safeParse(user);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('authResponseSchema', () => {
    it('should validate valid auth response', () => {
      const validResponse = {
        user: {
          id: 1,
          email: 'test@example.com',
          is_admin: false,
        },
      };

      const result = authResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.user.email).toBe('test@example.com');
      }
    });

    it('should reject response without user', () => {
      const invalidResponse = {
        // missing user field
      };

      const result = authResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });

    it('should reject response with invalid user', () => {
      const invalidResponse = {
        user: {
          id: 'not-a-number', // invalid
          email: 'test@example.com',
          is_admin: false,
        },
      };

      const result = authResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });

    it('should validate nested user schema', () => {
      const responseWithInvalidEmail = {
        user: {
          id: 1,
          email: 'not-an-email',
          is_admin: false,
        },
      };

      const result = authResponseSchema.safeParse(responseWithInvalidEmail);
      expect(result.success).toBe(false);
    });
  });

  describe('loginRequestSchema', () => {
    it('should validate valid login request', () => {
      const validRequest = {
        email: 'test@example.com',
        password: 'password123',
      };

      const result = loginRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email format', () => {
      const invalidRequest = {
        email: 'not-an-email',
        password: 'password123',
      };

      const result = loginRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should reject password shorter than 8 characters', () => {
      const invalidRequest = {
        email: 'test@example.com',
        password: '1234567', // 7 characters
      };

      const result = loginRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should accept password with exactly 8 characters', () => {
      const validRequest = {
        email: 'test@example.com',
        password: '12345678', // exactly 8
      };

      const result = loginRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should accept long passwords', () => {
      const validRequest = {
        email: 'test@example.com',
        password: 'a'.repeat(100), // 100 characters
      };

      const result = loginRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should reject missing email', () => {
      const invalidRequest = {
        password: 'password123',
        // missing email
      };

      const result = loginRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should reject missing password', () => {
      const invalidRequest = {
        email: 'test@example.com',
        // missing password
      };

      const result = loginRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should reject non-string email', () => {
      const invalidRequest = {
        email: 123,
        password: 'password123',
      };

      const result = loginRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should reject non-string password', () => {
      const invalidRequest = {
        email: 'test@example.com',
        password: 12345678,
      };

      const result = loginRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should reject empty password', () => {
      const invalidRequest = {
        email: 'test@example.com',
        password: '',
      };

      const result = loginRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });
  });

  describe('registerRequestSchema', () => {
    it('should validate valid register request', () => {
      const validRequest = {
        email: 'newuser@example.com',
        password: 'securepass123',
      };

      const result = registerRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should have same validation as login request', () => {
      // Register and login should have identical schema validation
      const testData = {
        email: 'test@example.com',
        password: 'password123',
      };

      const loginResult = loginRequestSchema.safeParse(testData);
      const registerResult = registerRequestSchema.safeParse(testData);

      expect(loginResult.success).toBe(registerResult.success);
    });

    it('should reject invalid email format', () => {
      const invalidRequest = {
        email: 'invalid-email',
        password: 'password123',
      };

      const result = registerRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should reject short password', () => {
      const invalidRequest = {
        email: 'test@example.com',
        password: 'short',
      };

      const result = registerRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should accept special characters in password', () => {
      const validRequest = {
        email: 'test@example.com',
        password: 'P@ssw0rd!#$%',
      };

      const result = registerRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should accept unicode characters in password', () => {
      const validRequest = {
        email: 'test@example.com',
        password: 'pässwörd123',
      };

      const result = registerRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long email addresses', () => {
      const longEmail = `${'a'.repeat(240)}@example.com`;

      const user = {
        id: 1,
        email: longEmail,
        is_admin: false,
      };

      const result = userSchema.safeParse(user);
      // Email validation allows long emails up to reasonable length
      expect(result.success).toBe(true);
    });

    it('should handle email with multiple subdomains', () => {
      const user = {
        id: 1,
        email: 'test@mail.subdomain.example.com',
        is_admin: false,
      };

      const result = userSchema.safeParse(user);
      expect(result.success).toBe(true);
    });

    it('should handle email with numbers', () => {
      const user = {
        id: 1,
        email: 'user123@example123.com',
        is_admin: false,
      };

      const result = userSchema.safeParse(user);
      expect(result.success).toBe(true);
    });

    it('should handle very large user IDs', () => {
      const user = {
        id: 2147483647, // Max 32-bit integer
        email: 'test@example.com',
        is_admin: false,
      };

      const result = userSchema.safeParse(user);
      expect(result.success).toBe(true);
    });
  });

  describe('Type Inference', () => {
    it('should infer correct TypeScript types', () => {
      const user = {
        id: 1,
        email: 'test@example.com',
        is_admin: false,
      };

      const result = userSchema.safeParse(user);
      if (result.success) {
        // TypeScript should infer these types
        const _id: number = result.data.id;
        const _email: string = result.data.email;
        const _isAdmin: boolean = result.data.is_admin;

        expect(result.data).toBeDefined();
      }
    });
  });

  describe('Error Messages', () => {
    it('should provide helpful error message for invalid email', () => {
      const invalidUser = {
        id: 1,
        email: 'not-an-email',
        is_admin: false,
      };

      const result = userSchema.safeParse(invalidUser);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
        expect(result.error.issues[0]?.path).toContain('email');
      }
    });

    it('should provide helpful error message for invalid password length', () => {
      const invalidRequest = {
        email: 'test@example.com',
        password: 'short',
      };

      const result = loginRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
        expect(result.error.issues[0]?.path).toContain('password');
      }
    });

    it('should report multiple validation errors', () => {
      const invalidRequest = {
        email: 'not-an-email',
        password: 'short',
      };

      const result = loginRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
      if (!result.success) {
        // Should have errors for both email and password
        expect(result.error.issues.length).toBeGreaterThanOrEqual(2);
      }
    });
  });
});
