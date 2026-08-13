# Cloudflare contact, email, Turnstile, and Slack setup

This runbook configures the server-backed parts of the VGZT website. The public Astro site remains on GitHub Pages; Cloudflare is used only for DNS/email services, Turnstile, and the isolated contact Worker at `api.vgzt.org`.

The Worker has no database. It validates a contact submission, verifies Turnstile, sends one plain-text organizer email, and can issue a metadata-only alert to a private Slack destination.

## Responsibility boundary

| Component                   | Stores/uses                                                                  | Must not contain                                 |
| --------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------ |
| Static website              | public endpoint, public Turnstile site key                                   | Turnstile secret, webhook, mail credentials      |
| Cloudflare Worker variables | public origins, expected hostnames/action, public sender/destination aliases | secret values committed in `wrangler.jsonc`      |
| Cloudflare Worker secrets   | Turnstile secret, optional Slack webhook                                     | content/editorial data                           |
| Email Service binding       | fixed sender and fixed organizer destination                                 | visitor-controlled sender/destination            |
| Pages CMS                   | public site/contact configuration                                            | any Worker secret or personal forwarding address |

The Worker is deployed separately. The GitHub Pages workflow checks Worker code but never deploys it or receives its secrets.

## Prerequisites

You need:

- administrator access to the Cloudflare account/zone for `vgzt.org`;
- the ability to configure a Worker route in the `vgzt.org` zone;
- access to Cloudflare Turnstile;
- access to Cloudflare Email Routing and Email Sending/Email Service features used by the account;
- an organizer-controlled private destination inbox;
- optionally, permission to create an incoming webhook for a private organizer Slack channel;
- Node.js 22.12+ and pnpm 11.19 for local Worker checks.

Do not begin by entering real secrets into a repository file.

## Intended production flow

```text
Visitor at https://vgzt.org
  -> Turnstile widget (action: vgzt_contact)
  -> POST https://api.vgzt.org/contact
  -> exact origin + method + body limits
  -> honeypot + field validation + rate limits
  -> Turnstile Siteverify
  -> Cloudflare Email Service binding
  -> organizers@vgzt.org
  -> organizer-controlled private inbox
  -> optional metadata-only Slack alert
```

Email is required for a successful genuine submission. Slack is best-effort and optional. If Slack fails after email acceptance, the visitor still receives success.

## 1. Review the committed Worker configuration

The Worker lives under `worker/`. Before deployment, review `worker/wrangler.jsonc` and confirm:

- Worker name is appropriate for the production account;
- route covers `api.vgzt.org/*` in the `vgzt.org` zone;
- `workers_dev` remains disabled for this production configuration;
- `ALLOWED_ORIGINS` is exactly `https://vgzt.org,https://www.vgzt.org`;
- expected Turnstile hostnames are exactly `vgzt.org,www.vgzt.org`;
- expected Turnstile action is `vgzt_contact`;
- fixed From alias is `contact@vgzt.org`;
- fixed destination alias/binding is `organizers@vgzt.org`;
- both rate-limit bindings exist;
- Email Service binding restricts destination and allowed sender;
- observability is enabled without logging personal contact content.

Use a separate Wrangler environment/widget for local browser or staging work. Do not add localhost to the committed production origin or Turnstile hostname allowlist.

## 2. Configure DNS and the Worker route

Keep `vgzt.org` as the canonical static-site domain on GitHub Pages. Create the required proxied DNS hostname for `api.vgzt.org`, then configure the zone route `api.vgzt.org/*` represented by `wrangler.jsonc`. The committed configuration uses a route, not a Workers Custom Domain declaration.

After deployment, confirm:

- `api.vgzt.org` is proxied/managed by Cloudflare;
- its TLS certificate is active;
- `https://api.vgzt.org/contact` reaches the Worker;
- unrelated paths do not expose a debug page or secret details;
- the apex/static DNS records still point to GitHub Pages as intended.

Do not move the Astro site to a Cloudflare adapter to make the contact form work. The backend is intentionally isolated.

## 3. Configure inbound organizer email

Cloudflare Email Routing handles inbound aliases and forwarding. It is distinct from the outbound Email Service binding used by the Worker.

Recommended inbound setup:

1. Enable Email Routing for `vgzt.org`.
2. Verify the private organizer-controlled destination inbox at Cloudflare.
3. Route `organizers@vgzt.org` to that private destination.
4. Optionally route `contact@vgzt.org` and `abstracts@vgzt.org` according to organizer policy.
5. Send synthetic inbound test messages and verify delivery/replies.

