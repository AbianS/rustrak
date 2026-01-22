#!/usr/bin/env node

import {
  flush,
  initSentry,
  runAllTests,
  testAsyncError,
  testCapturedError,
  testCaptureMessage,
  testCustomError,
  testErrorFlood,
  testErrorLevels,
  testMultipleErrors,
  testNestedError,
  testReferenceError,
  testTypeError,
  testWithBreadcrumbs,
  testWithContexts,
  testWithExtraContext,
  testWithFingerprint,
  testWithTags,
  testWithTransaction,
  testWithUserContext,
} from './index.js';

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message: string, color = colors.reset): void {
  console.log(`${color}${message}${colors.reset}`);
}

function printBanner(): void {
  log(
    '\n╔══════════════════════════════════════════════════════════════╗',
    colors.cyan,
  );
  log(
    '║           🔬 Rustrak Sentry Test Utility                     ║',
    colors.cyan,
  );
  log(
    '╚══════════════════════════════════════════════════════════════╝',
    colors.cyan,
  );
}

function printHelp(): void {
  printBanner();
  log('\nUsage: test-sentry [options]', colors.bright);
  log('\nRequired:', colors.yellow);
  log('  --dsn <dsn>         Sentry/Rustrak DSN (or set SENTRY_DSN env var)');
  log('\nTest Options:', colors.yellow);
  log('  --all               Run all tests');
  log('  --error             Basic captured error');
  log('  --type-error        TypeError exception');
  log('  --ref-error         ReferenceError exception');
  log('  --custom-error      Custom error class');
  log('  --nested            Nested error with cause');
  log('  --async             Async stack trace');
  log('  --message           Capture message (non-error)');
  log('  --breadcrumbs       Error with breadcrumbs');
  log('  --user              Error with user context');
  log('  --tags              Error with custom tags');
  log('  --context           Error with extra context');
  log('  --contexts          Error with rich contexts (device, os, app)');
  log('  --fingerprint       Error with custom fingerprint');
  log('  --transaction       Error with transaction name');
  log('  --levels            Test all severity levels');
  log('  --multiple          Multiple sequential errors');
  log('  --flood [count]     Send many errors (default: 50)');
  log('\nConfiguration:', colors.yellow);
  log('  --debug             Enable Sentry debug mode');
  log('  --env <env>         Set environment (default: test)');
  log('  --release <rel>     Set release version');
  log('  --help              Show this help message');
  log('\nExamples:', colors.green);
  log('  # Run all tests with DSN');
  log('  test-sentry --dsn "http://key@localhost:8080/1" --all');
  log('\n  # Run specific test');
  log('  test-sentry --dsn "http://key@localhost:8080/1" --error');
  log('\n  # Test rate limiting (flood)');
  log('  test-sentry --dsn "http://key@localhost:8080/1" --flood 100');
  log('\n  # Use environment variable');
  log('  SENTRY_DSN="http://key@localhost:8080/1" test-sentry --all');
  log('');
}

interface CliOptions {
  dsn?: string;
  debug: boolean;
  env: string;
  release?: string;
  tests: Set<string>;
  floodCount: number;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    debug: false,
    env: 'test',
    tests: new Set(),
    floodCount: 50,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--dsn':
        options.dsn = args[++i];
        break;
      case '--debug':
        options.debug = true;
        break;
      case '--env':
        options.env = args[++i];
        break;
      case '--release':
        options.release = args[++i];
        break;
      case '--all':
        options.tests.add('all');
        break;
      case '--error':
        options.tests.add('error');
        break;
      case '--type-error':
        options.tests.add('type-error');
        break;
      case '--ref-error':
        options.tests.add('ref-error');
        break;
      case '--custom-error':
        options.tests.add('custom-error');
        break;
      case '--nested':
        options.tests.add('nested');
        break;
      case '--async':
        options.tests.add('async');
        break;
      case '--message':
        options.tests.add('message');
        break;
      case '--breadcrumbs':
        options.tests.add('breadcrumbs');
        break;
      case '--user':
        options.tests.add('user');
        break;
      case '--tags':
        options.tests.add('tags');
        break;
      case '--context':
        options.tests.add('context');
        break;
      case '--contexts':
        options.tests.add('contexts');
        break;
      case '--fingerprint':
        options.tests.add('fingerprint');
        break;
      case '--transaction':
        options.tests.add('transaction');
        break;
      case '--levels':
        options.tests.add('levels');
        break;
      case '--multiple':
        options.tests.add('multiple');
        break;
      case '--flood':
        options.tests.add('flood');
        // Check if next arg is a number
        const nextArg = args[i + 1];
        if (nextArg && !nextArg.startsWith('-')) {
          const count = parseInt(nextArg, 10);
          if (!isNaN(count)) {
            options.floodCount = count;
            i++;
          }
        }
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  // Check environment variable for DSN
  if (!options.dsn) {
    options.dsn = process.env.SENTRY_DSN;
  }

