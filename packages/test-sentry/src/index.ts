import * as Sentry from '@sentry/node';

export interface TestConfig {
  dsn: string;
  debug?: boolean;
  environment?: string;
  release?: string;
}

/**
 * Initialize Sentry with the given configuration
 */
export function initSentry(config: TestConfig): void {
  Sentry.init({
    dsn: config.dsn,
    debug: config.debug ?? false,
    environment: config.environment ?? 'test',
    release: config.release ?? 'test-sentry@1.0.0',
    tracesSampleRate: 1.0,
    // Disable default integrations that might interfere with testing
    defaultIntegrations: false,
    integrations: [
      Sentry.consoleIntegration(),
      Sentry.httpIntegration(),
      Sentry.contextLinesIntegration(),
    ],
  });
}

/**
 * Wait for all events to be sent to Sentry
 */
export async function flush(timeout = 5000): Promise<boolean> {
  return Sentry.flush(timeout);
}

// ============================================================================
// Test Scenarios
// ============================================================================

/**
 * Test 1: Basic captured exception
 * Captures a simple Error with a message
 */
export function testCapturedError(): string {
  const eventId = Sentry.captureException(
    new Error('Test captured error from test-sentry package'),
  );
  console.log(`[testCapturedError] Sent event: ${eventId}`);
  return eventId;
}

/**
 * Test 2: TypeError exception
 * Simulates a common TypeError
 */
export function testTypeError(): string {
  try {
    const obj: unknown = null;
    // @ts-expect-error intentional error for testing
    obj.someProperty.nested;
  } catch (error) {
    const eventId = Sentry.captureException(error);
    console.log(`[testTypeError] Sent event: ${eventId}`);
    return eventId;
  }
  return '';
}

/**
 * Test 3: ReferenceError exception
 * Simulates an undefined variable access
 */
export function testReferenceError(): string {
  try {
    // @ts-expect-error intentional error for testing
    // eslint-disable-next-line no-undef
    console.log(undefinedVariable);
  } catch (error) {
    const eventId = Sentry.captureException(error);
    console.log(`[testReferenceError] Sent event: ${eventId}`);
    return eventId;
  }
  return '';
}

/**
 * Test 4: Custom error class
 * Tests that custom error types are properly captured
 */
export class CustomApplicationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'CustomApplicationError';
  }
}

export function testCustomError(): string {
  const error = new CustomApplicationError(
    'Something went wrong in the application',
    'ERR_CUSTOM_001',
    { userId: 123, action: 'test' },
  );
  const eventId = Sentry.captureException(error);
  console.log(`[testCustomError] Sent event: ${eventId}`);
  return eventId;
}

/**
 * Test 5: Capture message (non-error event)
 * Tests log-level messages
 */
export function testCaptureMessage(): string {
  const eventId = Sentry.captureMessage(
    'This is a test message from test-sentry',
    'info',
  );
  console.log(`[testCaptureMessage] Sent event: ${eventId}`);
  return eventId;
}

/**
 * Test 6: Error with breadcrumbs
 * Tests that breadcrumbs are properly attached to events
 */
export function testWithBreadcrumbs(): string {
  // Add custom breadcrumbs
  Sentry.addBreadcrumb({
    category: 'auth',
    message: 'User logged in',
    level: 'info',
    data: { userId: 'user-123' },
  });

  Sentry.addBreadcrumb({
    category: 'navigation',
    message: 'User navigated to /dashboard',
    level: 'info',
  });

  Sentry.addBreadcrumb({
    category: 'ui.click',
    message: 'User clicked on "Submit" button',
    level: 'info',
  });

  Sentry.addBreadcrumb({
    category: 'http',
    message: 'GET /api/data',
    level: 'info',
    data: {
      url: '/api/data',
      method: 'GET',
      status_code: 200,
    },
  });

  Sentry.addBreadcrumb({
    category: 'http',
    message: 'POST /api/submit',
    level: 'error',
    data: {
      url: '/api/submit',
      method: 'POST',
      status_code: 500,
    },
  });

  const eventId = Sentry.captureException(
    new Error('Error after breadcrumb trail'),
  );
  console.log(`[testWithBreadcrumbs] Sent event: ${eventId}`);
  return eventId;
}

/**
 * Test 7: Error with user context
 * Tests that user information is properly attached
 */
export function testWithUserContext(): string {
  Sentry.setUser({
    id: 'user-456',
    email: 'testuser@example.com',
    username: 'testuser',
    ip_address: '192.168.1.100',
  });

  const eventId = Sentry.captureException(
    new Error('Error with user context attached'),
  );
  console.log(`[testWithUserContext] Sent event: ${eventId}`);

  // Clear user context after test
  Sentry.setUser(null);
  return eventId;
}

/**
 * Test 8: Error with tags
 * Tests that custom tags are properly attached
 */
export function testWithTags(): string {
  Sentry.setTag('environment', 'testing');
  Sentry.setTag('feature', 'error-tracking');
  Sentry.setTag('version', '2.0.0');

  Sentry.withScope((scope) => {
    scope.setTag('scope_specific_tag', 'scoped_value');
    scope.setLevel('warning');

    const eventId = Sentry.captureException(
      new Error('Error with custom tags'),
    );
    console.log(`[testWithTags] Sent event: ${eventId}`);
  });

  return '';
}

/**
 * Test 9: Error with extra context
 * Tests that extra data is properly attached
 */
export function testWithExtraContext(): string {
  Sentry.setExtra('request_id', 'req-789');
  Sentry.setExtra('timestamp', new Date().toISOString());

  Sentry.withScope((scope) => {
    scope.setExtras({
      user_action: 'form_submit',
      form_data: {
        field1: 'value1',
        field2: 'value2',
      },
      processing_time_ms: 1234,
    });

    const eventId = Sentry.captureException(
      new Error('Error with extra context'),
    );
    console.log(`[testWithExtraContext] Sent event: ${eventId}`);
  });

  return '';
}

