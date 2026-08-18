# VGZT content guide

This guide explains what to write, where to put it, and how to leave missing information safely. For Pages CMS clicks and publishing steps, see [CMS.md](CMS.md).

## Editorial principles

VGZT content should be accurate, concise, welcoming, and easy to scan across timezones and research backgrounds.

- Use confirmed facts from organizers or speakers.
- Prefer a short clear sentence to promotional language.
- Preserve scientific names, capitalization, accents, and preferred names exactly.
- Write for an international audience; avoid unexplained local date/time assumptions.
- Put essential event information in structured text even when it also appears on a poster.
- Never fabricate missing content or fill fields simply to make a layout look complete.
- Never publish private Zoom details, personal organizer addresses, application data, or correspondence.

## Empty, draft, published, and archived

These states solve different problems:

**Empty / `null`**  
The value is unknown or not supplied. Use this for an optional portrait, talk title, affiliation, deadline, or URL. Do not type `TBC`, `TODO`, `#`, or a fake destination.

**Draft**  
The record exists for preparation but is not public. Use draft people, events, opportunities, and seasons while required facts are incomplete or awaiting approval.

**Published**  
The record is approved for public use. Published events must have a valid date/time and the correct speaker shape. Published opportunities require a verified external destination.

**Archived / cancelled**  
Use the record's supported historical state rather than deleting it. Events support `cancelled`; seasons and opportunities support `archived`.

Record unresolved production work in Pending Content. Production components render a neutral fallback or omit an optional value; they do not show developer TODO text.

## Stable IDs and relationships

Every person, season, event, and opportunity has a lowercase hyphenated ID. Its filename matches the ID. IDs are not display copy.

Good IDs are:

- short and stable;
- lowercase;
- made of letters/numbers separated by single hyphens;
- independent of mutable affiliations, titles, or dates where practical.

Do not rename an ID after other records reference it. Update a display name in its field instead.

Pages CMS shows the ID so it can be entered when a record is created, but it cannot lock that same field only on later edits. Treat it as read-only after the first save. If CI reports `filename_id_mismatch`, revert the ID edit; do not change the filename through the CMS.

Events reference People records. Seasons reference People records for organizers. This prevents duplicate profiles and keeps historical relationships intact.

## Site Settings

`src/data/site.yml` controls:

- the canonical site origin;
- full and short site names;
- the default description;
- current season reference;
- public organizer email;
- contact Worker endpoint;
- public Turnstile site key;
- optional approved master logo.

The site origin is normally `https://vgzt.org`. Changing it is a deployment/domain operation, not a routine copy edit.

Use only the public organizer email. The contact endpoint and public Turnstile key remain `null` until the Worker is operational. The private Turnstile secret never belongs here.

The approved master logo must be a reviewed file in the configured brand media folder. Leave it null to use the VGZT text treatment.

## Social Links

`src/data/social.yml` stores the canonical destinations for:

- newsletter subscription;
- VGZT Slack invitation;
- LinkedIn;
- Bluesky;
- X.

Use a direct canonical HTTPS URL. Do not copy an email tracking redirect, guess an account name, or use `#`. Leave an unresolved URL `null` and keep it in Pending Content.

The `Join VGZT` navigation action goes to the local subscribe page so visitors can choose between email and Slack.

## People

Create one People record for a person, even if they speak in multiple seasons or later become an organizer.

### Required

- stable `id`;
- confirmed full `name`;
- status.

### Optional

- preferred display name;
- current affiliation;
- current title/role;
- approved portrait and matching alt text;
- personal/laboratory HTTPS website;
- canonical ORCID URL;
- public Bluesky/LinkedIn URL;
- approved biography.

Do not infer a title, affiliation, biography, or portrait. Initial Season 8 organizer profiles are intentionally drafts where details await confirmation.

When a person's current affiliation differs from the affiliation at an event, keep the current value on the person and enter an `affiliationOverride` on that event speaker item.

### Portraits

- Use only a supplied/approved portrait.
- Do not download from LinkedIn, Google, or an institution page.
- Use a clear, reasonably high-resolution image with the person as the subject.
- Add concise alt text identifying the person; do not describe appearance unnecessarily.
- Leave the portrait null if unavailable. The layout provides a stable neutral fallback.

## Seasons

A season record contains:

- permanent season ID and number;
- public label;
- confirmed start/end dates;
- canonical IANA timezone;
- draft/published/archived status;
- optional concise description;
- ordered organizer references.

Season 8 uses `America/New_York`. Do not replace that with EDT, EST, UTC-4, or UTC-5.

The homepage takes its season and organizer grid from Site Settings' `currentSeason` reference. Starting a new season must not modify the old record or its organizer history.

## Events

An event is the single source for its schedule rail entry, poster stage, dedicated page, social metadata, and calendar download.

### Canonical schedule

Store separately:

- New York calendar date in `YYYY-MM-DD`;
- New York wall-clock time in 24-hour `HH:mm`;
- `America/New_York` timezone.

Do not convert the source value to the organizer's local timezone or UTC. The build derives a real instant with daylight-saving rules, and the browser derives the visitor's local date and time from that instant. A Friday evening ET event can correctly appear on Saturday elsewhere.

Draft events may keep date/time null while details are being decided. Published or cancelled events require both.

### Session format and time slot

Choose the defined session type:

- `two-speaker`: one PI plus one student or postdoc;
- `keynote`: one speaker.

Choose the relevant timing mode:

- Eastern;
- Western;
- Alternative;
- Custom only for an explicitly approved non-standard time.

The numeric duration belongs on the event. Shared explanatory timing and format text lives in Session Types and Times.

