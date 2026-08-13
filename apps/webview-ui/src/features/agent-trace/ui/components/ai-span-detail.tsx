import type { SpanDetail } from '@rustrak/client';
import { getFormatter, getTranslations } from 'next-intl/server';
import {
  aiInput,
  aiOutput,
  availableTools,
  hasTokenMismatch,
  tokenBreakdown,
} from '@/features/agent-trace/model/gen-ai';
import { Badge } from '@/shared/ui/components/shadcn/badge';

interface AiSpanDetailProps {
  span: SpanDetail;
}

/**
 * Renders a value that arrived as an SDK-serialized JSON string.
 *
 * Pretty-printing is best-effort: these strings are frequently truncated by
 * the SDK's own size limits, and a half-written JSON array is still the most
 * useful thing available to a reader. So a parse failure falls back to the
 * raw text rather than hiding it.
 */
function Payload({ value }: { value: string }) {
  let text = value;
  try {
    text = JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    // Left as received.
  }

  return (
    <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/40 px-3 py-2 font-mono text-[11px] leading-relaxed">
      {text}
    </pre>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * The details panel for one selected span.
 *
 * Ordering follows Sentry's own: identity first (agent, model), then the
 * numbers a reader compares across spans (tokens, duration), then the payload
 * that explains them. The raw attribute table sits last as the escape hatch
 * for anything this panel does not model.
 */
export async function AiSpanDetail({ span }: AiSpanDetailProps) {
  const t = await getTranslations('agents.spanDetail');
  const format = await getFormatter();

  const attributes = span.attributes;
  const tokens = tokenBreakdown(attributes);
  const tokensLookWrong = hasTokenMismatch(attributes);
  const input = aiInput(attributes);
  const output = aiOutput(attributes);
  const tools = availableTools(attributes);

  const model = span.gen_ai_response_model ?? span.gen_ai_request_model;
  const failed = span.status != null && span.status !== 'ok';

  const highlights: { key: string; label: string; value: string }[] = [];
  if (span.gen_ai_agent_name) {
    highlights.push({
      key: 'agent',
      label: t('agentName'),
      value: span.gen_ai_agent_name,
    });
  }
  if (model) {
    highlights.push({ key: 'model', label: t('model'), value: model });
  }
  if (span.gen_ai_tool_name) {
    highlights.push({
      key: 'tool',
      label: t('toolName'),
      value: span.gen_ai_tool_name,
    });
  }
  const reasoningEffort = attributes['gen_ai.request.reasoning_effort'];
  if (typeof reasoningEffort === 'string' && reasoningEffort !== '') {
    highlights.push({
      key: 'reasoningEffort',
      label: t('reasoningEffort'),
      value: reasoningEffort,
    });
  }
  if (span.gen_ai_conversation_id) {
    highlights.push({
      key: 'conversation',
      label: t('conversationId'),
      value: span.gen_ai_conversation_id,
    });
  }

  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {span.gen_ai_operation_type && (
            <Badge variant="secondary">{span.gen_ai_operation_type}</Badge>
          )}
          {span.status && (
            <Badge variant={failed ? 'destructive' : 'outline'}>
              {span.status}
            </Badge>
          )}
          {span.duration_ms != null && (
            <span className="font-mono text-xs text-muted-foreground">
              {format.number(Math.round(span.duration_ms))} ms
            </span>
          )}
        </div>
        <p className="break-all font-mono text-sm">
          {span.description ?? span.op ?? span.span_id}
        </p>
      </header>

      {highlights.length > 0 && (
        <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 text-xs">
          {highlights.map((row) => (
            <div key={row.key} className="contents">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="break-all font-mono">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {tokens && (
        <Section title={t('tokens')}>
          {tokensLookWrong && (
            // Said out loud rather than hidden: a reader comparing token
            // counts across spans would otherwise trust a number nothing in
            // the span supports.
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs">
              {t('tokenMismatch')}
            </p>
          )}
          <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted-foreground">{t('inputTokens')}</dt>
            <dd className="font-mono tabular-nums">
              {format.number(tokens.netNewInput)}
            </dd>
            {tokens.cached > 0 && (
              <>
                <dt className="text-muted-foreground">{t('cachedTokens')}</dt>
                <dd className="font-mono tabular-nums">
                  {format.number(tokens.cached)}
                </dd>
              </>
            )}
            <dt className="text-muted-foreground">{t('outputTokens')}</dt>
            <dd className="font-mono tabular-nums">
              {format.number(tokens.output)}
            </dd>
            <dt className="text-muted-foreground">{t('totalTokens')}</dt>
            <dd className="font-mono font-semibold tabular-nums">
              {format.number(tokens.total)}
            </dd>
          </dl>
        </Section>
      )}

      {tools && (
        <Section title={t('availableTools')}>
          <div className="flex flex-wrap gap-1">
            {tools.map((tool) => (
              <Badge key={tool} variant="outline" className="font-mono">
                {tool}
              </Badge>
            ))}
          </div>
        </Section>
      )}

      {input && (
        <Section title={t('input')}>
          {input.systemInstructions && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {t('systemInstructions')}
              </p>
              <Payload value={input.systemInstructions} />
            </div>
          )}
          <Payload value={input.messages} />
        </Section>
      )}

      {output && (
        <Section title={t('output')}>
          {output.text && <Payload value={output.text} />}
          {output.object && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {t('responseObject')}
              </p>
              <Payload value={output.object} />
            </div>
          )}
          {output.toolCalls && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {t('requestedToolCalls')}
              </p>
              <Payload value={output.toolCalls} />
            </div>
          )}
        </Section>
      )}

      <Section title={t('allAttributes')}>
        <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-x-3 gap-y-1 text-[11px]">
          {Object.entries(attributes)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => (
              <div key={key} className="contents">
                <dt className="break-all font-mono text-muted-foreground">
                  {key}
                </dt>
                <dd className="break-all font-mono">
                  {typeof value === 'string' ? value : JSON.stringify(value)}
                </dd>
              </div>
            ))}
        </dl>
      </Section>
    </div>
  );
}