/**
 * Test 10: Error with custom fingerprint
 * Tests custom grouping via fingerprint
 */
export function testWithFingerprint(): string {
  Sentry.withScope((scope) => {
    // Custom fingerprint to force grouping
    scope.setFingerprint(['custom-group', 'database-error']);

    const eventId = Sentry.captureException(
      new Error('Database connection failed - custom fingerprint'),
    );
    console.log(`[testWithFingerprint] Sent event: ${eventId}`);
  });

  return '';
}

/**
 * Test 11: Error with transaction name
 * Tests that transaction context is properly attached
 */
export function testWithTransaction(): string {
  Sentry.withScope((scope) => {
    scope.setTransactionName('POST /api/users/create');

    const eventId = Sentry.captureException(
      new Error('Error during user creation'),
    );
    console.log(`[testWithTransaction] Sent event: ${eventId}`);
  });

  return '';
}

/**
 * Test 12: Nested error with cause
 * Tests error chain/cause handling
 */
export function testNestedError(): string {
  try {
    try {
      throw new Error('Root cause: database timeout');
    } catch (dbError) {
      const serviceError = new Error('Service layer error');
      serviceError.cause = dbError;
      throw serviceError;
    }
  } catch (error) {
    const eventId = Sentry.captureException(error);
    console.log(`[testNestedError] Sent event: ${eventId}`);
    return eventId;
  }
}

/**
 * Test 13: Error with stack trace from async operation
 * Tests async stack traces
 */
export async function testAsyncError(): Promise<string> {
  async function innerAsync(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 10));
    throw new Error('Async operation failed');
  }

  async function middleAsync(): Promise<void> {
    await innerAsync();
  }

  try {
    await middleAsync();
  } catch (error) {
    const eventId = Sentry.captureException(error);
    console.log(`[testAsyncError] Sent event: ${eventId}`);
    return eventId;
  }
  return '';
}

/**
 * Test 14: Multiple errors in sequence
 * Tests that multiple events are properly queued and sent
 */
export function testMultipleErrors(): string[] {
  const eventIds: string[] = [];

  for (let i = 1; i <= 5; i++) {
    const eventId = Sentry.captureException(
      new Error(`Sequential error #${i}`),
    );
    eventIds.push(eventId);
    console.log(`[testMultipleErrors] Sent event #${i}: ${eventId}`);
  }

  return eventIds;
}

/**
 * Test 15: Error flood (rate limit test)
 * Sends many errors quickly to test rate limiting
 */
export function testErrorFlood(count = 50): string[] {
  const eventIds: string[] = [];

  console.log(`[testErrorFlood] Sending ${count} errors...`);

  for (let i = 1; i <= count; i++) {
    const eventId = Sentry.captureException(
      new Error(`Flood error #${i} - testing rate limits`),
    );
    eventIds.push(eventId);
  }

  console.log(`[testErrorFlood] Sent ${eventIds.length} events`);
  return eventIds;
}

/**
 * Test 16: Different error levels
 * Tests various severity levels
 */
export function testErrorLevels(): void {
  const levels: Sentry.SeverityLevel[] = [
    'fatal',
    'error',
    'warning',
    'info',
    'debug',
  ];

  for (const level of levels) {
    Sentry.withScope((scope) => {
      scope.setLevel(level);
      const eventId = Sentry.captureMessage(
        `Test message with level: ${level}`,
        level,
      );
      console.log(`[testErrorLevels] Sent ${level} event: ${eventId}`);
    });
  }
}

/**
 * Test 17: Error with contexts (device, os, browser, etc.)
 * Tests custom context objects
 */
export function testWithContexts(): string {
  Sentry.withScope((scope) => {
    scope.setContext('device', {
      name: 'Test Device',
      family: 'Desktop',
      model: 'MacBook Pro',
      brand: 'Apple',
    });

    scope.setContext('os', {
      name: 'macOS',
      version: '14.0',
    });

    scope.setContext('app', {
      app_name: 'Rustrak Test',
      app_version: '1.0.0',
      app_build: '100',
    });

    scope.setContext('custom', {
      feature_flags: {
        new_dashboard: true,
        beta_features: false,
      },
      experiment_id: 'exp-123',
    });

    const eventId = Sentry.captureException(
      new Error('Error with rich context'),
    );
    console.log(`[testWithContexts] Sent event: ${eventId}`);
  });

  return '';
}

/**
 * Run all tests
 */
export async function runAllTests(): Promise<void> {
  console.log('\n=== Running All Sentry Tests ===\n');

  // Basic errors
  console.log('--- Basic Errors ---');
  testCapturedError();
  testTypeError();
  testReferenceError();
  testCustomError();
  testNestedError();
  await testAsyncError();

  // Messages
  console.log('\n--- Messages ---');
  testCaptureMessage();

  // Context tests
  console.log('\n--- Context Tests ---');
  testWithBreadcrumbs();
  testWithUserContext();
  testWithTags();
  testWithExtraContext();
  testWithContexts();

  // Grouping tests
  console.log('\n--- Grouping Tests ---');
  testWithFingerprint();
  testWithTransaction();

  // Severity levels
  console.log('\n--- Severity Levels ---');
  testErrorLevels();

  // Multiple errors
  console.log('\n--- Multiple Errors ---');
  testMultipleErrors();

  // Flush and wait
  console.log('\n--- Flushing Events ---');
  const flushed = await flush(10000);
  console.log(`Flush completed: ${flushed ? 'success' : 'timeout'}`);

  console.log('\n=== All Tests Complete ===\n');
}
