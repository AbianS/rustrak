import type { KyInstance } from 'ky';
import type { ClientConfig } from './config.js';
import {
  AuthResource,
  EventsResource,
  IssuesResource,
  ProjectsResource,
  TokensResource,
} from './resources/index.js';
import { createKyInstance } from './utils/index.js';

/**
 * Main Rustrak API client
 *
 * @example
 * ```typescript
 * const client = new RustrakClient({
 *   baseUrl: 'http://localhost:8080',
 *   token: 'your-api-token'
 * });
 *
 * // List all projects
 * const projects = await client.projects.list();
 *
 * // Get issues for a project
 * const issues = await client.issues.list(1);
 *
 * // Get events for an issue
 * const events = await client.events.list(1, 'issue-uuid');
 * ```
 */
export class RustrakClient {
  private readonly http: KyInstance;

  /**
   * Authentication API resource
   */
  public readonly auth: AuthResource;

  /**
   * Projects API resource
   */
  public readonly projects: ProjectsResource;

  /**
   * Issues API resource
   */
  public readonly issues: IssuesResource;

  /**
   * Events API resource
   */
  public readonly events: EventsResource;

  /**
   * Auth Tokens API resource
   */
  public readonly tokens: TokensResource;

  /**
   * Create a new Rustrak API client
   *
   * @param config - Client configuration
   */
  constructor(config: ClientConfig) {
    this.http = createKyInstance(config);

    // Initialize resources
    this.auth = new AuthResource(this.http);
    this.projects = new ProjectsResource(this.http);
    this.issues = new IssuesResource(this.http);
    this.events = new EventsResource(this.http);
    this.tokens = new TokensResource(this.http);
  }
}
