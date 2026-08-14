# VGZT form Worker

This isolated Cloudflare Worker serves `POST https://api.vgzt.org/contact` and
`POST https://api.vgzt.org/join` for the static VGZT website. It does not store
submissions or require a database. It validates each request, applies
Cloudflare-native rate limits, verifies Turnstile server-side, awaits an email
notification, and sends a structured Slack alert on a best-effort basis.

## Request contract

The endpoint accepts only `application/json` and caps the decoded request body
at 32 KiB. The frontend sends:

```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "category": "general",
  "message": "I have a question about an upcoming seminar.",
  "privacyAccepted": true,
  "website": "",
  "turnstileToken": "token-returned-by-turnstile"
}
```

`POST /join` sends the fields needed for manual invitation:

```json
{
  "name": "Jane Smith",
  "organization": "Example University",
  "careerStage": "postdoc",
  "email": "jane@example.com",
  "slackEmail": "jane@example.com",
  "joinSlack": true,
  "joinMailingList": true,
  "privacyAccepted": true,
  "website": "",
  "turnstileToken": "token-returned-by-turnstile"
}
```

`category` must be one of:

- `general`
- `speaker-abstract`
- `opportunity`
- `technical`
- `other`

`website` is the honeypot. Keep it visually hidden from people, out of the
keyboard and accessibility trees, and empty. A filled string honeypot receives
the same public success response as a genuine submission but triggers no
Turnstile, email, or Slack work.

Successful responses have this shape:

```json
{
  "ok": true,
  "requestId": "00000000-0000-4000-8000-000000000000"
}
```

Safe field-validation messages can be returned for a `400`. Provider,
configuration, webhook, and internal failures are deliberately generic. Every
response is `Cache-Control: no-store` and carries an `X-Request-Id`.

The frontend must reset the Turnstile widget after a failed submission. A
Turnstile token is single-use and expires after five minutes.

## Abuse controls

The Worker requires all of the following:

1. Exact browser origin: `https://vgzt.org` or `https://www.vgzt.org`.
2. `POST /contact` or `POST /join` with JSON only.
3. A bounded 32 KiB body reader, even when `Content-Length` is absent.
4. An IP burst limit before body parsing: 10 attempts per minute.
5. An empty honeypot.
6. Strict server-side field validation.
7. A valid Turnstile result for the configured hostname and route-specific
   action: `vgzt_contact` or `vgzt_join`.
8. An email-key limit after successful verification: 3 attempts per minute.

Rate-limit keys are SHA-256 digests rather than raw IP/email strings. Native
Workers rate limits are intentionally permissive, eventually consistent, and
local to a Cloudflare location. They are abuse reduction, not global accounting.
Do not replace them with isolate-global maps, Cache API counters, or KV counters.
A zone-level WAF rate-limiting rule for both form routes is useful additional defence
if the Cloudflare plan supports it.

CORS is browser containment, not authentication or bot protection. Do not
change the allowed origin to `*` and do not enable credentialed CORS.

## Turnstile setup

1. In Cloudflare Turnstile, create a production widget for the contact form.
2. Restrict its hostnames to `vgzt.org` and `www.vgzt.org`.
3. Render Contact with action `vgzt_contact` and Join with `vgzt_join`.
4. Put the public site key in the static site's public configuration.
5. Set the private Worker secret:

   ```sh
   pnpm wrangler secret put TURNSTILE_SECRET
   ```

The Worker calls Siteverify with the response token, `CF-Connecting-IP`, and
the request UUID as `idempotency_key`. It accepts a token only when `success`
is true, `hostname` is in the configured set, and `action` matches the route.

Use a separate Turnstile widget for staging. Cloudflare publishes test keys for
local and automated testing; never deploy a test secret to production.

## Email Service and Email Routing

The preferred outbound path is the native `send_email` binding. It avoids a
Cloudflare REST API token inside the Worker. `wrangler.jsonc` restricts the
binding to:

- sender: `contact@vgzt.org`
- destination: `organizers@vgzt.org`

