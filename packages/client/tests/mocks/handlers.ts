import { HttpResponse, http } from 'msw';

const BASE_URL = 'http://localhost:8080';

// Mock data
export const mockProjects = [
  {
    id: 1,
    name: 'Test Project',
    slug: 'test-project',
    sentry_key: '123e4567-e89b-12d3-a456-426614174000',
    dsn: 'http://123e4567-e89b-12d3-a456-426614174000@localhost:8080/1',
    stored_event_count: 100,
    digested_event_count: 95,
    created_at: '2026-01-20T10:00:00.000Z',
    updated_at: '2026-01-20T10:00:00.000Z',
  },
  {
    id: 2,
    name: 'Another Project',
    slug: 'another-project',
    sentry_key: '223e4567-e89b-12d3-a456-426614174000',
    dsn: 'http://223e4567-e89b-12d3-a456-426614174000@localhost:8080/2',
    stored_event_count: 50,
    digested_event_count: 48,
    created_at: '2026-01-19T10:00:00.000Z',
    updated_at: '2026-01-19T10:00:00.000Z',
  },
];

export const mockIssues = [
  {
    id: '323e4567-e89b-12d3-a456-426614174000',
    project_id: 1,
    short_id: 'TEST-1',
    title: 'TypeError: Cannot read property',
    value: "Cannot read property 'x' of undefined",
    culprit: 'handleRequest',
    logger: '',
    first_seen: '2026-01-20T10:00:00.000Z',
    last_seen: '2026-01-20T11:00:00.000Z',
    event_count: 5,
    level: 'error',
    platform: 'javascript',
    status: 'unresolved',
    substatus: 'new',
    priority: 'high',
    assigned_to: null,
    assignee_type: null,
    issue_type: 'error',
    issue_category: 'error',
    first_release: '',
    last_release: '',
    status_details: {},
    user_report_count: 0,
    is_resolved: false,
    is_muted: false,
  },
  {
    id: '423e4567-e89b-12d3-a456-426614174000',
    project_id: 1,
    short_id: 'TEST-2',
    title: 'ReferenceError: foo is not defined',
    value: 'foo is not defined',
    culprit: '',
    logger: '',
    first_seen: '2026-01-20T09:00:00.000Z',
    last_seen: '2026-01-20T10:00:00.000Z',
    event_count: 3,
    level: 'error',
    platform: 'javascript',
    status: 'unresolved',
    substatus: 'new',
    priority: 'high',
    assigned_to: null,
    assignee_type: null,
    issue_type: 'error',
    issue_category: 'error',
    first_release: '',
    last_release: '',
    status_details: {},
    user_report_count: 0,
    is_resolved: false,
    is_muted: false,
  },
];

export const mockEvents = [
  {
    id: '523e4567-e89b-12d3-a456-426614174000',
    event_id: '623e4567-e89b-12d3-a456-426614174000',
    issue_id: '323e4567-e89b-12d3-a456-426614174000',
    title: 'TypeError: Cannot read property',
    timestamp: '2026-01-20T11:00:00.000Z',
    level: 'error',
    platform: 'javascript',
    release: '1.0.0',
    environment: 'production',
    event_type: 'error',
  },
];

export const mockEventDetail = {
  id: '523e4567-e89b-12d3-a456-426614174000',
  event_id: '623e4567-e89b-12d3-a456-426614174000',
  issue_id: '323e4567-e89b-12d3-a456-426614174000',
  title: 'TypeError: Cannot read property',
  timestamp: '2026-01-20T11:00:00.000Z',
  ingested_at: '2026-01-20T11:00:01.000Z',
  level: 'error',
  platform: 'javascript',
  release: '1.0.0',
  environment: 'production',
  server_name: 'web-1',
  sdk_name: '@sentry/browser',
  sdk_version: '7.0.0',
  event_type: 'error',
  data: {
    exception: {
      values: [
        {
          type: 'TypeError',
          value: 'Cannot read property',
        },
      ],
    },
  },
};

export const mockTokens = [
  {
    id: 1,
    token_prefix: 'abc12345...',
    description: 'Test Token',
    created_at: '2026-01-20T10:00:00.000Z',
    last_used_at: '2026-01-20T11:00:00.000Z',
  },
];

export const mockTokenFull = {
  id: 1,
  token: 'abc123456789def0123456789abcdef01234567',
  description: 'Test Token',
  created_at: '2026-01-20T10:00:00.000Z',
};

export const mockUser = {
  id: 1,
  email: 'test@example.com',
  role: 'member',
  is_admin: false,
};

export const mockAdminUser = {
  id: 2,
  email: 'admin@example.com',
  role: 'admin',
  is_admin: true,
};

export const mockTeamMembers = [
  {
    id: 1,
    email: 'test@example.com',
    role: 'member',
    is_active: true,
    is_primary: false,
    created_at: '2026-01-20T10:00:00.000Z',
    last_login: '2026-01-20T11:00:00.000Z',
  },
  {
    id: 2,
    email: 'admin@example.com',
    role: 'admin',
    is_active: true,
    is_primary: true,
    created_at: '2026-01-19T10:00:00.000Z',
    last_login: null,
  },
];

export const mockInvitations = [
  {
    token: 'invite-token-abc123',
    email: 'invitee@example.com',
    role: 'member',
    status: 'pending',
    expires_at: '2026-02-20T10:00:00.000Z',
    created_at: '2026-01-20T10:00:00.000Z',
  },
];

export const mockProjectMembers = [
  {
    user_id: 1,
    email: 'test@example.com',
    role: 'editor',
    created_at: '2026-01-20T10:00:00.000Z',
  },
  {
    user_id: 2,
    email: 'admin@example.com',
    role: 'admin',
    created_at: '2026-01-19T10:00:00.000Z',
  },
];