Never put the private forwarding destination in frontend code, Pages CMS, repository documentation, or `pending-content.yml`.

## 4. Configure outbound Email Service

The Worker uses Cloudflare's native `send_email` binding. It does not send through Email Routing alone and does not need a Cloudflare REST API token in Worker code.

1. Onboard `vgzt.org` to the account's Cloudflare Email Sending/Email Service feature.
2. Add and verify the SPF, DKIM, and bounce records Cloudflare provides.
3. Confirm `contact@vgzt.org` is accepted as the fixed sender.
4. Confirm `organizers@vgzt.org` is an accepted binding destination.
5. Keep the `CONTACT_EMAIL` binding restrictions in `wrangler.jsonc` aligned with those two aliases.
6. Send a synthetic staging message and verify the organizer inbox receives it.
7. Reply to the message and confirm the reply goes to the synthetic visitor address used in the test.

The Worker sets the visitor address only as `Reply-To`, never as `From`. This preserves the domain's SPF/DMARC alignment and prevents visitor-controlled sender spoofing.

## 5. Create the Turnstile widget

In Cloudflare Turnstile:

1. Create a production widget for the VGZT contact form.
2. Restrict production hostnames to:
   - `vgzt.org`
   - `www.vgzt.org`
3. Configure/render the widget with action `vgzt_contact`.
4. Copy the **public site key** for later entry in Pages CMS.
5. Store the **secret key** as a Worker secret; never put it in the static site.

From the `worker/` directory, after authenticating Wrangler to the correct account:

```sh
pnpm wrangler secret put TURNSTILE_SECRET
```

Turnstile tokens are single-use and expire after five minutes. The frontend resets the widget after failure; the Worker verifies success, hostname, and the exact `vgzt_contact` action server-side.

Use Cloudflare's documented test keys for automated/local testing. Never deploy a test secret to production.

## 6. Optionally configure Slack

Slack notification is disabled when `SLACK_WEBHOOK_URL` is absent.

If organizers want it:

1. Create an incoming webhook that posts to an organizer-controlled **private** channel.
2. Check that membership and retention settings match VGZT privacy expectations.
3. Store the webhook as a Worker secret:

```sh
pnpm wrangler secret put SLACK_WEBHOOK_URL
```

Only standard Slack/Slack Gov HTTPS webhook hosts are accepted by the Worker. The alert includes category, name, reply-to address, and request ID. It deliberately omits the message body, IP address, browser details, and Turnstile token. Visitor values are sent as plain text so they cannot create mentions or links.

To disable Slack later, remove the Worker secret rather than inserting an empty/fake URL.

## 7. Local setup and checks

Install from the Worker-local lockfile:

```sh
cd worker
corepack enable
pnpm install --frozen-lockfile
```

For local Worker development only, copy the example and use development/test values:

```sh
cp .dev.vars.example .dev.vars
```

`.dev.vars` is ignored and must never be committed. Keep synthetic data in the simulator: local Email Service output may appear in terminal/simulator files.

Generate/check bindings and run the Worker:

```sh
pnpm run types
pnpm run dev
```

Run the complete verification suite:

```sh
pnpm run check
```

`pnpm run check` validates generated binding freshness, strict TypeScript, Workers-runtime tests, and a Wrangler deployment dry run.

Do not commit `remote: true` for the email binding; that could send real email during local development.

## 8. Deploy deliberately

The website CI never deploys the Worker. From `worker/`, using an account authorized for the `vgzt.org` zone:

```sh
pnpm run deploy
```

Read the deployment output and confirm the expected Worker and zone route. Do not deploy from an account containing unrelated production zones unless access is deliberately scoped.

If VGZT later automates Worker deployment, use a separate protected GitHub environment and a least-privilege Cloudflare token. Do not attach that token to the static Pages build.

## 9. Connect the static site

Only after the Worker and Turnstile production configuration are working:

1. Open Pages CMS **Site Settings**.
2. Set **Contact API endpoint** to `https://api.vgzt.org/contact`.
3. Set **Turnstile public site key** to the production widget's public key.
4. Save and wait for GitHub checks/deployment.
5. Resolve the corresponding Pending Content entries only after end-to-end verification.

The secret key and Slack webhook must never be entered in Pages CMS.

## 10. Production acceptance test

Use synthetic contact data belonging to the tester. Do not use a real community member's address/message.

Verify:

