# Deployment and operations

The VGZT website and contact endpoint have deliberately separate deployment lifecycles:

- Astro builds static files into `dist/`; GitHub Pages serves them at `vgzt.org`.
- The Cloudflare Worker under `worker/` serves `api.vgzt.org` and is not automatically deployed by the website workflow.

No database or server-side Astro adapter is used.

## Supported runtime and build

Astro 6 requires Node.js 22.12 or later. CI uses pnpm 11.19 and installs the exact site dependency graph from the root `pnpm-lock.yaml` with `pnpm install --frozen-lockfile`. It then runs:

1. formatting checks;
2. Astro/TypeScript checks;
3. content graph validation;
4. the pending-content report;
5. tests;
6. the production static build;
7. Pages artifact upload and deployment only after successful checks.

The root workspace deliberately excludes `worker/`. The Worker uses its own pnpm 11.19 lockfile and runs `pnpm run check` from `worker/`. That composite command checks generated binding freshness, strict TypeScript, Workers-runtime tests, and a Wrangler deployment dry run. A Worker failure blocks the site workflow from reporting success, but the workflow does not deploy the Worker or read its secrets.

## GitHub Pages setup

Repository administrators must configure:

1. **Settings -> Pages -> Build and deployment -> Source: GitHub Actions**.
2. The custom domain `vgzt.org` in Pages settings.
3. Enforced HTTPS after DNS has validated.
4. The `github-pages` deployment environment and any desired branch/environment protection.
5. Branch protection requiring the CI checks before merging.

The workflow uses the official Pages artifact/deploy actions. Validation has `contents: read`; the site build also has `pages: read` so the official configure action can read Pages metadata. Only the deployment job receives `pages: write` plus `id-token: write`.

The site is served at a custom-domain root. `astro.config.ts` must set the canonical `site` value from `src/data/site.yml` and must not set a repository-name `base`. Never insert a personal GitHub username into canonical URLs or internal links.

With an Actions-based Pages deployment, the custom-domain setting in GitHub is authoritative. Do not rely on a generated `CNAME` file as the sole configuration. Changing `site.yml` does not update DNS or GitHub settings.

## DNS

Configure DNS according to the current GitHub Pages custom-domain instructions and verify the domain in the owning GitHub organization/account.

Expected host split:

| Host           | Target                                                             |
| -------------- | ------------------------------------------------------------------ |
| `vgzt.org`     | GitHub Pages apex domain                                           |
| `www.vgzt.org` | GitHub Pages/canonical domain behavior configured in Pages and DNS |
| `api.vgzt.org` | Proxied DNS hostname covered by the Cloudflare Worker route        |

Keep the public canonical URL as `https://vgzt.org`. Confirm both apex and `www` behavior after any DNS change. DNS records, domain verification, and Worker routes are external infrastructure and cannot be changed through Pages CMS.

## Repository variables and launch gate

The standard build reports all pending content. To enforce `requiredForLaunch` entries on CI deployments, create the repository Actions variable:

```text
ENFORCE_LAUNCH_VALIDATION=true
```

When enabled, `.github/workflows/ci.yml` runs `pnpm run validate:launch` before building/deploying. Keep it enabled for the production repository after launch. Preview/fork repositories can omit it while they intentionally demonstrate polished empty states.

This is not a secret. Do not put Worker credentials or webhook URLs in repository variables intended for the static build.

## Manual release verification

Before the first launch, season handover, or domain cutover:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm run format:check
pnpm run check
pnpm run validate:content
pnpm run report:pending
pnpm run validate:launch
pnpm test
pnpm run build
pnpm run preview
```

Then verify:

- home, abstracts, subscribe, opportunities, people, about, privacy, and 404 pages;
- every published `/events/[slug]/` page and calendar download;
- desktop and mobile schedule behavior;
- keyboard navigation and visible focus;
- local timezone detection and a manual override;
- daylight/standard-time examples and Friday-to-Saturday rollover;
- missing poster/portrait and no-active-opportunity states;
- unresolved links are absent or non-clickable;
- the contact form's permitted origin and generic errors;
- canonical, OpenGraph, sitemap, and robots URLs use `vgzt.org`.

## Deploy the static site

Merging or pushing to the protected default branch triggers `.github/workflows/ci.yml`. If all checks pass, the workflow uploads `dist/` as a Pages artifact and deploys it to the `github-pages` environment.

Do not upload `dist/` to a branch manually and do not commit build output. If a workflow was cancelled or GitHub Pages had a transient failure, use **Re-run failed jobs** on the existing Actions run after checking that its commit is still the desired release.

## Deploy the Worker

Worker deployment is intentionally separate so a static content change cannot publish backend code or gain secret access.

Before deploying it:

1. Follow the Worker and Cloudflare setup documentation.
2. Configure secrets with Wrangler/Cloudflare, never in Git:
   - `TURNSTILE_SECRET`
   - `SLACK_WEBHOOK_URL` when Slack notification is enabled
   - provider-specific email credentials/bindings, if required
3. Configure the production origin allowlist for exactly `https://vgzt.org` and `https://www.vgzt.org`. Use a separate local/staging Wrangler environment and Turnstile test credentials for browser development; do not add localhost to the production allowlist/widget.
4. Run the Worker checks/tests from its isolated package.
5. Deploy deliberately with an authorized Cloudflare account.
6. Verify `OPTIONS`/`POST` behavior, Turnstile rejection, honeypot handling, rate limiting, email delivery, and redacted Slack content.
7. Set/confirm the frontend contact endpoint in site configuration only after the endpoint is live.

Do not add Worker deployment credentials to the GitHub Pages build. A future Worker deployment workflow requires separate review, environment protection, and least-privilege Cloudflare tokens.

The local verification commands are:

```sh
cd worker
corepack enable
pnpm install --frozen-lockfile
pnpm run check
```

Run `pnpm run deploy` only as a deliberate, authorized release after configuring Cloudflare bindings and secrets.

## Rollback

For a bad site/content release:

1. Revert the offending Git commit on the default branch.
2. Let the full workflow validate and deploy the revert.
3. Confirm the Pages deployment points to the new revert run.

Do not use `git reset --hard` or rewrite the shared default branch.

For a Worker incident, use the Cloudflare deployment/version rollback mechanism or redeploy the last known-good Worker commit. Static-site rollback does not roll back the Worker, and Worker rollback does not change Pages.

For a leaked secret, revoke/rotate first; rollback alone does not make a disclosed credential safe.

## Transfer to a VGZT GitHub organization

Before transfer, record current settings without copying secret values. After transfer:

1. Reinstall/authorize Pages CMS for the destination organization.
2. Restore branch protection and the `github-pages` environment.
3. Select GitHub Actions as the Pages source.
4. Reverify and attach the custom domain.
5. Restore `ENFORCE_LAUNCH_VALIDATION=true` and other non-secret repository settings.
6. Reconfirm DNS and enforced HTTPS.
7. Reauthorize maintainers with least privilege.
8. Reconfirm Cloudflare ownership separately; do not assume GitHub transfer moves it.
9. Run a full build and launch validation before changing live DNS.

Because canonical URLs come from site configuration rather than a username, repository-owner changes should not require template edits.

## GitHub Pages limitations

GitHub Pages does not support repository-defined arbitrary response headers. Files such as `_headers` are conventions for other hosts and have no effect here. Do not document or audit them as an active CSP, HSTS, Permissions-Policy, or frame policy.

If response-header control becomes mandatory, that is an architectural change requiring an approved proxy/CDN design and a security review. See [SECURITY.md](SECURITY.md).
