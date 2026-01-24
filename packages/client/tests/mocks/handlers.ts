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
    first_seen: '2026-01-20T10:00:00.000Z',
    last_seen: '2026-01-20T11:00:00.000Z',
    event_count: 5,
    level: 'error',
    platform: 'javascript',
    is_resolved: false,
    is_muted: false,
  },
  {
    id: '423e4567-e89b-12d3-a456-426614174000',
    project_id: 1,
    short_id: 'TEST-2',
    title: 'ReferenceError: foo is not defined',
    value: 'foo is not defined',
    first_seen: '2026-01-20T09:00:00.000Z',
    last_seen: '2026-01-20T10:00:00.000Z',
    event_count: 3,
    level: 'error',
    platform: 'javascript',
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

export const mockUser = {
  id: 1,
  email: 'test@example.com',
  is_admin: false,
};

export const mockAdminUser = {
  id: 2,
  email: 'admin@example.com',
  is_admin: true,
};

export const mockNotificationChannels = [
  {
    id: 1,
    name: 'Production Webhook',
    channel_type: 'webhook',
    config: {
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
    channel_type: 'slack',
    config: {
      webhook_url: 'https://hooks.slack.com/services/XXX',
      channel: '#alerts',
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
    channel_ids: [1, 2],
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
    channel_ids: [1],
    created_at: '2026-01-19T10:00:00.000Z',
    updated_at: '2026-01-19T10:00:00.000Z',
  },
];

export const mockAlertHistory = [
  {
    id: 1,
    alert_rule_id: 1,
    channel_id: 1,
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
    channel_id: 2,
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

    return HttpResponse.json({
      items: mockIssues,
      total_count: mockIssues.length,
      page: 1,
      per_page: 20,
      total_pages: 1,
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
        is_resolved?: boolean;
        is_muted?: boolean;
      };
      const issue = mockIssues.find((i) => i.id === issueId);

      if (!issue) {
        return HttpResponse.json({ error: 'Issue not found' }, { status: 404 });
      }

      const updated = {
        ...issue,
        ...body,
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

    return HttpResponse.json(token);
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

    // Validate password length
    if (body.password.length < 8) {
      return HttpResponse.json(
        { error: 'Password must be at least 8 characters' },
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
    if (
      !cookieHeader ||
      !cookieHeader.includes('session=mock-session-cookie')
    ) {
      return HttpResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Return current user based on session
    return HttpResponse.json(mockUser);
  }),

  // Alert Channels (Global)
  http.get(`${BASE_URL}/api/alert-channels`, () => {
    return HttpResponse.json(mockNotificationChannels);
  }),

  http.get(`${BASE_URL}/api/alert-channels/:id`, ({ params }) => {
    const { id } = params;
    const channel = mockNotificationChannels.find((c) => c.id === Number(id));

    if (!channel) {
      return HttpResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    return HttpResponse.json(channel);
  }),

  http.post(`${BASE_URL}/api/alert-channels`, async ({ request }) => {
    const body = (await request.json()) as {
      name: string;
      channel_type: string;
      config: Record<string, unknown>;
      is_enabled?: boolean;
    };

    const newChannel = {
      id: 3,
      name: body.name,
      channel_type: body.channel_type,
      config: body.config,
      is_enabled: body.is_enabled ?? true,
      failure_count: 0,
      last_failure_at: null,
      last_failure_message: null,
      last_success_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return HttpResponse.json(newChannel, { status: 201 });
  }),

  http.patch(
    `${BASE_URL}/api/alert-channels/:id`,
    async ({ params, request }) => {
      const { id } = params;
      const body = (await request.json()) as {
        name?: string;
        config?: Record<string, unknown>;
        is_enabled?: boolean;
      };
      const channel = mockNotificationChannels.find((c) => c.id === Number(id));

      if (!channel) {
        return HttpResponse.json(
          { error: 'Channel not found' },
          { status: 404 },
        );
      }

      const updated = {
        ...channel,
        ...body,
        updated_at: new Date().toISOString(),
      };

      return HttpResponse.json(updated);
    },
  ),

  http.delete(`${BASE_URL}/api/alert-channels/:id`, ({ params }) => {
    const { id } = params;
    const channel = mockNotificationChannels.find((c) => c.id === Number(id));

    if (!channel) {
      return HttpResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${BASE_URL}/api/alert-channels/:id/test`, ({ params }) => {
    const { id } = params;
    const channel = mockNotificationChannels.find((c) => c.id === Number(id));

    if (!channel) {
      return HttpResponse.json({ error: 'Channel not found' }, { status: 404 });
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
        channel_ids: number[];
      };

      const newRule = {
        id: 3,
        project_id: Number(projectId),
        name: body.name,
        alert_type: body.alert_type,
        is_enabled: body.is_enabled ?? true,
        conditions: body.conditions ?? {},
        cooldown_minutes: body.cooldown_minutes ?? 0,
        last_triggered_at: null,
        channel_ids: body.channel_ids,
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
        channel_ids?: number[];
      };
      const rule = mockAlertRules.find(
        (r) => r.project_id === Number(projectId) && r.id === Number(ruleId),
      );

      if (!rule) {
        return HttpResponse.json({ error: 'Rule not found' }, { status: 404 });
      }

      const updated = {
        ...rule,
        ...body,
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
];
