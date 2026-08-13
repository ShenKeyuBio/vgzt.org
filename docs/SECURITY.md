# Security and privacy operations

This document describes operational security for the public VGZT website. Report a suspected vulnerability privately to `organizers@vgzt.org`. Do not publish an exploitable report, personal data, webhook, token, or secret in a public GitHub issue.

## Trust boundaries

The Astro site is static and public. Every value included in the build, HTML, JavaScript, source map, public asset, or network request must be treated as visible to anyone.

The Cloudflare Worker is a separate security boundary. It receives untrusted contact-form input, verifies Turnstile, applies abuse controls, and accesses server-side notification integrations. The static site must continue to build without Worker secrets.

Pages CMS is an editorial Git client. Its users can create commits in the repository and should have only the GitHub access needed for their role. CI validation reduces mistakes but does not replace review or account security.

## Security invariants

The following properties must remain true across implementation and deployment changes:

- no Worker secret or private notification destination is present in the static bundle, repository content, Pages CMS, or public logs;
- every contact request is treated as attacker-controlled and passes bounded parsing, server validation, abuse controls, and successful Turnstile verification before notification;
- a failed required security check fails closed with a generic response and no notification;
- visitor values cannot inject email headers or control From, To, subject, Slack formatting, destinations, or server-owned category labels; the validated visitor name/address may be used only as Reply-To;
- the production endpoint accepts only the two exact VGZT web origins and never credentialed wildcard CORS;
- draft records, private access details, and arbitrary CMS HTML never reach public routes;
- static-site CI never receives or deploys Worker secrets;
- Slack remains optional and cannot turn an accepted email delivery into a public failure;
- contact content is not stored in a website database, cache, or analytics payload.

Tests demonstrate intended behavior but are not proof that production bindings, DNS, routing, or provider controls are configured correctly.

## Reportable findings and severity context

Privately report a reachable weakness that could disclose or misuse a secret, send unauthorized organizer notifications, bypass Turnstile/rate/validation controls, inject email headers or Slack mentions/links, expose private seminar access, publish attacker-controlled script/HTML, leak contact personal data, deploy unreviewed code, or cause a security check to fail open.

Severity depends on realistic internet reachability and impact. Credential disclosure, arbitrary notification use, persistent script execution, unauthorized deployment, or bulk contact-data exposure are higher impact than a purely cosmetic issue. Do not downgrade a reachable flaw merely because Turnstile, CORS, or a test exists; confirm the relevant production control actually blocks the path.

## Out of scope and accepted limitations

The following are documented platform/product limits, not claims that related vulnerabilities are impossible:

- GitHub Pages cannot set arbitrary repository-controlled response headers. A missing `_headers` effect is expected; a design that falsely depends on it is still reportable.
- The current Worker has no durable queue or exactly-once delivery. Rare provider ambiguity can cause a duplicate or failed delivery; this does not excuse a deterministic replay or spam bypass.
- Cloudflare's native rate-limit binding reduces abuse but is not global accounting. Bypassing all effective abuse controls at useful scale remains reportable.
- Pages CMS downtime is an editorial availability issue; the already-built static site should remain available.
- Content accuracy disputes without a security/privacy consequence use the normal editorial correction process.
- Vulnerabilities solely in an unsupported local developer setup are lower priority unless they affect committed artifacts, credentials, CI, or production behavior.

These limitations are not authorization to add a CDN proxy, database, queue, new data collection, or weaker control without owner review.

## Secret inventory

Expected Worker-side secrets can include:

- `TURNSTILE_SECRET`
- `SLACK_WEBHOOK_URL`
- Cloudflare deployment/API credentials used outside the static build

The current native Email Service binding does not require a mail API token in Worker code. Treat binding configuration and any future provider credential as protected operational configuration.

The Turnstile site key is public by design; its secret is not. `.dev.vars.example` contains names/fake values only. Real `.dev.vars`, `.env`, credentials, destination inbox addresses, and webhook values must remain untracked.

Do not store any secret in:

- `src/data/` or `src/content/`;
- Pages CMS fields;
- frontend environment variables exposed with a public prefix;
- GitHub Pages build output;
- documentation, screenshots, issues, or Slack messages;
- GitHub Actions logs.

## Contact endpoint controls

The Worker must enforce, server-side:

- only required methods (`POST`, plus narrowly handled `OPTIONS` where CORS needs it);
- an exact JSON content type and a bounded request body;
- an exact production allowlist for `https://vgzt.org` and `https://www.vgzt.org`; local browser work uses a separate local/staging environment and Turnstile test configuration;
- field type, category, email, privacy acknowledgement, and length validation;
- a honeypot field;
- Turnstile verification using `TURNSTILE_SECRET`;
- reasonable rate/abuse limiting without trusting client-provided identity headers;
- safe plain-text/escaped formatting for email and Slack;
- generic public errors that do not reveal providers, bindings, webhook details, or stack traces.

The frontend's HTML validation is usability only and is never a security control. For releases that change request handling, require tests for the affected malformed JSON, wrong content type, invalid/oversized fields, privacy acknowledgement, honeypot, Turnstile, origin, provider-failure, and success paths; exercise the complete set during go-live acceptance.