Before deployment:

1. Keep `vgzt.org` on Cloudflare DNS.
2. Onboard `vgzt.org` to Cloudflare Email Sending.
3. Apply and verify the SPF/DKIM/bounce records Cloudflare supplies.
4. Verify that `organizers@vgzt.org` is accepted as the binding destination.
5. Configure Email Routing so `organizers@vgzt.org` reaches an
   organizer-controlled private inbox.
6. Test delivery and replies from staging before enabling the public form.

The email has a fixed VGZT `From` address. The validated visitor address is
used only as `Reply-To`; it is never used as `From`, which would undermine
SPF/DMARC. The email subject is generated from the server-owned category map.
The message is plain text.

Email Routing handles inbound aliases and forwarding. It is not, by itself,
the outbound sending mechanism used by this Worker.

## Slack alerts

Slack is disabled when `SLACK_WEBHOOK_URL` is absent. To enable it:

```sh
pnpm wrangler secret put SLACK_WEBHOOK_URL
```

Only standard Slack or Slack Gov HTTPS webhook hosts are accepted. Contact
alerts contain the submitted message; Join alerts contain the fields needed for
manual Slack and mailing-list invitations. Both omit IP, Turnstile token, and
user agent. All content uses Block Kit `plain_text`; user values cannot create
mentions or links.

Slack runs under `ExecutionContext.waitUntil()` after email acceptance. Slack
failure is logged using a non-sensitive error code and never changes the public
success response. The webhook URL and webhook response body are never logged.

`TURNSTILE_SECRET` is declared as required in `wrangler.jsonc`, allowing
`wrangler types` and deployment to validate it. Slack is intentionally optional,
so its secret name is discovered defensively at runtime rather than declared as
a required secret.

## Local development

Install the worker-local dependencies:

```sh
cd worker
pnpm install --frozen-lockfile
```

Copy the example secrets file and replace its fake values:

```sh
cp .dev.vars.example .dev.vars
```

Then run:

```sh
pnpm run types
pnpm run dev
```

Wrangler simulates the Email Service binding locally. Email content can appear
in the local terminal and simulator files, so use synthetic data only.
Do not set `remote: true` in committed configuration: it sends real email.

The committed configuration uses the production origin and Turnstile hostname
sets. For a real local browser flow, use a separate local/staging Wrangler
environment and Turnstile test credentials; do not add localhost to the
production widget.

## Checks and tests

Run every Worker check from this directory:

```sh
pnpm run check
```

That command performs:

- a Wrangler deployment dry run for configuration and bundle validation;
- `wrangler types --check` to ensure generated bindings are current;
- strict TypeScript checking;
- Vitest tests in the Workers runtime.

The tests cover exact-origin preflight behavior, method/content-type rejection,
declared and streamed body limits, validation boundaries, honeypot behavior,
both rate-limit short circuits, Turnstile hostname/action checks, generic mail
failures, and Slack data minimization.

Before a deliberate deploy:

```sh
pnpm run deploy:dry-run
pnpm run deploy
```

The Worker is deliberately not part of the static GitHub Pages deployment.

## Observability and privacy

Structured logs contain only:

- request ID;
- outcome;
- category after validation;
- a bounded error class/code where applicable.

They do not contain name, email, message, IP, Turnstile token, secret values, or
webhook response content. Keep the contact privacy notice accurate: submissions
are delivered to the organizer inbox and may produce an internal Slack alert
containing the submitted form details.

## Delivery guarantee

There is no message database or queue. The Worker waits until Cloudflare Email
Service accepts the email before returning success, but it cannot provide
durable exactly-once delivery. A rare ambiguous network/provider failure can
lead to a retry or duplicate. If VGZT later requires durable delivery, add a
Cloudflare Queue and an explicit retention/deletion policy as a reviewed
architecture change.

## References

- [Turnstile server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Turnstile testing](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)
- [Workers Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Email Service Workers API](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/)
- [Email Service send bindings](https://developers.cloudflare.com/email-service/configuration/send-bindings/)
- [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