export const mockAlertIntegrations = [
  {
    id: 1,
    name: 'Production Webhook',
    provider_type: 'webhook',
    credentials: {
      url: 'https://example.com/webhook',
      secret: 'webhook-secret',
    },
    is_enabled: true,
    failure_count: 0,
    last_failure_at: null,
    last_failure_message: null,
    last_success_at: '2026-01-20T11:00:00.000Z',
    created_at: '2026-01-20T10:00:00.000Z',
    updated_at: '2026-01-20T10:00:00.000Z',
  },
  {
    id: 2,
    name: 'Slack Alerts',
    provider_type: 'slack',
    credentials: {
      method: 'webhook',
      webhook_url: 'https://hooks.slack.com/services/XXX',
    },
    is_enabled: true,
    failure_count: 0,
    last_failure_at: null,
    last_failure_message: null,
    last_success_at: '2026-01-20T10:30:00.000Z',
    created_at: '2026-01-19T10:00:00.000Z',
    updated_at: '2026-01-19T10:00:00.000Z',
  },
];

/** @deprecated Use mockAlertIntegrations */
export const mockNotificationChannels = mockAlertIntegrations;

export const mockAlertRules = [
  {
    id: 1,
    project_id: 1,
    name: 'New Issue Alert',
    alert_type: 'new_issue',
    is_enabled: true,
    conditions: {},
    cooldown_minutes: 0,
    last_triggered_at: '2026-01-20T11:00:00.000Z',
    integration_ids: [1, 2],
    created_at: '2026-01-20T10:00:00.000Z',
    updated_at: '2026-01-20T10:00:00.000Z',
  },
  {
    id: 2,
    project_id: 1,
    name: 'Regression Alert',
    alert_type: 'regression',
    is_enabled: false,
    conditions: {},
    cooldown_minutes: 60,
    last_triggered_at: null,
    integration_ids: [1],
    created_at: '2026-01-19T10:00:00.000Z',
    updated_at: '2026-01-19T10:00:00.000Z',
  },
];

export const mockAlertHistory = [
  {
    id: 1,
    alert_rule_id: 1,
    integration_id: 1,
    issue_id: '323e4567-e89b-12d3-a456-426614174000',
    project_id: 1,
    alert_type: 'new_issue',
    channel_type: 'webhook',
    channel_name: 'Production Webhook',
    status: 'sent',
    attempt_count: 1,
    next_retry_at: null,
    error_message: null,
    http_status_code: 200,
    idempotency_key: '1-323e4567-1706183600000',
    created_at: '2026-01-20T11:00:00.000Z',
    sent_at: '2026-01-20T11:00:01.000Z',
  },
  {
    id: 2,
    alert_rule_id: 1,
    integration_id: 2,
    issue_id: '323e4567-e89b-12d3-a456-426614174000',
    project_id: 1,
    alert_type: 'new_issue',
    channel_type: 'slack',
    channel_name: 'Slack Alerts',
    status: 'failed',
    attempt_count: 3,
    next_retry_at: null,
    error_message: 'Slack API timeout',
    http_status_code: 504,
    idempotency_key: '1-323e4567-1706183600001',
    created_at: '2026-01-20T11:00:00.000Z',
    sent_at: null,
  },
];