Do not reflect message text into an HTML response. Avoid forwarding raw headers or unnecessary metadata to email/Slack.

## Personal data

The contact form collects name, reply email, category, message, and privacy acknowledgement. Collect no more data than necessary and do not add analytics identifiers to the payload.

Slack notifications should be concise and sent only to an organizer-controlled private destination. Do not dump the full message or request metadata into a public community channel. Prefer email as the system containing the reply address and use Slack as a minimal alert.

Document retention and deletion expectations in the public privacy notice once organizers approve them. Do not claim a retention period that has not been operationally agreed.

Public site content must expose only `organizers@vgzt.org`, not personal organizer destination addresses.

## Content and link safety

- Astro escapes ordinary interpolated text; keep opportunity summaries and similar fields plain text.
- Use the project's approved Markdown rendering path for rich content. Do not enable raw arbitrary HTML from the CMS.
- Validate external URLs and use `rel="noopener noreferrer"` where a link opens a new browsing context.
- Never publish Zoom passwords, private joining URLs, API tokens, subscriber exports, or correspondence.
- Do not hotlink untrusted profile/poster images or scrape portraits.
- Treat SVG uploads as active content. Pages CMS therefore accepts only PNG, JPEG, and WebP for editable logos, posters, and portraits. Repository-owned SVG interface assets require code review.
- Do not convert a historical raster logo into an alleged official master asset.

## Browser and hosting controls

GitHub Pages does not provide arbitrary per-repository response headers. A checked-in `_headers` file does nothing and must not be described as enforcing CSP, HSTS, Permissions-Policy, frame restrictions, or MIME controls.

Use safe HTML defaults regardless of headers:

- no inline arbitrary CMS HTML;
- no third-party tracking scripts or font CDNs;
- no credentials in client code;
- HTTPS-only production endpoints;
- explicit form destinations and allowed origins;
- integrity-conscious dependency review;
- external links handled safely.

A CSP delivered in a `<meta http-equiv>` element has important limitations and is not a substitute for response headers. Do not add a policy casually: Turnstile and any approved third-party endpoints must be enumerated and tested without weakening script policy.

If full response-header control becomes a requirement, approve and review an edge/proxy architecture rather than pretending GitHub Pages supports it.

## GitHub and CI

- Require multi-factor authentication for maintainers where the owning organization supports it.
- Protect the default branch and require CI before merge.
- Keep workflow permissions least-privilege. Only the Pages deployment job needs `pages: write` and `id-token: write`.
- Do not run untrusted pull-request code with secrets or `pull_request_target`.
- Review dependency and action updates; keep the lockfile committed.
- Keep Worker deployment separate from Pages CI unless a later protected workflow is explicitly approved.
- Pages CMS access should be removed promptly when an organizer no longer maintains the site.

## Email delivery and routing

Recommended public flow:

```text
contact form -> Cloudflare Worker
             -> Email Service sends contact@vgzt.org to organizers@vgzt.org
                -> Email Routing forwards to a private organizer inbox
             -> optional minimal Slack alert
```

Email Service is the Worker's outbound binding; Email Routing separately handles inbound aliases and forwarding. Do not assume Google Workspace exists. Do not expose forwarding destinations in repository content or frontend code. Limit access to both configurations and audit changes to aliases such as `contact@`, `abstracts@`, and `organizers@`.

## Incident response

### Exposed secret

1. Revoke or rotate it immediately at the provider.
2. Disable the affected integration if rotation cannot be immediate.
3. Remove it from the current repository and build output.
4. Assess Git history, Actions logs, Pages artifacts, issues, screenshots, and notifications for exposure.
5. Replace the secret only in the authorized secret store.
6. Verify abuse controls and provider activity.
7. Document the incident privately. A Git revert alone is insufficient.

### Abusive contact traffic

1. Confirm Turnstile verification and origin/content-type checks are operating.
2. Review aggregate Worker/provider logs without spreading message PII.
3. Tighten rate controls or temporarily disable notifications while retaining generic responses.
4. Rotate the Slack webhook if it was exposed or directly abused.
5. Restore service only after exercising failure and success tests.

### Malicious or incorrect content

1. Revert the content commit through GitHub.
2. Remove or suspend the responsible access if the change was unauthorized.
3. Confirm the replacement Pages deployment completed.
4. If private data was published, treat it as a privacy incident even after removal.

### Dependency or workflow compromise

1. Pause merges/deployments.
2. Identify the last known-good commit and affected artifacts.
3. Rotate any token available to the compromised job.
4. Pin/replace the affected dependency or action after review.
5. Rebuild from a clean install and verify the published artifact.

## Security review checklist

- [ ] No real secret or personal destination address is tracked or bundled.
- [ ] Public and Worker origins/endpoints match the production domains.
- [ ] Turnstile is verified server-side and failure is closed.
- [ ] Honeypot, validation, size bounds, and rate controls are active.
- [ ] Slack/email output is safely formatted and data-minimized.
- [ ] Draft events and fake links cannot be published.
- [ ] Rich content cannot introduce arbitrary HTML/script.
- [ ] Workflow permissions remain least-privilege.
- [ ] GitHub Pages header limitations are documented honestly.
- [ ] Privacy copy matches the actual operational flow.
