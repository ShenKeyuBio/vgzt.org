import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { canonicalEventInstant, eventEndInstant } from '../../../lib/time';

export const getStaticPaths = (async () => {
  const [events, people] = await Promise.all([
    getCollection('events', ({ data }) => data.status === 'published'),
    getCollection('people', ({ data }) => data.status === 'published'),
  ]);
  const namesById = new Map(
    people.map(({ data }) => [data.id, data.preferredName || data.name]),
  );
  return events
    .filter(({ data }) => data.id !== 'collection-empty-state')
    .filter(({ data }) => data.date !== null && data.time !== null)
    .map(({ data }) => ({
      params: { slug: data.id },
      props: {
        event: data,
        names: data.speakers.map(
          (speaker) => namesById.get(speaker.person) || speaker.person,
        ),
      },
    }));
}) satisfies GetStaticPaths;

function icsDate(instant: string): string {
  return instant
    .replaceAll('-', '')
    .replaceAll(':', '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function escapeIcs(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replaceAll('\n', '\\n');
}

export const GET: APIRoute = ({ props, site }) => {
  const event = props.event;
  if (!event || event.date === null || event.time === null)
    return new Response(null, { status: 404 });
  const scheduled = { ...event, date: event.date, time: event.time };
  const start = canonicalEventInstant(scheduled).toString();
  const end = eventEndInstant(scheduled).toString();
  const names = (props.names as string[]).join(' & ');
  const detailsUrl = new URL(`/events/${event.id}/`, site).toString();
  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//VGZT//Season calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeIcs(event.id)}@vgzt.org`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${escapeIcs(`VGZT: ${names}`)}`,
    `DESCRIPTION:${escapeIcs('Virtual Gastrulation Zoom Talks. Access is shared with VGZT subscribers and community members.')}`,
    `URL:${detailsUrl}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${event.id}.ics"`,
    },
  });
};
