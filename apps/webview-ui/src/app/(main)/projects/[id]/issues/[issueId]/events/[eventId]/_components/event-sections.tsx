import type { EventDetail } from '@rustrak/client';
import type { readEventPayload } from '@/features/event/lib/event-payload';
import { formatStackTraceAsText } from '@/features/event/lib/format-stack-trace';
import { Breadcrumbs } from '@/features/event/ui/components/breadcrumbs';
import { EventContext } from '@/features/event/ui/components/event-context';
import { EventDetails } from '@/features/event/ui/components/event-details';
import { EventHighlights } from '@/features/event/ui/components/event-highlights';
import { EventTags } from '@/features/event/ui/components/event-tags';
import { RawJson } from '@/features/event/ui/components/raw-json';
import { StackTrace } from '@/features/event/ui/components/stack-trace';
import { ThreadsSection } from '@/features/event/ui/components/threads-section';
import { Section } from '@/shared/ui/components/collapsible-section';
import { CopyAsDropdown } from '@/shared/ui/components/copy-as-dropdown';

type EventPayload = ReturnType<typeof readEventPayload>;

/**
 * The stacked detail sections of an event, in reading order.
 *
 * Every one of them is conditional on the payload actually carrying that kind
 * of data, which is why it takes the whole parsed payload rather than a
 * flattened set of props: the `has` flags and the values they guard have to
 * come from the same parse or they can disagree.
 */
export function EventSections({
  event,
  payload,
  eventData,
}: {
  event: EventDetail;
  payload: EventPayload;
  eventData: Record<string, unknown>;
}) {
  const {
    exception,
    breadcrumbs,
    threads,
    contexts,
    modules,
    user,
    tags: safeTags,
    has,
  } = payload;

  return (
    <div className="rounded-lg border bg-card px-4">
      <Section id="highlights" title="Highlights">
        <EventHighlights
          event={event}
          tags={safeTags}
          contexts={contexts}
          eventData={eventData}
        />
      </Section>

      {has.stackTrace && (
        <Section
          id="stacktrace"
          title="Stack Trace"
          actions={
            // ThreadsSection owns its own copy control — the active
            // thread/exception pairing is client state the section
            // header (a Server Component) can't see.
            has.threads ? undefined : (
              <CopyAsDropdown
                formats={[
                  {
                    label: 'Plain Text',
                    value: formatStackTraceAsText(exception, event.platform),
                  },
                  {
                    label: 'JSON',
                    value: JSON.stringify(exception, null, 2),
                  },
                ]}
              />
            )
          }
        >
          {has.threads ? (
            <ThreadsSection
              threads={threads}
              exception={exception}
              platform={event.platform}
            />
          ) : (
            <StackTrace exception={exception} platform={event.platform} />
          )}
        </Section>
      )}

      {has.breadcrumbs && (
        <Section
          id="breadcrumbs"
          title="Breadcrumbs"
          actions={
            <CopyAsDropdown
              formats={[
                {
                  label: 'JSON',
                  value: JSON.stringify(breadcrumbs, null, 2),
                },
              ]}
            />
          }
        >
          <Breadcrumbs breadcrumbs={breadcrumbs} />
        </Section>
      )}

      {has.tags && (
        <Section id="tags" title="Tags">
          <EventTags tags={safeTags} />
        </Section>
      )}

      {(has.contexts || has.modules || has.user) && (
        <Section id="context" title="Context">
          <EventContext contexts={contexts} modules={modules} user={user} />
        </Section>
      )}

      <Section id="details" title="Event Details">
        <EventDetails event={event} />
      </Section>

      <Section id="raw" title="Raw JSON" defaultOpen={false}>
        <RawJson data={eventData} />
      </Section>
    </div>
  );
}
