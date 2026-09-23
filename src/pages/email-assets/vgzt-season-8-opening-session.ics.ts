import type { APIRoute } from 'astro';
import { getCalendarSessions } from '../../lib/calendar-content';
import { sessionCalendar } from '../../lib/calendar';

// Preserve the URL and UID already distributed in the opening-session email.
// Future sessions use /events/[id]/calendar.ics and the event's canonical UID.
export const GET: APIRoute = async ({ site }) => {
  const event = (await getCalendarSessions()).find(
    (event) => event.id === 'season-08-2026-09-18',
  );
  if (!event) return new Response(null, { status: 404 });
  return new Response(
    sessionCalendar(
      event,
      site || 'https://vgzt.org',
      new Date(),
      'vgzt-season-8-opening-20260918@vgzt.org',
    ),
    { headers: { 'Content-Type': 'text/calendar; charset=utf-8' } },
  );
};
