'use server';

import type { Event, EventDetail } from '@rustrak/client';
import { createClient } from '@/lib/rustrak';

/**
 * Get a single event with full details.
 *
 * @param projectId - The project ID
 * @param issueId - The issue UUID
 * @param eventId - The event UUID
 * @returns The event with full Sentry data
 */
export async function getEventDetail(
  projectId: number,
  issueId: string,
  eventId: string,
): Promise<EventDetail> {
  const client = await createClient();
  return client.events.get(projectId, issueId, eventId);
}

/**
 * Navigation info for event pagination
 */
export interface EventNavigation {
  currentIndex: number;
  totalCount: number;
  firstEventId: string | null;
  lastEventId: string | null;
  prevEventId: string | null;
  nextEventId: string | null;
}

/**
 * Get the last (most recent) event for an issue.
 *
 * @param projectId - The project ID
 * @param issueId - The issue UUID
 * @returns The last event or null if no events
 */
export async function getLastEvent(
  projectId: number,
  issueId: string,
): Promise<Event | null> {
  const client = await createClient();
  // Get events ordered by desc (most recent first), limit to 1
  const response = await client.events.list(projectId, issueId, {
    order: 'desc',
  });
  return response.items[0] ?? null;
}

// Caps sequential page fetches in getEventNavigation to bound worst-case
// round-trips for high-volume issues (~1000 events at PAGE_SIZE=20).
const MAX_NAV_PAGES = 50;

/**
 * Get navigation info for an event within an issue.
 * This fetches events (up to MAX_NAV_PAGES pages) to determine prev/next,
 * which works for issues with reasonable event counts. For very large
 * issues, navigation is best-effort within the fetched window.
 *
 * @param projectId - The project ID
 * @param issueId - The issue UUID
 * @param currentEventId - The current event UUID
 * @returns Navigation info with prev/next event IDs
 */
export async function getEventNavigation(
  projectId: number,
  issueId: string,
  currentEventId: string,
): Promise<EventNavigation> {
  const client = await createClient();

  // Fetch events in ascending order (oldest first), following the cursor
  // chain, so navigation is correct for issues with more than one page.
  const events: Event[] = [];
  let cursor: string | undefined;
  let pageCount = 0;
  do {
    const response = await client.events.list(projectId, issueId, {
      order: 'asc',
      cursor,
    });
    events.push(...response.items);
    cursor = response.has_more ? response.next_cursor : undefined;
    pageCount++;
  } while (cursor && pageCount < MAX_NAV_PAGES);

  const totalCount = events.length;

  if (totalCount === 0) {
    return {
      currentIndex: 0,
      totalCount: 0,
      firstEventId: null,
      lastEventId: null,
      prevEventId: null,
      nextEventId: null,
    };
  }

  // Find current event index
  const currentIndex = events.findIndex((event) => event.id === currentEventId);

  return {
    currentIndex: currentIndex + 1, // 1-based for display
    totalCount,
    firstEventId: events[0]?.id ?? null,
    lastEventId: events[totalCount - 1]?.id ?? null,
    prevEventId:
      currentIndex > 0 ? (events[currentIndex - 1]?.id ?? null) : null,
    nextEventId:
      currentIndex < totalCount - 1
        ? (events[currentIndex + 1]?.id ?? null)
        : null,
  };
}
