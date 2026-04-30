import { z } from 'zod';

/**
 * Common passwords that should be rejected (top 100 most common)
 * This list matches the server-side validation
 */
const COMMON_PASSWORDS = new Set([
  'password', '123456', '12345678', 'qwerty', 'abc123', 'monkey', '1234567',
  'letmein', 'trustno1', 'dragon', 'baseball', 'iloveyou', 'master', 'sunshine',
  'ashley', 'bailey', 'passw0rd', 'shadow', '123123', '654321', 'superman',
  'qazwsx', 'michael', 'football', 'password1', 'password123', 'batman', 'login',
  'admin', 'admin123', 'welcome', 'welcome1', 'p@ssw0rd', 'qwerty123', 'solo',
  'princess', 'starwars', 'cheese', 'tigger', 'whatever', 'fuckyou', 'donald',
  'pokemon', 'soccer', 'access', 'mustang', 'pepper', 'joshua', 'jennifer',
  'george', 'houston', 'rangers', 'matrix', 'biteme', 'killer', 'charlie',
  'corvette', 'summer', 'jessica', 'robert', 'maverick', 'harley', 'asshole',
  'buster', 'andrew', 'yellow', 'smokey', 'jordan', 'cowboy', 'william',
  'secret', 'orange', 'cookie', 'coffee', 'silver', 'nicole', 'richard',
  'dakota', 'martin', 'maggie', 'guitar', 'runner', 'jasper', '102030',
  'lakers', 'soccer1', 'winter', 'bonnie', 'hockey', 'merlin', 'diamond',
  'forever', 'angels', 'ginger', 'hammer', 'banana', 'purple', 'prince',
  'flower', 'hunter',
]);

/**
 * Password requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 * - Not a commonly used password
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .refine(
    (password) => /[A-Z]/.test(password),
    'Password must contain at least one uppercase letter'
  )
  .refine(
    (password) => /[a-z]/.test(password),
    'Password must contain at least one lowercase letter'
  )
  .refine(
    (password) => /[0-9]/.test(password),
    'Password must contain at least one digit'
  )
  .refine(
    (password) => !COMMON_PASSWORDS.has(password.toLowerCase()),
    'Password is too common, please choose a more unique password'
  );

/**
 * Password requirements description for UI display
 */
export const PASSWORD_REQUIREMENTS = [
  'At least 8 characters long',
  'At least one uppercase letter (A-Z)',
  'At least one lowercase letter (a-z)',
  'At least one digit (0-9)',
  'Not a commonly used password',
] as const;

/**
 * Check individual password requirements (for real-time feedback)
 */
export function checkPasswordRequirements(password: string) {
  return {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasDigit: /[0-9]/.test(password),
    notCommon: !COMMON_PASSWORDS.has(password.toLowerCase()),
  };
}
