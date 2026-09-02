import { createAuthStore } from './auth-store';
import { rustrak } from './rustrak';

export type { AuthApi, AuthStore, Session } from './auth-store';
export { createAuthStore, sanitizeRedirect } from './auth-store';

// Arrow functions, not bare references: the client's methods read `this`.
export const auth = createAuthStore({
  getCurrentUser: () => rustrak.auth.getCurrentUser(),
  login: (credentials) => rustrak.auth.login(credentials),
  logout: () => rustrak.auth.logout(),
});
