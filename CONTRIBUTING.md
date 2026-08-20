# Contributing to the VGZT website

VGZT is maintained by rotating volunteer organizers. Changes should leave the project easier for the next scientist to operate without source-code knowledge.

## Choose the right workflow

Use Pages CMS for routine editorial work:

- seminars and posters;
- people and organizer profiles;
- opportunities;
- the abstract call;
- current season selection;
- public social and subscription links;
- the pending-content checklist.

Use a reviewed pull request for source code, schemas, styles, tests, workflows, dependencies, or `worker/`.

Do not work around a content schema by hard-coding a seasonal value into an Astro component. If Pages CMS cannot express a normal organizer task, improve the content model and CMS configuration together.

## Local setup

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm run dev
```

Use Node.js 22.12 or later and pnpm 11.19. Keep the root `pnpm-lock.yaml` in sync with intentional site dependency changes. Do not add a package when browser APIs, Astro, or a short well-tested utility already solve the problem.

The root pnpm workspace deliberately excludes `worker/`. The Cloudflare Worker is an isolated pnpm project with its own lockfile. When changing `worker/`, run `pnpm install --frozen-lockfile` and `pnpm run check` from that directory; a static-site build must not require Worker secrets.

## Branches and pull requests

Use [docs/GIT-WORKFLOW.md](docs/GIT-WORKFLOW.md) for the full clone, sync, rebase, and conflict-recovery procedure.

1. Fetch `origin` and branch from the current `main`; do not develop directly on `main`.
2. Keep the change focused; do not reformat unrelated historical content.
3. Before committing and pushing, rebase onto `origin/main` and inspect the staged paths.
4. Add or update tests for behavior changes.
5. Run the checks below.
6. Open a pull request that explains the visitor/organizer impact, data migrations, screenshots for visual changes, and any unresolved content.

If Pages CMS has committed while your branch was in progress, fetch and rebase before touching the affected files. Do not resolve a YAML conflict by blindly taking one side.

Required site checks:

```sh
pnpm run format:check
pnpm run check
pnpm run validate:content
pnpm run report:pending
pnpm test
pnpm run build
```

Before a launch or domain cutover, also run:

```sh
pnpm run validate:launch
```

Run the Worker's check and test commands from its isolated package when `worker/` changes.

## Content integrity

- Do not fabricate dates, talk titles, affiliations, biographies, URLs, portraits, opportunities, or institutional marks.
- Do not scrape profile photos from LinkedIn, Google, or institutional pages.
- Do not use Lorem Ipsum, `#`, `javascript:void(0)`, or guessed links.
- Keep draft/example events out of the production collection. Use `tests/fixtures/` for examples.
- A missing poster, portrait, or optional field must use the existing polished fallback.
- Add unresolved production values to `src/data/pending-content.yml` and state exactly how they can be replaced.
- Do not treat historical reference graphics as approved current production assets.
- Never publish Zoom passwords, subscriber-only access URLs, personal organizer email addresses, or private correspondence.

## Content schema changes

A schema change is incomplete until all of the following agree:

- Astro/Zod validation;
- relationship and launch validation;
- `.pages.yml` labels, options, and help text;
- existing source records;
- tests and fixtures;
- CMS and handoff documentation.

Preserve stable IDs. Renaming a person, season, or event ID can break references and public URLs. Prefer additive migrations and explicit deprecation over silently changing field meaning.

Pages CMS cannot currently lock a collection ID only after creation. The CMS disables file renames and CI rejects filename/ID drift, but reviewers must still reject edits to an existing ID unless the same technical migration renames the file and updates every reference. Shared session-type/time-slot IDs are read-only in Pages CMS because their selects are schema-controlled.

After changing `.pages.yml` or upgrading Pages CMS, perform the nullable-field round-trip described in [docs/CMS.md](docs/CMS.md). Cleared optional values must remain YAML `null`, empty lists must remain `[]`, and unknown dates must never default to today. Add CMS constraints for bounds and formats where the editor supports them; keep relational/conditional enforcement in validation and tests.

## Frontend standards

- Use strict TypeScript and focused Astro components.
- Keep the default output static and client JavaScript minimal.
- Do not introduce React unless a small, isolated interaction genuinely requires it.
- Use design tokens from the central stylesheet rather than one-off near-match colors.
- Preserve the VGZT Turing/reaction-diffusion motif and recognizable mark; do not introduce generic conference decoration or a new logo.
- Render external content as escaped text or through the approved Markdown pipeline; never inject arbitrary HTML.
- Maintain semantic landmarks, logical headings, keyboard behavior, visible focus, adequate contrast, reduced-motion behavior, and 44px-class touch targets.
- Keep posters legible and uncropped with the intended `object-fit: contain` treatment.
- Ensure the core page remains understandable before client scripts execute.

For visible changes, verify desktop and mobile widths, keyboard navigation, the no-content state, missing-media fallbacks, and reduced motion. Include screenshots in the pull request.

## Time and date standards

Event source data is a New York wall-clock schedule:

- `date`: calendar date in `YYYY-MM-DD`;
- `time`: 24-hour `HH:mm` string;
- `timezone`: IANA identifier, normally `America/New_York`.

Never store a fixed Eastern offset, pre-convert the source field to UTC, or use the editor's local datetime as the canonical value. Test changes against both US daylight and standard time and against calendar-day rollover in Asia/Australia.

## Security and privacy

- Never commit secrets or real `.dev.vars` files.
- Keep the static site and Worker trust boundaries separate.
- Sanitize content sent to Slack and minimize personal data in notifications.
- Do not claim GitHub Pages honors `_headers`; it does not provide arbitrary response-header configuration.
- Treat a security vulnerability or exposed secret as a private incident. Follow [docs/SECURITY.md](docs/SECURITY.md).

## Review checklist

- [ ] The change is editable through Pages CMS when it represents routine editorial content.
- [ ] No real secret, fake URL, invented fact, or private access detail was added.
- [ ] Draft content cannot enter production routes or feeds.
- [ ] IDs and references remain valid.
- [ ] CMS-created records include required empty arrays, and cleared optional fields round-trip as `null`.
- [ ] Timezone behavior remains based on `America/New_York`, not a fixed offset.
- [ ] Keyboard, mobile, empty, loading/error, and reduced-motion states were considered.
- [ ] Relevant tests were added and the required commands pass.
- [ ] Documentation and pending-content entries are current.
