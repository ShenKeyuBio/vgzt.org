import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import sharp from 'sharp';
import { format, resolveConfig } from 'prettier';
import { canonicalEventInstant } from '../src/lib/time.ts';
import { accessError } from '../src/lib/calendar.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const id = process.argv[2];
const widthIndex = process.argv.indexOf('--poster-width');
const posterWidth =
  widthIndex === -1 ? 1200 : Number(process.argv[widthIndex + 1]);
if (!Number.isInteger(posterWidth) || posterWidth < 800 || posterWidth > 1920)
  throw new Error('--poster-width must be between 800 and 1920 pixels.');
const outputIndex = process.argv.indexOf('--output-dir');
if (outputIndex !== -1 && !process.argv[outputIndex + 1])
  throw new Error('--output-dir requires a directory.');
const outputRoot =
  outputIndex === -1 ? root : path.resolve(process.argv[outputIndex + 1]);
if (!id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))
  throw new Error('Usage: node scripts/prepare-session.mjs <event-id>');
const readYaml = async (file) =>
  parse(await readFile(path.join(root, file), 'utf8'));
const event = await readYaml(`src/content/events/${id}.yml`);
if (
  event.id !== id ||
  event.status !== 'published' ||
  !event.date ||
  !event.time ||
  !event.poster
)
  throw new Error(
    'A published, scheduled event with its approved poster is required.',
  );
if (!event.access || accessError(event.access))
  throw new Error(
    accessError(event.access) ||
      'Supply this session’s Zoom URL, meeting ID and passcode. Previous sessions are never used.',
  );
const season = await readYaml(`src/content/seasons/${event.season}.yml`);
const people = await Promise.all(
  event.speakers.map(async (speaker) => {
    const person = await readYaml(`src/content/people/${speaker.person}.yml`);
    const affiliation =
      speaker.affiliationOverride || person.currentAffiliation;
    if (person.status !== 'published' || !speaker.talkTitle || !affiliation)
      throw new Error(
        `Complete the published speaker, affiliation and title: ${speaker.person}`,
      );
    return {
      name: person.preferredName || person.name,
      affiliation,
      title: speaker.talkTitle,
    };
  }),
);
const instant = new Date(canonicalEventInstant(event).toString());
const zones = [
  ['ET', 'America/New_York'],
  ['PT', 'America/Los_Angeles'],
  ['UK', 'Europe/London'],
  ['Central Europe', 'Europe/Paris'],
  ['China', 'Asia/Shanghai'],
  ['Japan', 'Asia/Tokyo'],
  ['India', 'Asia/Kolkata'],
];
const times = zones.map(
  ([label, timeZone]) =>
    `${label}: ${new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(instant)}`,
);
const date = new Intl.DateTimeFormat('en-GB', {
  timeZone: event.timezone,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).format(instant);
const subject = `VGZT Season ${season.season} | ${date} | ${people.map((p) => p.name).join(' & ')}`;
const preview = `${people.map((p) => `${p.name}: ${p.title}`).join(' • ')}. ${times[0]}.`;
const escape = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
const posterPath = `/email-assets/${event.date}-session-poster-email.jpg`;
const calendar = `https://vgzt.org/events/${id}/calendar/`;
const p = (content) =>
  `<p style="font-family: Arial, Helvetica, sans-serif; font-size: 17px; line-height: 28px; margin: 0 0 22px">${content}</p>`;
const body = `<tr><td class="mobile-pad" style="background-color:#ffffff;color:#0b0b0b;padding:40px 42px 18px">
${p('Hi everyone,')}${p(`Please join us for the next VGZT Season ${season.season} session on ${escape(date)}.`)}
${people.map((person) => p(`<strong>${escape(person.name)} | ${escape(person.affiliation)}</strong><br/><em>${escape(person.title)}</em>`)).join('')}
</td></tr><tr><td class="mobile-pad" style="background-color:#ffffff;padding:10px 42px 32px">
<img src="https://vgzt.org${posterPath}" width="556" alt="${escape(event.posterAlt)}" style="border:1px solid #d8d5cf;display:block;max-width:556px;width:100%;height:auto"/>
</td></tr><tr><td class="mobile-pad" style="background-color:#ffffff;color:#0b0b0b;padding:0 42px 42px">
${p(`<strong>${escape(date)}</strong><br/>${times.map(escape).join('<br/>')}`)}
${p(`<a href="${calendar}" style="color:#1555c8;font-weight:700">Add to calendar (.ics)</a>`)}
${p(`<a href="${escape(event.access.url)}" style="color:#1555c8;font-weight:700;word-break:break-all">Join Zoom</a><br/><strong>Meeting ID:</strong> ${escape(event.access.meetingId)}<br/><strong>Passcode:</strong> ${escape(event.access.passcode)}`)}
${p(`Warmly,<br/><strong>The VGZT Season ${season.season} Organizing Team</strong>`)}
</td></tr>`;
const shell = await readFile(
  path.join(root, 'docs/email-templates/session-template.html'),
  'utf8',
);
const html = shell
  .replace('@@SUBJECT@@', () => escape(subject))
  .replace('@@SEASON@@', () => String(season.season))
  .replace('<!-- SESSION_BODY -->', () => body);
if (!/^<!doctype html>/i.test(html) || /@@[A-Z_]+@@/.test(html))
  throw new Error('Invalid or unresolved email template.');
for (const tag of ['PreviewText', 'SenderInfo', 'UnsubscribeURL', 'RewardsURL'])
  if (!html.includes(`{{${tag}}}`))
    throw new Error(`Missing EmailOctopus tag ${tag}`);
const filename = `docs/email-templates/vgzt-season-${season.season}-${event.date}-session.html`;
try {
  await access(path.join(outputRoot, filename));
  throw new Error(
    'The email already exists. Preserve historical emails; use --output-dir for a rehearsal.',
  );
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const config = await resolveConfig(path.join(root, filename));
const formatted = await format(html, {
  ...config,
  filepath: path.join(root, filename),
});
const sourcePoster = path.resolve(root, 'src/content/events', event.poster);
let image;
for (const quality of [85, 80, 75, 70, 65]) {
  image = await sharp(sourcePoster)
    .rotate()
    .resize({ width: posterWidth, withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();
  if (image.length <= 300_000) break;
}
if (image.length > 300_000)
  throw new Error(
    'Poster exceeds 300 KB; review compression manually before publication.',
  );
await mkdir(path.join(outputRoot, 'public/email-assets'), { recursive: true });
await mkdir(path.join(outputRoot, 'docs/email-templates'), { recursive: true });
await writeFile(path.join(outputRoot, 'public', posterPath), image);
await writeFile(path.join(outputRoot, filename), formatted);
await writeFile(
  path.join(outputRoot, filename.replace('.html', '.json')),
  JSON.stringify(
    {
      eventId: id,
      subject,
      previewText: preview,
      times,
      durationMinutes: event.durationMinutes ?? 60,
      calendarUrl: calendar,
      posterUrl: `https://vgzt.org${posterPath}`,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `Prepared ${filename}\nPoster: ${image.length} bytes\nDuration: ${event.durationMinutes ?? 60} minutes${event.durationMinutes == null ? ' (default)' : ''}\nSubject: ${subject}\nPreview: ${preview}\nBuild and run the download/email QA before publishing.`,
);
