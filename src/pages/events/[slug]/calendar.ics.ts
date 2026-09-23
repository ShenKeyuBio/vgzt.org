import type { APIRoute, GetStaticPaths } from 'astro';
import { getCalendarSessions } from '../../../lib/calendar-content';
import { sessionCalendar } from '../../../lib/calendar';

export const getStaticPaths = (async () => {
  return (await getCalendarSessions()).map((event) => ({
    params: { slug: event.id },
    props: { event },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props, site }) => {
  const event = props.event;
  if (!event || event.date === null || event.time === null)
    return new Response(null, { status: 404 });
  const body = sessionCalendar(event, site || 'https://vgzt.org');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${event.id}.ics"`,
    },
  });
};