export const handlers = [
  // Projects
  http.get(`${BASE_URL}/api/projects`, () => {
    return HttpResponse.json({
      items: mockProjects,
      total_count: mockProjects.length,
      page: 1,
      per_page: 20,
      total_pages: 1,
    });
  }),

  http.get(`${BASE_URL}/api/projects/:id`, ({ params }) => {
    const { id } = params;
    const project = mockProjects.find((p) => p.id === Number(id));

    if (!project) {
      return HttpResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return HttpResponse.json(project);
  }),

  http.post(`${BASE_URL}/api/projects`, async ({ request }) => {
    const body = (await request.json()) as { name: string; slug?: string };

    const newProject = {
      id: 3,
      name: body.name,
      slug: body.slug ?? body.name.toLowerCase().replace(/\s+/g, '-'),
      sentry_key: '923e4567-e89b-12d3-a456-426614174000',
      dsn: 'http://923e4567-e89b-12d3-a456-426614174000@localhost:8080/3',
      stored_event_count: 0,
      digested_event_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return HttpResponse.json(newProject, { status: 201 });
  }),

  http.patch(`${BASE_URL}/api/projects/:id`, async ({ params, request }) => {
    const { id } = params;
    const body = (await request.json()) as { name?: string };
    const project = mockProjects.find((p) => p.id === Number(id));

    if (!project) {
      return HttpResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const updated = {
      ...project,
      ...body,
      updated_at: new Date().toISOString(),
    };

    return HttpResponse.json(updated);
  }),

  http.delete(`${BASE_URL}/api/projects/:id`, ({ params }) => {
    const { id } = params;
    const project = mockProjects.find((p) => p.id === Number(id));

    if (!project) {
      return HttpResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return new HttpResponse(null, { status: 204 });
  }),

  // Issues
  http.get(`${BASE_URL}/api/projects/:projectId/issues`, ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') ?? '1', 10);
    const q = url.searchParams.get('q');

    // Simple pagination mock - page 2 returns empty
    if (page > 1) {
      return HttpResponse.json({
        items: [],
        total_count: mockIssues.length,
        page: page,
        per_page: 20,
        total_pages: 1,
      });
    }

    const filtered = q
      ? mockIssues.filter((i) =>
          `${i.title} ${i.value} ${i.culprit}`
            .toLowerCase()
            .includes(q.toLowerCase()),
        )
      : mockIssues;

    // The list endpoint returns the lean IssueResponse: it does NOT enrich with
    // `user_report_count` (only the single-issue GET does). Mirror that here so
    // the client schema stays honest about which fields the list omits.
    const items = filtered.map(({ user_report_count: _omit, ...rest }) => rest);

    return HttpResponse.json({
      items,
      total_count: items.length,
      page: 1,
      per_page: 20,
      total_pages: 1,
    });
  }),

  // Issue sub-resources (#165): hashes, tag values, aggregates, stats
  http.get(
    `${BASE_URL}/api/projects/:projectId/issues/:issueId/hashes`,
    ({ params }) => {
      const { issueId } = params;
      return HttpResponse.json([
        {
          id: 1,
          project_id: 1,
          issue_id: issueId,
          grouping_key: 'TypeError: x ⋄ /api',
          grouping_key_hash: 'a'.repeat(64),
          created_at: '2026-01-20T10:00:00.000Z',
        },
      ]);
    },
  ),

  http.get(
    `${BASE_URL}/api/projects/:projectId/issues/:issueId/tags/:key`,
    ({ params }) => {
      const { key } = params;
      return HttpResponse.json({
        key,
        values: [
          { value: 'chrome', count: 2 },
          { value: 'firefox', count: 1 },
        ],
      });
    },
  ),

  http.get(
    `${BASE_URL}/api/projects/:projectId/issues/:issueId/aggregates`,
    () => {
      return HttpResponse.json({
        user_count: 2,
        tags: [
          {
            key: 'browser',
            total_values: 2,
            top_values: [
              { value: 'chrome', count: 2 },
              { value: 'firefox', count: 1 },
            ],
          },
        ],
      });
    },
  ),

  http.get(`${BASE_URL}/api/projects/:projectId/issues/:issueId/stats`, () => {
    return HttpResponse.json({
      data: [
        [1000, 3],
        [4600, 0],
      ],
    });
  }),

  http.get(
    `${BASE_URL}/api/projects/:projectId/issues/:issueId`,
    ({ params }) => {
      const { issueId } = params;
      const issue = mockIssues.find((i) => i.id === issueId);

      if (!issue) {
        return HttpResponse.json({ error: 'Issue not found' }, { status: 404 });
      }

      return HttpResponse.json(issue);
    },
  ),

  http.patch(
    `${BASE_URL}/api/projects/:projectId/issues/:issueId`,
    async ({ params, request }) => {
      const { issueId } = params;
      const body = (await request.json()) as {
        status?: string;
        substatus?: string;
        priority?: string;
        is_resolved?: boolean;
        is_muted?: boolean;
      };
      const issue = mockIssues.find((i) => i.id === issueId);

      if (!issue) {
        return HttpResponse.json({ error: 'Issue not found' }, { status: 404 });
      }

      // Resolve the canonical status the way the server does: `status` wins,
      // then legacy booleans; `resolvedInNextRelease` lands as `resolved`.
      let status = issue.status;
      if (body.status === 'resolvedInNextRelease') {
        status = 'resolved';
      } else if (body.status) {
        status = body.status;
      } else if (body.is_resolved === true) {
        status = 'resolved';
      } else if (body.is_resolved === false) {
        status = 'unresolved';
      } else if (body.is_muted === true) {
        status = 'ignored';
      } else if (body.is_muted === false && status === 'ignored') {
        status = 'unresolved';
      }

      const updated = {
        ...issue,
        status,
        priority: body.priority ?? issue.priority,
        is_resolved: status === 'resolved',
        is_muted: status === 'ignored',
      };

      return HttpResponse.json(updated);
    },
  ),

  http.delete(
    `${BASE_URL}/api/projects/:projectId/issues/:issueId`,
    ({ params }) => {
      const { issueId } = params;
      const issue = mockIssues.find((i) => i.id === issueId);

      if (!issue) {
        return HttpResponse.json({ error: 'Issue not found' }, { status: 404 });
      }

      return new HttpResponse(null, { status: 204 });
    },
  ),

  // Issue bulk operations (#165)
  http.put(
    `${BASE_URL}/api/projects/:projectId/issues`,
    async ({ request }) => {
      const body = (await request.json()) as { ids: string[] };
      return HttpResponse.json({ updated: body.ids.length });
    },
  ),

  http.delete(
    `${BASE_URL}/api/projects/:projectId/issues`,
    async ({ request }) => {
      const body = (await request.json()) as { ids: string[] };
      return HttpResponse.json({ deleted: body.ids.length });
    },
  ),

  // Issue activity & comments (#165)
  http.get(
    `${BASE_URL}/api/projects/:projectId/issues/:issueId/activity`,
    ({ params }) => {
      const { issueId } = params;
      return HttpResponse.json([
        {
          id: '111e4567-e89b-12d3-a456-426614174000',
          issue_id: issueId,
          user_id: 1,
          type: 'note',
          data: '{"text":"looking into it"}',
          created_at: '2026-01-20T12:00:00.000Z',
        },
      ]);
    },
  ),

  http.post(
    `${BASE_URL}/api/projects/:projectId/issues/:issueId/comments`,
    async ({ params, request }) => {
      const { issueId } = params;
      const body = (await request.json()) as { text: string };
      return HttpResponse.json(
        {
          id: '222e4567-e89b-12d3-a456-426614174000',
          issue_id: issueId,
          user_id: 1,
          type: 'note',
          data: JSON.stringify({ text: body.text }),
          created_at: '2026-01-20T12:30:00.000Z',
        },
        { status: 201 },
      );
    },
  ),

  // Bookmark / subscription / seen (#165)
  http.put(
    `${BASE_URL}/api/projects/:projectId/issues/:issueId/bookmark`,
    async ({ request }) => {
      const body = (await request.json()) as { enabled?: boolean };
      return HttpResponse.json({ is_bookmarked: body.enabled ?? true });
    },
  ),

  http.put(
    `${BASE_URL}/api/projects/:projectId/issues/:issueId/subscription`,
    async ({ request }) => {
      const body = (await request.json()) as { enabled?: boolean };
      return HttpResponse.json({ is_subscribed: body.enabled ?? true });
    },
  ),

  http.post(`${BASE_URL}/api/projects/:projectId/issues/:issueId/seen`, () =>
    HttpResponse.json({ has_seen: true }),
  ),

  // User reports (#165)
  http.get(
    `${BASE_URL}/api/projects/:projectId/issues/:issueId/user-reports`,
    ({ params }) => {
      const { issueId } = params;
      return HttpResponse.json([
        {
          id: '333e4567-e89b-12d3-a456-426614174000',
          project_id: 1,
          issue_id: issueId,
          event_id: null,
          name: 'Jane',
          email: 'jane@example.com',
          comments: 'it broke',
          created_at: '2026-01-20T13:00:00.000Z',
        },
      ]);
    },
  ),

  http.post(
    `${BASE_URL}/api/projects/:projectId/issues/:issueId/user-reports`,
    async ({ params, request }) => {
      const { issueId } = params;
      const body = (await request.json()) as {
        name?: string;
        email?: string;
        comments?: string;
      };
      return HttpResponse.json(
        {
          id: '444e4567-e89b-12d3-a456-426614174000',
          project_id: 1,
          issue_id: issueId,
          event_id: null,
          name: body.name ?? '',
          email: body.email ?? '',
          comments: body.comments ?? '',
          created_at: '2026-01-20T13:30:00.000Z',
        },
        { status: 201 },
      );
    },
  ),

  // Deploys (#165)
  http.post(
    `${BASE_URL}/api/projects/:projectId/deploys`,
    async ({ request }) => {
      const body = (await request.json()) as { version: string };
      return HttpResponse.json({ version: body.version, finalized: 1 });
    },
  ),

  // Events
  http.get(`${BASE_URL}/api/projects/:projectId/issues/:issueId/events`, () => {
    return HttpResponse.json({
      items: mockEvents,
      has_more: false,
    });
  }),

  http.get(
    `${BASE_URL}/api/projects/:projectId/issues/:issueId/events/:eventId`,
    ({ params }) => {
      const { eventId } = params;

      if (eventId !== mockEventDetail.id) {
        return HttpResponse.json({ error: 'Event not found' }, { status: 404 });
      }

      return HttpResponse.json(mockEventDetail);
    },
  ),

  // Auth Tokens
  http.get(`${BASE_URL}/api/tokens`, () => {
    return HttpResponse.json(mockTokens);
  }),

  http.get(`${BASE_URL}/api/tokens/:id`, ({ params }) => {
    const { id } = params;
    const token = mockTokens.find((t) => t.id === Number(id));

    if (!token) {
      return HttpResponse.json({ error: 'Token not found' }, { status: 404 });
    }

    // Get by ID now returns the full token (not masked)
    return HttpResponse.json({
      id: token.id,
      token: 'abc123456789def0123456789abcdef01234567',
      description: token.description,
      created_at: token.created_at,
    });
  }),

  http.post(`${BASE_URL}/api/tokens`, async ({ request }) => {
    const body = (await request.json()) as { description?: string };

    const newToken = {
      id: 2,
      token: 'abc123456789def',
      description: body.description ?? null,
      created_at: new Date().toISOString(),
    };

    return HttpResponse.json(newToken, { status: 201 });
  }),

  http.delete(`${BASE_URL}/api/tokens/:id`, ({ params }) => {
    const { id } = params;
    const token = mockTokens.find((t) => t.id === Number(id));

    if (!token) {
      return HttpResponse.json({ error: 'Token not found' }, { status: 404 });
    }

    return new HttpResponse(null, { status: 204 });
  }),

  // Authentication
  http.post(`${BASE_URL}/auth/register`, async ({ request }) => {
    const body = (await request.json()) as {
      email: string;
      password: string;
    };

    // Validate email format
    if (!body.email.includes('@')) {
      return HttpResponse.json(
        { error: 'Invalid email format' },
        { status: 400 },
      );
    }

    // Password is required (no length policy, matching the real server)
    if (body.password.length === 0) {
      return HttpResponse.json(
        { error: 'Password is required' },
        { status: 400 },
      );
    }

    // Check for duplicate email (simulate database constraint)
    if (body.email === 'existing@example.com') {
      return HttpResponse.json(
        { error: 'Email already exists' },
        { status: 400 },
      );
    }

    const newUser = {
      id: 3,
      email: body.email,
      role: 'member',
      is_admin: false,
    };

    return HttpResponse.json(
      { user: newUser },
      {
        status: 201,
        headers: {
          'Set-Cookie': 'session=mock-session-cookie; HttpOnly; SameSite=Lax',
        },
      },
    );
  }),

  http.post(`${BASE_URL}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as {
      email: string;
      password: string;
    };

    // Check credentials
    if (body.email === 'test@example.com' && body.password === 'password123') {
      return HttpResponse.json(
        { user: mockUser },
        {
          status: 200,
          headers: {
            'Set-Cookie': 'session=mock-session-cookie; HttpOnly; SameSite=Lax',
          },
        },
      );
    }

    if (
      body.email === 'admin@example.com' &&
      body.password === 'adminpass123'
    ) {
      return HttpResponse.json(
        { user: mockAdminUser },
        {
          status: 200,
          headers: {
            'Set-Cookie': 'session=mock-session-cookie; HttpOnly; SameSite=Lax',
          },
        },
      );
    }

    // Check for inactive user
    if (body.email === 'inactive@example.com') {
      return HttpResponse.json(
        { error: 'Account is disabled' },
        { status: 401 },
      );
    }

    // Invalid credentials
    return HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }),

  http.post(`${BASE_URL}/auth/logout`, () => {
    return new HttpResponse(null, {
      status: 204,
      headers: {
        'Set-Cookie': 'session=; Max-Age=0',
      },
    });
  }),

  http.get(`${BASE_URL}/auth/me`, ({ request }) => {
    const cookieHeader = request.headers.get('Cookie');

    // Check if session cookie is present
    if (!cookieHeader?.includes('session=mock-session-cookie')) {
      return HttpResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Return current user based on session
    return HttpResponse.json(mockUser);
  }),

  // Public invitation lookup (accept page)
  http.get(`${BASE_URL}/auth/invitation/:token`, ({ params }) => {
    const { token } = params;

    if (token === 'expired-token') {
      return HttpResponse.json(
        { error: 'Invitation expired or used' },
        { status: 400 },
      );
    }

    const invitation = mockInvitations.find((i) => i.token === token);

    if (!invitation) {
      return HttpResponse.json(
        { error: 'Invitation not found' },
        { status: 404 },
      );
    }

    return HttpResponse.json({
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expires_at: invitation.expires_at,
    });
  }),

  // Accept invitation (public)
  http.post(`${BASE_URL}/auth/accept-invitation`, async ({ request }) => {
    const body = (await request.json()) as {
      token: string;
      password: string;
    };

    if (body.token === 'invalid-token') {
      return HttpResponse.json(
        { error: 'Invalid or expired invitation' },
        { status: 400 },
      );
    }

    return HttpResponse.json(
      {
        user: {
          id: 5,
          email: 'invitee@example.com',
          role: 'member',
          is_admin: false,
        },
      },
      {
        status: 201,
        headers: {
          'Set-Cookie': 'session=mock-session-cookie; HttpOnly; SameSite=Lax',
        },
      },
    );
  }),

  // Team (users)
  http.get(`${BASE_URL}/api/team`, () => {
    return HttpResponse.json(mockTeamMembers);
  }),

  http.patch(
    `${BASE_URL}/api/team/:userId/role`,
    async ({ params, request }) => {
      const { userId } = params;
      const body = (await request.json()) as { role: string };

      if (body.role !== 'admin' && body.role !== 'member') {
        return HttpResponse.json({ error: 'Invalid role' }, { status: 400 });
      }

      const member = mockTeamMembers.find((m) => m.id === Number(userId));

      if (!member) {
        return HttpResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // Simulate "cannot demote the last admin"
      if (member.id === 2 && body.role === 'member') {
        return HttpResponse.json(
          { error: 'Cannot demote the last admin' },
          { status: 409 },
        );
      }

      return new HttpResponse(null, { status: 204 });
    },
  ),

  http.delete(`${BASE_URL}/api/team/:userId`, ({ params }) => {
    const member = mockTeamMembers.find((m) => m.id === Number(params.userId));
    if (!member) {
      return HttpResponse.json({ error: 'User not found' }, { status: 404 });
    }
    // Simulate "the primary user cannot be deleted".
    if (member.is_primary) {
      return HttpResponse.json(
        { error: 'The primary admin cannot be deleted' },
        { status: 403 },
      );
    }
    return new HttpResponse(null, { status: 204 });
  }),

  // Invitations
  http.get(`${BASE_URL}/api/invitations`, () => {
    return HttpResponse.json(mockInvitations);
  }),

  http.post(`${BASE_URL}/api/invitations`, async ({ request }) => {
    const body = (await request.json()) as { email: string; role: string };

    if (body.role !== 'admin' && body.role !== 'member') {
      return HttpResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    if (body.email === 'existing@example.com') {
      return HttpResponse.json(
        { error: 'Email already a user or pending invite' },
        { status: 409 },
      );
    }

    return HttpResponse.json(
      {
        token: 'new-invite-token',
        email: body.email,
        role: body.role,
        status: 'pending',
        expires_at: '2026-02-20T10:00:00.000Z',
        created_at: new Date().toISOString(),
      },
      { status: 201 },
    );
  }),

  http.delete(`${BASE_URL}/api/invitations/:token`, ({ params }) => {
    const { token } = params;
    const invitation = mockInvitations.find((i) => i.token === token);

    if (!invitation) {
      return HttpResponse.json(
        { error: 'Pending invitation not found' },
        { status: 404 },
      );
    }

    return new HttpResponse(null, { status: 204 });
  }),

  // Project members
  http.get(`${BASE_URL}/api/projects/:projectId/members`, ({ params }) => {
    const { projectId } = params;
    const project = mockProjects.find((p) => p.id === Number(projectId));

    if (!project) {
      return HttpResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return HttpResponse.json(mockProjectMembers);
  }),

  http.put(
    `${BASE_URL}/api/projects/:projectId/members`,
    async ({ params, request }) => {
      const { projectId } = params;
      const body = (await request.json()) as {
        user_id: number;
        role: string;
      };
      const project = mockProjects.find((p) => p.id === Number(projectId));

      if (!project) {
        return HttpResponse.json(
          { error: 'Project or user not found' },
          { status: 404 },
        );
      }

      if (!['viewer', 'editor', 'admin'].includes(body.role)) {
        return HttpResponse.json({ error: 'Invalid role' }, { status: 400 });
      }

      // Simulate "cannot downgrade last project admin"
      if (body.user_id === 2 && body.role !== 'admin') {
        return HttpResponse.json(
          { error: 'Cannot downgrade last project admin' },
          { status: 409 },
        );
      }

      return new HttpResponse(null, { status: 200 });
    },
  ),

  http.delete(
    `${BASE_URL}/api/projects/:projectId/members/:userId`,
    ({ params }) => {
      const { userId } = params;
      const member = mockProjectMembers.find(
        (m) => m.user_id === Number(userId),
      );

      if (!member) {
        return HttpResponse.json(
          { error: 'Membership not found' },
          { status: 404 },
        );
      }

      // Simulate "cannot remove last project admin"
      if (member.user_id === 2) {
        return HttpResponse.json(
          { error: 'Cannot remove last project admin' },
          { status: 409 },
        );
      }

      return new HttpResponse(null, { status: 204 });
    },
  ),

  // Alert Integrations (Global)
  http.get(`${BASE_URL}/api/integrations`, () => {
    return HttpResponse.json(mockAlertIntegrations);
  }),

  http.get(`${BASE_URL}/api/integrations/:id`, ({ params }) => {
    const { id } = params;
    const integration = mockAlertIntegrations.find((c) => c.id === Number(id));

    if (!integration) {
      return HttpResponse.json(
        { error: 'Integration not found' },
        { status: 404 },
      );
    }

    return HttpResponse.json(integration);
  }),

  http.post(`${BASE_URL}/api/integrations`, async ({ request }) => {
    const body = (await request.json()) as {
      name: string;
      provider_type: string;
      credentials: Record<string, unknown>;
      is_enabled?: boolean;
    };

    const newIntegration = {
      id: 3,
      name: body.name,
      provider_type: body.provider_type,
      credentials: body.credentials,
      is_enabled: body.is_enabled ?? true,
      failure_count: 0,
      last_failure_at: null,
      last_failure_message: null,
      last_success_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return HttpResponse.json(newIntegration, { status: 201 });
  }),

  http.patch(
    `${BASE_URL}/api/integrations/:id`,
    async ({ params, request }) => {
      const { id } = params;
      const body = (await request.json()) as {
        name?: string;
        credentials?: Record<string, unknown>;
        is_enabled?: boolean;
      };
      const integration = mockAlertIntegrations.find(
        (c) => c.id === Number(id),
      );

      if (!integration) {
        return HttpResponse.json(
          { error: 'Integration not found' },
          { status: 404 },
        );
      }

      const updated = {
        ...integration,
        ...body,
        updated_at: new Date().toISOString(),
      };

      return HttpResponse.json(updated);
    },
  ),

  http.delete(`${BASE_URL}/api/integrations/:id`, ({ params }) => {
    const { id } = params;
    const integration = mockAlertIntegrations.find((c) => c.id === Number(id));

    if (!integration) {
      return HttpResponse.json(
        { error: 'Integration not found' },
        { status: 404 },
      );
    }

    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${BASE_URL}/api/integrations/:id/test`, ({ params }) => {
    const { id } = params;
    const integration = mockAlertIntegrations.find((c) => c.id === Number(id));

    if (!integration) {
      return HttpResponse.json(
        { error: 'Integration not found' },
        { status: 404 },
      );
    }

    return HttpResponse.json({
      success: true,
      message: 'Test notification sent successfully',
    });
  }),

  // Alert Rules (Per-Project)
  http.get(`${BASE_URL}/api/projects/:projectId/alert-rules`, ({ params }) => {
    const { projectId } = params;
    const rules = mockAlertRules.filter(
      (r) => r.project_id === Number(projectId),
    );

    return HttpResponse.json(rules);
  }),

  http.get(
    `${BASE_URL}/api/projects/:projectId/alert-rules/:ruleId`,
    ({ params }) => {
      const { projectId, ruleId } = params;
      const rule = mockAlertRules.find(
        (r) => r.project_id === Number(projectId) && r.id === Number(ruleId),
      );

      if (!rule) {
        return HttpResponse.json({ error: 'Rule not found' }, { status: 404 });
      }

      return HttpResponse.json(rule);
    },
  ),

  http.post(
    `${BASE_URL}/api/projects/:projectId/alert-rules`,
    async ({ params, request }) => {
      const { projectId } = params;
      const body = (await request.json()) as {
        name: string;
        alert_type: string;
        is_enabled?: boolean;
        conditions?: Record<string, unknown>;
        cooldown_minutes?: number;
        channels?: Array<{
          integration_id: number;
          routing_override?: Record<string, unknown>;
        }>;
      };

      const integrationIds = body.channels?.map((c) => c.integration_id) ?? [];

      const newRule = {
        id: 3,
        project_id: Number(projectId),
        name: body.name,
        alert_type: body.alert_type,
        is_enabled: body.is_enabled ?? true,
        conditions: body.conditions ?? {},
        cooldown_minutes: body.cooldown_minutes ?? 0,
        last_triggered_at: null,
        integration_ids: integrationIds,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      return HttpResponse.json(newRule, { status: 201 });
    },
  ),

  http.patch(
    `${BASE_URL}/api/projects/:projectId/alert-rules/:ruleId`,
    async ({ params, request }) => {
      const { projectId, ruleId } = params;
      const body = (await request.json()) as {
        name?: string;
        is_enabled?: boolean;
        conditions?: Record<string, unknown>;
        cooldown_minutes?: number;
        channels?: Array<{
          integration_id: number;
          routing_override?: Record<string, unknown>;
        }>;
      };
      const rule = mockAlertRules.find(
        (r) => r.project_id === Number(projectId) && r.id === Number(ruleId),
      );

      if (!rule) {
        return HttpResponse.json({ error: 'Rule not found' }, { status: 404 });
      }

      const integrationIds = body.channels
        ? body.channels.map((c) => c.integration_id)
        : rule.integration_ids;

      const updated = {
        ...rule,
        ...body,
        integration_ids: integrationIds,
        updated_at: new Date().toISOString(),
      };

      return HttpResponse.json(updated);
    },
  ),

  http.delete(
    `${BASE_URL}/api/projects/:projectId/alert-rules/:ruleId`,
    ({ params }) => {
      const { projectId, ruleId } = params;
      const rule = mockAlertRules.find(
        (r) => r.project_id === Number(projectId) && r.id === Number(ruleId),
      );

      if (!rule) {
        return HttpResponse.json({ error: 'Rule not found' }, { status: 404 });
      }

      return new HttpResponse(null, { status: 204 });
    },
  ),

  // Alert History
  http.get(
    `${BASE_URL}/api/projects/:projectId/alert-history`,
    ({ params, request }) => {
      const { projectId } = params;
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);

      const history = mockAlertHistory
        .filter((h) => h.project_id === Number(projectId))
        .slice(0, limit);

      return HttpResponse.json(history);
    },
  ),

  // Source Maps — chunk upload capabilities
  http.get(
    `${BASE_URL}/api/0/organizations/:orgSlug/chunk-upload/`,
    ({ params }) => {
      const { orgSlug } = params;
      return HttpResponse.json({
        url: `http://localhost:8080/api/0/organizations/${orgSlug}/chunk-upload/`,
        chunkSize: 2097152,
        chunksPerRequest: 64,
        maxRequestSize: 33554432,
        hashAlgorithm: 'sha1',
        accept: ['artifact_bundles', 'artifact_bundles_v2'],
      });
    },
  ),

  // Source Maps — chunk upload
  http.post(
    `${BASE_URL}/api/0/organizations/:orgSlug/chunk-upload/`,
    () => new HttpResponse(null, { status: 200 }),
  ),

  // Source Maps — artifact bundle assemble
  http.post(
    `${BASE_URL}/api/0/organizations/:orgSlug/artifactbundle/assemble/`,
    async ({ request }) => {
      const body = (await request.json()) as {
        checksum: string;
        chunks: string[];
        projects: string[];
      };

      if (body.projects.length === 0) {
        return HttpResponse.json(
          { detail: 'projects array must not be empty' },
          { status: 400 },
        );
      }

      // Simulate missing chunks scenario when checksum starts with 'missing'
      if (body.checksum.startsWith('missing')) {
        return HttpResponse.json(
          {
            state: 'not_found',
            missingChunks: body.chunks.slice(0, 1),
          },
          { status: 202 },
        );
      }

      return HttpResponse.json({ state: 'ok', missingChunks: [] });
    },
  ),

  // Sessions — release health stats
  http.get(
    `${BASE_URL}/api/projects/:projectId/sessions/stats`,
    ({ params }) => {
      if (params.projectId === '999') {
        return HttpResponse.json({ error: 'not found' }, { status: 404 });
      }
      return HttpResponse.json([
        {
          release: '1.0.0',
          environment: 'production',
          total: 100,
          errored: 5,
          crashed: 2,
          abnormal: 1,
          healthy: 92,
          crash_free_sessions_rate: 0.98,
          crash_free_users_rate: 0.99,
        },
      ]);
    },
  ),

  // Logs — list logs for project
  http.get(`${BASE_URL}/api/projects/:projectId/logs`, ({ params }) => {
    if (params.projectId === '999') {
      return HttpResponse.json({ error: 'not found' }, { status: 404 });
    }
    return HttpResponse.json({
      items: [
        {
          id: 'a1b2c3d4-e89b-12d3-a456-426614174000',
          trace_id: 'bbbb',
          span_id: null,
          level: 'info',
          severity_number: 9,
          body: 'ok',
          attributes: {},
          timestamp: '2026-06-18T12:00:01.000Z',
          ingested_at: '2026-06-18T12:00:02.000Z',
        },
        {
          id: 'b2c3d4e5-e89b-12d3-a456-426614174000',
          trace_id: 'aaaa',
          span_id: 'eee19b7ec3c1b174',
          level: 'error',
          severity_number: 17,
          body: 'boom',
          attributes: { 'string.attribute': { value: 'v', type: 'string' } },
          timestamp: '2026-06-18T12:00:00.000Z',
          ingested_at: '2026-06-18T12:00:02.000Z',
        },
      ],
      total_count: 2,
      page: 1,
      per_page: 20,
      total_pages: 1,
    });
  }),

  // Transactions — list transactions for project
  http.get(`${BASE_URL}/api/projects/:projectId/transactions`, ({ params }) => {
    if (params.projectId === '999') {
      return HttpResponse.json({ error: 'not found' }, { status: 404 });
    }
    return HttpResponse.json({
      items: [
        {
          id: 'a1b2c3d4-e89b-12d3-a456-426614174000',
          event_id: 'b2c3d4e5-e89b-12d3-a456-426614174000',
          transaction_name: '/api/checkout',
          timestamp: '2026-06-18T12:00:00.000Z',
          start_timestamp: '2026-06-18T11:59:59.000Z',
          duration_ms: 1000.0,
          platform: 'javascript',
          environment: 'production',
          release: '1.0.0',
          ingested_at: '2026-06-18T12:00:01.000Z',
        },
      ],
      total_count: 1,
      page: 1,
      per_page: 20,
      total_pages: 1,
    });
  }),

  // Transactions — aggregate stats (must precede the :transactionId handler,
  // otherwise "stats" is captured as a transaction id).
  http.get(`${BASE_URL}/api/projects/:projectId/transactions/stats`, () => {
    return HttpResponse.json({
      items: [
        {
          transaction_name: '/api/checkout',
          op: 'http.server',
          count: 3,
          p50_ms: 200.0,
          p95_ms: 290.0,
          p99_ms: 298.0,
          failure_rate: 0.3333333333333333,
        },
      ],
      total_count: 1,
      page: 1,
      per_page: 20,
      total_pages: 1,
    });
  }),

  // Transactions — single group's aggregate stats
  http.get(
    `${BASE_URL}/api/projects/:projectId/transactions/stats/group`,
    ({ request }) => {
      const url = new URL(request.url);
      if (url.searchParams.get('name') === '/missing') {
        return HttpResponse.json({ error: 'not found' }, { status: 404 });
      }
      return HttpResponse.json({
        transaction_name: '/api/checkout',
        op: 'http.server',
        count: 3,
        p50_ms: 200.0,
        p95_ms: 290.0,
        p99_ms: 298.0,
        failure_rate: 0.3333333333333333,
      });
    },
  ),

  // Transactions — indexed spans for a transaction
  http.get(
    `${BASE_URL}/api/projects/:projectId/transactions/:transactionId/spans`,
    () => {
      return HttpResponse.json([
        {
          id: 'c3d4e5f6-e89b-12d3-a456-426614174000',
          span_id: 'cccccccccccccccc',
          trace_id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          parent_span_id: 'bbbbbbbbbbbbbbbb',
          op: 'db.query',
          description: 'SELECT 1',
          status: 'ok',
          start_timestamp: '2026-06-18T11:59:59.000Z',
          timestamp: '2026-06-18T11:59:59.500Z',
          duration_ms: 500.0,
          exclusive_time_ms: 500.0,
          is_segment: false,
          segment_id: null,
        },
      ]);
    },
  ),

  // Transactions — get single transaction detail
  http.get(
    `${BASE_URL}/api/projects/:projectId/transactions/:transactionId`,
    ({ params }) => {
      if (params.transactionId === 'missing') {
        return HttpResponse.json({ error: 'not found' }, { status: 404 });
      }
      return HttpResponse.json({
        id: 'a1b2c3d4-e89b-12d3-a456-426614174000',
        event_id: 'b2c3d4e5-e89b-12d3-a456-426614174000',
        transaction_name: '/api/checkout',
        timestamp: '2026-06-18T12:00:00.000Z',
        start_timestamp: '2026-06-18T11:59:59.000Z',
        duration_ms: 1000.0,
        platform: 'javascript',
        environment: 'production',
        release: '1.0.0',
        ingested_at: '2026-06-18T12:00:01.000Z',
        data: {
          transaction: '/api/checkout',
          contexts: {
            trace: { trace_id: 'abc', span_id: 'root', op: 'http.server' },
          },
          spans: [
            {
              span_id: 'child1',
              parent_span_id: 'root',
              op: 'db',
              description: 'SELECT 1',
              start_timestamp: 1.0,
              timestamp: 1.5,
            },
          ],
          measurements: { lcp: { value: 1200.0, unit: 'millisecond' } },
          tags: { browser: 'Chrome' },
        },
      });
    },
  ),

  // Source Maps — list source maps for project
  http.get(
    `${BASE_URL}/api/0/projects/:orgSlug/:projectSlug/files/source-maps/`,
    ({ params }) => {
      if (params.projectSlug === 'not-found') {
        return HttpResponse.json(
          { error: 'project not found' },
          { status: 404 },
        );
      }
      return HttpResponse.json({
        data: [
          {
            debugId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            fileType: 'source_map',
            size: 15234,
            timesUsed: 3,
            dateUploaded: '2026-05-22T10:00:00',
          },
        ],
      });
    },
  ),

  // Storage — instance-wide summary
  http.get(`${BASE_URL}/api/storage/summary`, () => {
    return HttpResponse.json({
      total_db_size_bytes: 1048576,
      events_count: 120,
      transactions_count: 80,
      spans_count: 640,
      logs_count: 200,
      source_maps: {
        chunk_bytes: 350,
        source_file_bytes: 300,
        total_bytes: 650,
        file_count: 2,
      },
    });
  }),

  // Storage — per-project breakdown
  http.get(`${BASE_URL}/api/storage/projects`, () => {
    return HttpResponse.json([
      {
        project_id: 1,
        project_name: 'Test Project',
        events_count: 100,
        transactions_count: 80,
        spans_count: 640,
        logs_count: 200,
        source_maps_count: 2,
        estimated_bytes: 524288,
      },
      {
        project_id: 2,
        project_name: 'Another Project',
        events_count: 0,
        transactions_count: 0,
        spans_count: 0,
        logs_count: 0,
        source_maps_count: 0,
        estimated_bytes: 0,
      },
    ]);
  }),

  // Storage — cleanup dry-run preview
  http.post(`${BASE_URL}/api/storage/cleanup/preview`, () => {
    return HttpResponse.json({
      events: 20,
      transactions: 10,
      spans: 80,
      logs: 50,
      issues_removed: 3,
    });
  }),

  // Storage — execute cleanup
  http.post(`${BASE_URL}/api/storage/cleanup`, () => {
    return HttpResponse.json({
      events: 20,
      transactions: 10,
      spans: 80,
      logs: 50,
      issues_removed: 3,
    });
  }),

  // Storage — dry-run orphaned source-map GC
  http.post(`${BASE_URL}/api/storage/source-maps/gc/preview`, () => {
    return HttpResponse.json({ files_removed: 4, bytes_freed: 81920 });
  }),

  // Storage — garbage-collect orphaned source maps
  http.post(`${BASE_URL}/api/storage/source-maps/gc`, () => {
    return HttpResponse.json({ files_removed: 4, bytes_freed: 81920 });
  }),
];
