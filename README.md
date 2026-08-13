# Virtual Gastrulation Zoom Talks website

This repository contains the official website for Virtual Gastrulation Zoom Talks (VGZT), published at `https://vgzt.org`.

The site is a static Astro 6 project. Seminar records, people, seasons, opportunities, abstract-call settings, and public links live in Git-tracked YAML or Markdown. Pages CMS gives volunteer organizers a form-based editor for those files; the published website does not depend on Pages CMS, a database, or a running Astro server.

The contact form is the only server-backed feature. Once the production endpoint and public Turnstile key are configured, it posts to the separately deployed Cloudflare Worker under `worker/` at `https://api.vgzt.org/contact`. Until then it remains visibly unavailable rather than pretending to submit.

## Start here

Requirements:

- Node.js 22.12 or later
- pnpm 11.19 and the committed root lockfile
- Git

Install and run the site locally:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm run dev
```

Before opening a pull request:

```sh
pnpm run format:check
pnpm run check
pnpm run validate:content
pnpm run report:pending
pnpm test
pnpm run build
```

Run the stricter pre-launch gate separately:

```sh
pnpm run validate:launch
```

`validate:launch` fails while any unresolved entry in `src/data/pending-content.yml` has `requiredForLaunch: true`. A normal development build may still succeed with polished empty states and optional pending content.

## How the website works

```text
Pages CMS or a Git edit
        |
        v
YAML / Markdown / local media in this repository
        |
        v
schema + relationship + pending-content validation
        |
        v
Astro static build -> GitHub Pages -> vgzt.org

Contact form -> api.vgzt.org -> isolated Cloudflare Worker
                              -> organizer email
                              -> optional private Slack notification
```

Astro renders meaningful HTML at build time. Small browser scripts enhance the schedule, timezone selector, filters, mobile navigation, poster viewer, and contact form. There is no full React application.

## Repository map

| Path                           | Purpose                                                                       |
| ------------------------------ | ----------------------------------------------------------------------------- |
| `src/content/events/`          | One source record per seminar; only published records become public events    |
| `src/content/people/`          | Reusable speaker and organizer profiles                                       |
| `src/content/opportunities/`   | Curated jobs, funding, events, and community notices                          |
| `src/content/seasons/`         | Season dates, timezone, description, and organizer references                 |
| `src/data/site.yml`            | Canonical site URL, current season, public contact, and site-level settings   |
| `src/data/social.yml`          | Newsletter, Slack, and public social destinations                             |
| `src/data/abstract-call.yml`   | Abstract-call state, deadline, submission URL, copy, and FAQ                  |
| `src/data/pending-content.yml` | Central register of unresolved production content                             |
| `src/assets/`                  | Build-optimized brand, poster, and portrait assets                            |
| `public/`                      | Files copied unchanged, including public brand files and favicons             |
| `.pages.yml`                   | Pages CMS editor model and media locations                                    |
| `worker/`                      | Independent Cloudflare contact endpoint; not part of the GitHub Pages runtime |
| `docs/`                        | Organizer handover, content, CMS, deployment, Cloudflare, and security guides |

Historical posters and crops are evidence for the VGZT visual identity, not automatically approved Season 8 production assets. Do not extract portraits, institution marks, or a supposed master logo from those references.

## Editing content without code

Most organizer work should happen in Pages CMS. New maintainers should begin with [docs/HANDOVER.md](docs/HANDOVER.md), then use [docs/CMS.md](docs/CMS.md) for the editing workflow and [docs/CONTENT-GUIDE.md](docs/CONTENT-GUIDE.md) for field and writing guidance.

The important editorial rules are:

- create or update a person once, then reference that person from events and seasons;
- store event date, wall-clock time, and `America/New_York` separately;
- leave an event in `draft` until it is a real announced seminar;
- never enter a fake URL, `#`, guessed affiliation, invented title, or placeholder biography;
- use a null/empty optional field and register unresolved production content instead;
- never put Zoom passwords, private joining links, personal organizer email addresses, webhooks, or credentials into content.