### Speakers

Each speaker item contains:

- a reference to an existing person;
- optional controlled event role;
- confirmed talk title or null;
- optional affiliation override.

Do not type the person's name into a talk title or create a second person because one field is missing. Essential speaker/talk details must be structured text, not only pixels inside the poster.

### Posters and recordings

- Upload an approved original poster through the event Poster field.
- Keep portrait/landscape aspect ratio intact; the site uses a contained exhibition frame.
- Add event-specific alt text when a poster is supplied.
- Leave poster null for the built-in `Poster coming soon` state.
- Add only an approved public recording HTTPS URL.
- Never add a subscriber-only recording, Zoom URL, meeting ID, or password.

### Event descriptions

Use a short, factual description only when it adds information not already captured by speaker/talk fields. Avoid generic praise and unsupported claims.

## Session Types and Times

`src/data/session-types.yml` holds shared definitions for two-speaker sessions, keynotes, and standard New York timing modes.

This is an advanced settings file and is read-only in Pages CMS. Routine event creation selects its existing IDs; it must not rewrite shared definitions. Renaming an ID can break existing events, while adding an ID without updating the schema-controlled selects makes it unavailable to editors. Ask for a reviewed code/config change before introducing a new session type or standard slot.

## Abstract Call

The abstract-call file controls the homepage announcement and Abstracts page.

Fields include:

- open/closed toggle;
- season reference;
- audience;
- optional deadline object with date, time, and IANA timezone;
- canonical external form URL, which may be embedded as a Microsoft Form when supported;
- description and eligibility;
- list of required submission materials;
- review description;
- preferred time-slot IDs;
- FAQ question/answer pairs.

Before setting the call open, confirm eligibility, form destination, review copy, and submission requirements. The call supports both a fixed deadline and a rolling mode: use a complete deadline object for a fixed closing time, or keep `deadline: null` when submissions remain open until available presentation slots are filled. An open rolling call displays that capacity-based message rather than `To be confirmed`; do not fabricate a date.

When supported, `formUrl` is rendered as an embedded Microsoft Form on the Abstracts page. The public page should always provide an external fallback link to the same HTTPS destination. Routine abstract-call text remains editable through the Abstract Call settings in Pages CMS. Never commit private applicant data, responses, or other personal submission information to Git.

Use the deadline timezone actually announced for the call. Do not silently treat an end-of-day deadline as the organizer's or visitor's local time.

FAQ answers should be direct and should not make selection promises that organizers have not approved.

## Opportunities

VGZT opportunities are curated, not scraped.

Every record contains:

- stable ID;
- title;
- type: Job, PhD, Postdoc, Funding, Event, or Community;
- institution/organization;
- location;
- plain-text summary;
- posted date;
- optional deadline and expiry;
- verified canonical external HTTPS URL;
- featured toggle;
- draft/published/archived status.

Summaries should explain what the opportunity is and who it is relevant to in a few sentences. Do not paste arbitrary HTML or reproduce an entire external advert.

`expiresAt` removes a published listing from the active view after that date while retaining its source/history. Do not keep extending expiry merely to make the page look populated.

## Pending Content

Each pending entry contains:

- unique key;
- label;
- type: image, URL, text, date, or configuration;
- intended public location;
- pending/resolved status;
- whether it blocks launch;
- exact replacement route;
- optional resolved date and notes.

When resolving an item:

1. enter the approved value in its real field;
2. change the pending status to resolved;
3. add the resolution date if useful;
4. ensure notes contain no secret or personal destination;
5. save both in one change.

## Writing style

- Use sentence case for headings and labels unless a proper name requires otherwise.
- Use `VGZT` after first spelling out Virtual Gastrulation Zoom Talks when context needs it.
- Prefer active, plain language.
- Avoid corporate or startup vocabulary such as “platform”, “ecosystem”, or unqualified “world-leading”.
- Keep the focus on developmental biology, the seminar format, speakers, and community participation.
- Preserve the distinction between Early Career Researchers and PIs without guessing a person's career stage.
- Use en dashes/ranges consistently in display copy; keep machine date/time fields in their required syntax.

## Link and privacy rules

- Use complete `https://` URLs.
- Verify the final destination in a private/incognito browser where practical.
- Do not use `javascript:` links, `#`, URL shorteners, or email tracking redirects.
- Do not place mail credentials, webhook URLs, API tokens, private email destinations, or Turnstile secrets in content.
- Do not publish a personal organizer email; use the configured public VGZT address.

## Accessibility content checklist

- [ ] The page's important facts exist as text, not only in an image.
- [ ] Poster/portrait alt text is present whenever the image field is present.
- [ ] Alt text is concise and does not repeat nearby text unnecessarily.
- [ ] Link labels describe the action/destination; avoid “click here”.
- [ ] Headings describe their section and remain in a logical hierarchy.
- [ ] Acronyms and specialist terms are understandable in context.
- [ ] Dates and times include enough context; event displays retain ET reference and visitor-local time.
- [ ] Emoji is not used as the only meaning or status indicator.

## Publication checklist

Before changing a record to published:

- [ ] names, spellings, dates, and talk titles are confirmed;
- [ ] all person/season references resolve;
- [ ] event date/time is canonical New York wall time;
- [ ] speaker count matches the session type;
- [ ] external URLs are canonical, HTTPS, and open successfully;
- [ ] no private seminar access or personal address appears;
- [ ] supplied images are approved and have alt text;
- [ ] missing optional values are null, not fake placeholders;
- [ ] relevant Pending Content entries are updated;
- [ ] the GitHub Actions validation succeeds;
- [ ] the live desktop and mobile presentation has been checked.