  return options;
}

async function runSelectedTests(options: CliOptions): Promise<void> {
  const tests = options.tests;

  if (tests.has('all')) {
    await runAllTests();
    return;
  }

  // Run individual tests
  if (tests.has('error')) {
    log('\n--- Basic Captured Error ---', colors.yellow);
    testCapturedError();
  }

  if (tests.has('type-error')) {
    log('\n--- TypeError ---', colors.yellow);
    testTypeError();
  }

  if (tests.has('ref-error')) {
    log('\n--- ReferenceError ---', colors.yellow);
    testReferenceError();
  }

  if (tests.has('custom-error')) {
    log('\n--- Custom Error ---', colors.yellow);
    testCustomError();
  }

  if (tests.has('nested')) {
    log('\n--- Nested Error ---', colors.yellow);
    testNestedError();
  }

  if (tests.has('async')) {
    log('\n--- Async Error ---', colors.yellow);
    await testAsyncError();
  }

  if (tests.has('message')) {
    log('\n--- Capture Message ---', colors.yellow);
    testCaptureMessage();
  }

  if (tests.has('breadcrumbs')) {
    log('\n--- Breadcrumbs ---', colors.yellow);
    testWithBreadcrumbs();
  }

  if (tests.has('user')) {
    log('\n--- User Context ---', colors.yellow);
    testWithUserContext();
  }

  if (tests.has('tags')) {
    log('\n--- Tags ---', colors.yellow);
    testWithTags();
  }

  if (tests.has('context')) {
    log('\n--- Extra Context ---', colors.yellow);
    testWithExtraContext();
  }

  if (tests.has('contexts')) {
    log('\n--- Rich Contexts ---', colors.yellow);
    testWithContexts();
  }

  if (tests.has('fingerprint')) {
    log('\n--- Custom Fingerprint ---', colors.yellow);
    testWithFingerprint();
  }

  if (tests.has('transaction')) {
    log('\n--- Transaction ---', colors.yellow);
    testWithTransaction();
  }

  if (tests.has('levels')) {
    log('\n--- Severity Levels ---', colors.yellow);
    testErrorLevels();
  }

  if (tests.has('multiple')) {
    log('\n--- Multiple Errors ---', colors.yellow);
    testMultipleErrors();
  }

  if (tests.has('flood')) {
    log(`\n--- Error Flood (${options.floodCount} events) ---`, colors.yellow);
    testErrorFlood(options.floodCount);
  }

  // Flush all events
  log('\n--- Flushing Events ---', colors.cyan);
  const flushed = await flush(10000);
  log(
    `Flush ${flushed ? 'completed successfully' : 'timed out'}`,
    flushed ? colors.green : colors.red,
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Check for help flag first
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  const options = parseArgs(args);

  // Validate DSN
  if (!options.dsn) {
    log('\n❌ Error: DSN is required', colors.red);
    log(
      '   Use --dsn <dsn> or set SENTRY_DSN environment variable',
      colors.dim,
    );
    log('   Run with --help for usage information\n', colors.dim);
    process.exit(1);
  }

  // Validate at least one test is selected
  if (options.tests.size === 0) {
    log('\n❌ Error: No test selected', colors.red);
    log('   Use --all to run all tests, or select specific tests', colors.dim);
    log('   Run with --help for available tests\n', colors.dim);
    process.exit(1);
  }

  printBanner();

  log(`\n📡 DSN: ${options.dsn}`, colors.dim);
  log(`🌍 Environment: ${options.env}`, colors.dim);
  if (options.release) {
    log(`📦 Release: ${options.release}`, colors.dim);
  }
  if (options.debug) {
    log(`🐛 Debug mode: enabled`, colors.dim);
  }

  // Initialize Sentry
  log('\n⚡ Initializing Sentry...', colors.cyan);
  initSentry({
    dsn: options.dsn,
    debug: options.debug,
    environment: options.env,
    release: options.release,
  });

  // Run tests
  try {
    await runSelectedTests(options);
    log('\n✅ All tests completed!', colors.green);
  } catch (error) {
    log(`\n❌ Test failed: ${error}`, colors.red);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
