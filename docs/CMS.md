# Pages CMS organizer guide

Pages CMS is a form-based editor for the YAML, Markdown, and media files in this repository. It is not the website runtime: it makes Git commits, CI validates those commits, and GitHub Pages serves the resulting static build.

## Access

1. Go to [Pages CMS](https://app.pagescms.org/).
2. Sign in with the GitHub account authorized for the VGZT repository.
3. Open the VGZT repository and the default branch.
4. Choose the relevant section in the left navigation.

Repository owners must install or authorize the Pages CMS GitHub App for the owning account or organization. Give access only to maintainers who are allowed to change public website content.

If the editor does not show the fields described here, do not switch to raw YAML and guess. Check that `.pages.yml` on the selected branch is valid and current.

## What each section controls

| CMS section             | Source                         | Use                                                                           |
| ----------------------- | ------------------------------ | ----------------------------------------------------------------------------- |
| Site Settings           | `src/data/site.yml`            | Canonical URL, current season, public contact, API endpoint, and site summary |
| Social Links            | `src/data/social.yml`          | Newsletter, Slack, LinkedIn, Bluesky, and X destinations                      |
| Abstract Call           | `src/data/abstract-call.yml`   | Open/closed state, season, audience, deadline, form URL, copy, and FAQ        |
| Session Types and Times | `src/data/session-types.yml`   | Read-only shared format and New York time-slot definitions                    |
| Seasons                 | `src/content/seasons/`         | Season boundaries, canonical timezone, description, and organizer references  |
| Events                  | `src/content/events/`          | Seminar schedule, speakers, poster, format, recording, and publication state  |
| People                  | `src/content/people/`          | One reusable profile for each speaker or organizer                            |
| Opportunities           | `src/content/opportunities/`   | Curated community listings and expiry state                                   |
| Pending Content         | `src/data/pending-content.yml` | Explicit checklist of unresolved production values                            |

Site Settings also contains a nullable **Approved master logo** field. Leave it null to retain the clean text treatment until VGZT supplies an approved master; do not upload a traced historical raster and label it official. Editorial uploads are restricted to PNG, JPEG, and WebP. Any future SVG master must arrive through a reviewed code change, not the CMS.

## Editorial states

Use `draft` while a record is incomplete or unapproved. Only `published` events and opportunities are eligible for public output. Do not publish a made-up example to preview a layout.

Missing optional fields should be empty. Public components will omit them or render a deliberate fallback. Never type `TBC`, Lorem Ipsum, a guessed URL, or `#` to satisfy a field.

Development may show subtle draft or placeholder labels. Production must show a polished empty state instead of developer TODO text.

## CMS compatibility and permanent IDs

Pages CMS currently cannot make a field editable only while creating a record and read-only afterward. The collection filename is generated from `id`, renaming files is disabled, and CI requires the filename and stored ID to match. Therefore, **never edit the Stable ID field on an existing person, season, event, or opportunity**. Change the display name/title instead. An unavoidable ID migration is a technical pull request that updates the filename and every reference together.

Calendar dates are deliberately plain `YYYY-MM-DD` fields rather than browser-local date pickers. Pages CMS date controls otherwise initialize to the editor's current date, which could turn an unknown date into a fabricated fact. CI also checks that each value is a real calendar date and that related dates are ordered correctly.

Before a new Pages CMS installation or major CMS upgrade is opened to organizers, use a test branch to perform this round-trip check:

1. Create a draft event, confirm its generated filename matches its ID, and leave speakers as an empty list.
2. Set, save, then clear one optional text, HTTPS URL, image, and calendar-date field.
3. Inspect the resulting YAML and confirm cleared values are `null`, empty lists are `[]`, and no optional value became `""` or today's date.
4. Run `pnpm run validate:content`, then revert the test commit.

Do not merge if that round trip changes `null` to an empty string or silently supplies a date. Use a reviewed GitHub edit to restore explicit YAML `null` and pause editing the affected field in Pages CMS until `.pages.yml` or the schema is adjusted. CI is the final guard, not a substitute for this hosted-editor smoke test.

## Add or update a person

Create the person before referencing them from an event or season.

1. Open **People** and choose **Add entry**.
2. Choose a stable lowercase ID with hyphens, for example `keyu-shen`. The ID is a relationship key; do not include a job title or institution in it.
3. Enter only confirmed values.
4. Leave portrait, title, affiliation, biography, and links empty when not approved.
5. Upload only an image that VGZT is authorized to publish.
6. Save the entry and wait for CI.

Do not create another person record when an affiliation changes. Events can use an `affiliationOverride` to preserve the affiliation at the time of a historical seminar while the central profile keeps the person's current affiliation.

Do not edit an existing person ID. If a correction is unavoidable, a technical maintainer must rename the file and update every season and event reference in one reviewed change.

## Add and publish an event

1. Confirm that every speaker has a People record.
2. Open **Events** and choose **Add entry**.
3. Choose a stable ID. Avoid putting mutable details such as a speaker name or date into the ID.
4. Leave **Status** as `draft`.
5. Select the season.
6. Enter the seminar's New York calendar date in `YYYY-MM-DD` form when confirmed; otherwise leave it null and keep the record draft.
7. Enter the New York wall-clock time in 24-hour `HH:mm` form when confirmed; otherwise leave it null.
8. Keep **Timezone** as `America/New_York` unless the season explicitly defines another IANA zone.
9. Select the session type and duration.
10. Add speaker references, roles, confirmed talk titles, and any historical affiliation override.
11. Upload the approved poster, if available, and add useful alt text. Key details must also exist as HTML fields; the poster is not the sole source of event information.
12. Add a public recording URL only after publication approval. Never add a private Zoom URL or password.
13. Save, inspect the preview/build, and resolve validation errors.
14. Change **Status** to `published` only when the event is real and approved.

A keynote has one speaker. A two-speaker session has two. Drafts can remain incomplete, but publication validation enforces the public shape. Speaker role is optional; when known, choose the controlled PI, student, postdoc, keynote, or speaker value rather than entering custom prose.

Pages CMS prevents obvious format errors and CI enforces the relational rules it cannot express in a form: published/cancelled events need date and time; event timezone/date must match the season; standard timing modes must use their defined wall-clock time; speaker references must be unique; speaker count/roles must match the session type; a poster needs alt text; and a recording label needs a recording URL.

The site derives the UTC instant, visitor-local date/time, ET reference, event page, calendar download, schedule order, and default upcoming selection from this one record. Do not maintain those values elsewhere.

### Upload or replace a poster

- Use the **Poster** image control in the event editor; do not paste a remote image URL.
- Keep scientific poster text readable. Prefer the approved original PNG/JPEG rather than a social-media screenshot.
- Do not crop a portrait poster into a landscape frame.
- Provide poster alt text that identifies the event; full talk details remain in structured fields.
- If no poster exists, leave the field empty. The website supplies `Poster coming soon` without a broken image.

## Publish an opportunity

1. Open **Opportunities** and add a record.
2. Choose the correct type: Job, PhD, Postdoc, Funding, Event, or Community.
3. Enter the institution, location, short plain-text summary, posted date, and confirmed external HTTPS URL.
4. Add deadline and expiry dates only when known. `expiresAt` controls the active view; expired records stay in Git history/source rather than being rewritten as new listings.
5. Use **Featured** sparingly.
6. Save as `draft`, check the destination and wording, then publish.

Do not scrape external job boards, paste arbitrary HTML, or publish a listing without checking that the external destination belongs to the represented organization.

## Open or close the abstract call

Open **Abstract Call** and edit the single file.

Before setting `open: true`, confirm:

- the season is correct;
- the audience and eligibility copy are approved;
- the deadline is confirmed;
- the HTTPS form destination is canonical;
- the FAQ is current.

Closing the call is a content toggle; do not delete historical explanatory copy. If the form URL is unresolved, leave it empty and keep the associated pending-content item. Never use a fake form destination.

## Session types and standard times

These definitions are visible but read-only in Pages CMS because event and abstract-call choices are controlled by the validated schema. Do not rename an ID or add an option through a raw edit. A new format or standard time is a reviewed code/config change that updates the data file, schemas, CMS selects, validation, tests, and documentation together.

## Change public links

Open **Social Links**. All destinations must be canonical HTTPS URLs supplied or verified by VGZT organizers. Empty links are hidden or rendered unavailable; do not use redirects copied from email analytics, guessed account names, or temporary `#` values.

`Join VGZT` leads to the site's subscribe choice page. The Slack invitation and newsletter subscription destinations are configured separately so visitors can choose.

## Change current organizers

1. Create or update the relevant People records.
2. Open the relevant season in **Seasons**.
3. Select the organizer IDs in the intended display order.
4. Save and preview the homepage and People organizer archive.

Do not hard-code organizer cards on the homepage. Do not expose personal organizer email addresses; the public address is `organizers@vgzt.org`.

## Start a new season

1. Add `season-09` (or the next stable ID) under **Seasons**.
2. Enter confirmed start/end dates and the canonical IANA timezone.
3. Select organizer references.
4. Open **Site Settings** and change `currentSeason` to the new season.
5. Add new events as drafts; do not copy old event records and accidentally retain speakers or recordings.
6. Update **Abstract Call**.
7. Review **Pending Content** and run launch validation.

Old seasons, people, events, and organizer relationships remain intact. Starting a new season is additive, not an archive overwrite.

## Pending content and launch readiness

Every unresolved production value belongs in **Pending Content** with:

- a stable key;
- a human label;
- one of the supported types;
- its intended public location;
- `status: pending`;
- exact Pages CMS replacement instructions;
- `requiredForLaunch` when the site must not launch without it.

Run locally:

```sh
pnpm run report:pending
pnpm run validate:launch
```

When real content is supplied, replace the source field and then remove or resolve its checklist entry in the same commit. Launch validation is deliberately strict so a stale required item cannot be forgotten.

## Save, validation, and publication

Saving in Pages CMS creates a Git commit. GitHub Actions then validates schemas and references, reports pending content, runs tests, and builds the static site. A failing commit is not deployed.

Common validation failures include:

- mistyped or renamed person/season IDs;
- invalid `HH:mm` time;
- event date outside the season;
- wrong number of speakers for the published session type;
- published opportunity without an external URL;
- supplied media path that no longer exists;
- unresolved required launch item.

Other cross-record rules are intentionally CI-only, including ordered season/opportunity dates, published-season organizers, resolved Pending Content dates, unique references, shared duration arithmetic, and consistency between filenames and permanent IDs.

Open the failed GitHub Actions run, expand the named step, and correct the source field in Pages CMS. Do not weaken a schema to make incorrect content pass.

## Roll back a bad edit

Use GitHub's **Revert** control on the offending commit, or commit the prior values as a new change. Avoid force-pushes and destructive resets on the shared branch. The revert goes through the same validation and deployment path.

If the problem includes a leaked secret, reverting is not enough: revoke/rotate it immediately and follow [SECURITY.md](SECURITY.md).