Pages CMS commits ordinary files to GitHub. If Pages CMS is unavailable, maintainers can edit the same files in GitHub and the static site continues to work.

## Adding a seminar

The complete workflow is in [docs/CMS.md](docs/CMS.md#add-and-publish-an-event). In summary:

1. Create or confirm speaker records under **People**.
2. Create the event as `draft` under **Events**.
3. Enter its New York calendar date and wall-clock time; do not convert it to UTC.
4. Reference the correct season and people.
5. Upload the approved poster, if available.
6. Preview and validate the build.
7. Change the event to `published` only after the details are approved.

Draft fixtures used by tests belong under `tests/fixtures/`, never in `src/content/events/`.

## Timezone handling

VGZT source data stores three separate canonical fields: a `YYYY-MM-DD` New York calendar date, a 24-hour `HH:mm` New York wall-clock time, and `timezone: America/New_York`. This describes the storage format only; it is not a fabricated Season 8 seminar record.

It never stores a fixed `UTC-4` or `EDT` offset. At build time, the date and wall-clock time are resolved through the IANA timezone database to a canonical instant. In the browser, native `Intl` APIs format that instant in the visitor's detected or manually selected timezone. The manual choice is stored locally in the visitor's browser.

Both the date and time are converted. A Friday 21:00 New York seminar can correctly appear as Saturday in Asia, Europe, or Australia. The page always retains a New York reference time, and event calendar files are generated from the same canonical data.

## Starting a new season

Starting Season 9 must not overwrite Season 8 history:

1. Add a new season record such as `season-09`.
2. Select its organizer references from the central People collection.
3. Set `currentSeason` in Site Settings to `season-09`.
4. Add the new events as drafts.
5. Update the Abstract Call file.
6. Review `pending-content.yml`, then run the content and launch validators.

The homepage organizer section resolves the organizers listed by the current season. Do not copy organizer cards into homepage source code.

## Contact, email, and Slack

The public site exposes only the public organizer address configured as `publicEmail` (initially `organizers@vgzt.org`). The intended mail flow is:

```text
contact form -> Cloudflare Worker
             -> Email Service sends contact@vgzt.org to organizers@vgzt.org
                -> Email Routing forwards to an organizer-controlled inbox
             -> optional concise notification in a private Slack channel
```

Browser code never contains mail credentials or a Slack webhook. Turnstile is verified by the Worker, not trusted from the browser. See [docs/SECURITY.md](docs/SECURITY.md) and [docs/CLOUDFLARE-SETUP.md](docs/CLOUDFLARE-SETUP.md).

## Deployment and domains

The site is built and deployed by `.github/workflows/ci.yml` using GitHub's Pages artifact and deployment actions. The custom domain is served from the root, so Astro uses the canonical `site` value from `src/data/site.yml` and no repository-name `base` path.

The expected domain split is:

- `https://vgzt.org` and `https://www.vgzt.org`: GitHub Pages static site
- `https://api.vgzt.org`: Cloudflare Worker

Changing the canonical URL in content does not change DNS or the GitHub Pages custom-domain setting. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) before changing domains, transferring the repository, deploying the Worker, or rolling back a release.

## Roll back a bad content edit

Pages CMS edits are normal Git commits. The safest rollback is to use GitHub's **Revert** action on the bad commit or create a new commit that restores the previous values. Do not rewrite shared branch history or use a destructive reset. Once the revert reaches the default branch and passes CI, GitHub Pages deploys the restored site.

## Transfer to a VGZT GitHub organization

Repository transfer does not require hard-coded username changes. After a transfer:

1. Install/authorize Pages CMS for the destination organization.
2. Reconfirm GitHub Pages is sourced from GitHub Actions.
3. Reconfirm the custom domain and DNS verification.
4. Recreate repository variables, environments, branch protection, and collaborator access.
5. Reconfirm any Worker deployment credentials separately; they are not part of the static site.
6. Run the full CI and launch-validation commands before changing DNS.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before changing components, schemas, workflows, or the Worker. Security reports should follow [docs/SECURITY.md](docs/SECURITY.md) and should not disclose credentials or exploitable contact-form details in a public issue.
