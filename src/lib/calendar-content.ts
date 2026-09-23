import { getCollection } from 'astro:content';
import type { CalendarSession } from './calendar';

export async function getCalendarSessions(): Promise<CalendarSession[]> {
  const [events, people] = await Promise.all([
    getCollection('events', ({ data }) => data.status === 'published'),
    getCollection('people', ({ data }) => data.status === 'published'),
  ]);
  const peopleById = new Map(people.map(({ data }) => [data.id, data]));
  return events
    .filter(({ data }) => data.id !== 'collection-empty-state')
    .filter(({ data }) => data.date !== null && data.time !== null)
    .map(({ data }) => ({
      ...data,
      date: data.date!,
      time: data.time!,
      speakers: data.speakers.map((speaker) => {
        const person = peopleById.get(speaker.person);
        return {
          name: person?.preferredName || person?.name || speaker.person,
          affiliation:
            speaker.affiliationOverride || person?.currentAffiliation || null,
          talkTitle: speaker.talkTitle,
        };
      }),
    }));
}