- the contact section loads without exposing a secret;
- Turnstile completes on both `vgzt.org` and `www.vgzt.org` as intended;
- a valid submission returns success and a request ID;
- the organizer inbox receives one plain-text message;
- From is the fixed VGZT sender and Reply-To is the synthetic visitor;
- Slack receives only the minimal metadata when enabled;
- an empty/invalid message receives field feedback;
- a completed honeypot does not send a notification;
- a reused/expired Turnstile token fails generically;
- a request from a non-VGZT browser origin is not accepted;
- oversized/malformed/non-JSON requests do not expose internals;
- repeated attempts encounter the intended rate controls;
- logs contain request ID/outcome codes but not name, email, message, IP, token, or webhook response.

Do not conduct destructive load testing against production without explicit approval.

## Privacy and retention

The Worker does not persist a message database or queue. It waits for Email Service acceptance and then returns success. Rare provider/network ambiguity can result in a failed or duplicate delivery; it is not exactly-once storage.

The organizer inbox becomes the system retaining the submitted name, reply address, category, message, and privacy acknowledgement. Organizers must agree on mailbox retention/deletion before publishing a precise retention promise.

Cloudflare observability is configured to avoid logging personal submission fields. Slack remains a minimal alert, not a copy of the submission.

## Rotation and incident response

### Rotate Turnstile

1. Create/obtain the replacement widget secret.
2. Update `TURNSTILE_SECRET` in Worker secrets.
3. If the public site key changes, update Site Settings in the same coordinated release.
4. Test, then revoke the old credential/widget as appropriate.

### Rotate or disable Slack

1. Revoke the old incoming webhook in Slack immediately if exposure is suspected.
2. Set the replacement `SLACK_WEBHOOK_URL` secret or remove it to disable Slack.
3. Test with synthetic data.

### Change organizer destination

Change the private Email Routing destination in Cloudflare. Do not edit the public alias into a personal address in repository code. If the fixed public destination alias itself changes, review both routing and the Email Service binding/Worker configuration.

For any suspected leak, rotate/revoke first. Git revert alone does not make a disclosed secret safe. Follow [SECURITY.md](SECURITY.md).

## Troubleshooting

### Contact form says it is not available

Check that Site Settings has both the production endpoint and public Turnstile site key and that their Pending Content items are genuinely resolved.

### Turnstile always fails

Confirm the visitor is on an allowed production hostname, widget action is `vgzt_contact`, the site/secret keys belong to the same widget, and the Worker expected hostnames/action match. Do not loosen the hostname check to `*`.

### Browser reports a CORS error

Confirm the request originates exactly from `https://vgzt.org` or `https://www.vgzt.org`, targets `/contact`, and uses the expected JSON content type. Do not use wildcard or credentialed CORS as a fix.

### Worker reports success but no Slack message arrives

Check whether Slack is intentionally disabled, whether the webhook still exists, and whether the channel/app permissions changed. Email delivery is the required path; inspect non-sensitive error codes without logging the webhook response/body.

### Worker returns a generic delivery failure

Verify Email Service availability, the binding name, allowed sender, accepted destination, and domain authentication records. Keep public errors generic; use Cloudflare/provider logs without copying personal message content.

### Wrangler type check fails

Run `pnpm run types`, inspect the binding diff, and commit the regenerated `worker-configuration.d.ts` only when it matches the reviewed `wrangler.jsonc`. Then rerun `pnpm run check`.

### Domain does not resolve after deployment

Check the Worker route, Cloudflare zone ownership, proxied `api` DNS record, and certificate activation. Also confirm changes did not disturb the GitHub Pages apex/`www` records.

## Go-live checklist

- [ ] `api.vgzt.org` resolves to the expected Worker with HTTPS.
- [ ] Production origin and Turnstile hostname/action allowlists are exact.
- [ ] `TURNSTILE_SECRET` is stored only as a Worker secret.
- [ ] Email Routing reaches a private organizer-controlled inbox.
- [ ] Email Service sender/destination binding and domain authentication are verified.
- [ ] Optional Slack webhook is secret and points to a private channel, or is absent.
- [ ] `pnpm run check` passes, including its Wrangler deployment dry run.
- [ ] A deliberate Worker deployment succeeds.
- [ ] Site Settings contains only the endpoint and public site key.
- [ ] End-to-end testing uses synthetic data and produces one organizer email.
- [ ] Logs and Slack contain no message body, IP, token, or secret.
- [ ] Pending Content is resolved only after real verification.
- [ ] The public privacy notice matches the actual email/Slack/retention flow.
