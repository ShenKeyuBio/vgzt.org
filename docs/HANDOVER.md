# VGZT website handover

This guide is for a VGZT organizer who is taking over the website and has never used Astro. You do not need to learn Astro for ordinary content work.

## The five things to know

1. **The website is a set of files.** Events, people, seasons, opportunities, links, and campaign settings are stored in this GitHub repository.
2. **Pages CMS is the normal editor.** It presents those files as forms and commits each saved change to GitHub.
3. **GitHub checks every change.** A change is published only after validation, tests, and the static Astro build succeed.
4. **The contact form is separate.** The website itself is static; only the contact endpoint runs on Cloudflare.
5. **A deliberate blank is better than a guess.** Leave unknown content empty and keep it in Pending Content rather than inventing a date, affiliation, URL, or image.

If Pages CMS is unavailable, the live website keeps working. Pages CMS edits source files; it is not needed to serve the built site.

## Your first day as maintainer

Ask the outgoing organizer or repository owner to confirm access to:

- the VGZT GitHub repository;
- Pages CMS for that repository;
- the GitHub Actions and Pages settings;
- the `vgzt.org` Cloudflare account;
- the organizer destination inbox for `organizers@vgzt.org`;
- the Cloudflare Turnstile widget;
- the private Slack integration destination, if it is enabled.

Do not ask anyone to send you secret values in email or Slack. Access should be granted at the provider. If a shared secret must change ownership, rotate it in Cloudflare.

Then perform these checks:

- Open `https://vgzt.org` and verify the homepage and navigation.
- Open [Pages CMS](https://app.pagescms.org/) and confirm you can view Site Settings, Seasons, Events, People, Opportunities, Abstract Call, Social Links, and Pending Content.
- In GitHub, open **Actions** and confirm the latest `Validate and deploy VGZT` run succeeded.
- Open Pending Content and note which entries are marked **Required before launch**.
- Confirm which season is selected in **Site Settings -> Current season**.
- Read [CMS.md](CMS.md) before making the first edit.

## What you can change without code

Use Pages CMS for:

- adding a seminar or replacing its poster;
- adding/updating a speaker or organizer;
- publishing an opportunity;
- opening or closing the abstract call;
- changing the submission deadline or form destination;
- changing the newsletter, Slack, or social destinations;
- choosing the current season and its organizers;
- recording unresolved production content.

You should not need to edit Astro components, TypeScript, CSS, GitHub Actions, or the Worker for those tasks. If a normal seasonal task appears to require code, stop and ask a technical maintainer to improve the content/CMS model.

## A normal editing cycle

1. Open the relevant Pages CMS section.
2. Make one focused change using confirmed content.
3. Save. Pages CMS creates a Git commit.
4. Open the corresponding GitHub Actions run.
5. If checks pass, the default branch deploys the new static site automatically.
6. Inspect the live page on desktop and a phone.

A failed check protects the public site. Open the failed step to read its message, correct the data, and save again. Do not weaken validation to publish incomplete content.

Detailed field and writing guidance is in [CONTENT-GUIDE.md](CONTENT-GUIDE.md).

The **Stable ID** is the one field organizers must never change after creating a record. Pages CMS cannot lock it only after the first save, so CI checks it against the filename. Change display copy instead. If an ID was changed accidentally, revert that commit rather than trying to rename the file.

## Add a seminar safely

1. Add or confirm the speaker records under **People**.
2. Add the event under **Events** with status `draft`.
3. Enter the event's New York calendar date and wall-clock time only after confirmation.
4. Keep the timezone as `America/New_York`; never enter EDT, EST, UTC-4, or UTC-5.
5. Select the existing people rather than retyping biographies or affiliations.
6. Use an event affiliation override only when historical/event affiliation differs from the person's current profile.
7. Upload the approved original poster if available. Leave it empty otherwise.
8. Check the event page, local-time display, ET reference, speaker text, and poster legibility.
9. Change the event to `published` only after approval.

Never put a Zoom password or private subscriber link in an event record. The public access message tells visitors how to subscribe.

## Start a new season

Starting a season is additive. Do not rename, delete, or overwrite the previous season.

1. Create the five or more new organizer People records, or update existing profiles with confirmed current information.
2. Add the next season record, using a stable ID such as `season-09`.
3. Enter the confirmed season boundaries and `America/New_York` timezone.
4. Select organizers in the intended homepage order.
5. Publish the season record when its public summary and organizer list are ready.
6. Change **Site Settings -> Current season** to the new season ID.
7. Add real seminars as drafts; do not create invented examples in the production Events collection.
8. Update Abstract Call fields and status.
9. Review every Pending Content entry, adding new season-specific items where necessary.
10. Ask a technical maintainer to run the launch gate before announcing the season:

```sh
pnpm run validate:launch
```

The homepage organizer section automatically follows the organizer list on the selected season.

## Pending content is the launch checklist

`src/data/pending-content.yml` is not a scratchpad. It is the single list of missing production values.

Each item says:

- what is missing;
- where it will appear;
- whether launch must wait for it;
- exactly where to replace it in Pages CMS;
- whether it is still pending or resolved.

When content arrives, update the real field and resolve the pending entry in the same change. Never remove a launch blocker merely to make a check green.

## Images and historical assets

Historical flyers, organizer graphics, extracted marks, and Turing-pattern samples document VGZT's identity. They do not automatically grant approval to:

- reuse a historical portrait as a current profile image;
- trace a raster logo and call it the official master;
- extract an institution logo;
- treat a historical poster as a Season 8 poster.

Until an approved master mark is supplied, the website uses a clean text-based VGZT treatment. Upload a master logo only through **Site Settings -> Approved master logo** after explicit approval.

Portraits must be supplied or approved by VGZT/the person. Do not download them from LinkedIn, Google, or an institution website.

## Domains and providers

The public system is split deliberately:

| Address                | Operator           | Purpose                   |
| ---------------------- | ------------------ | ------------------------- |
| `https://vgzt.org`     | GitHub Pages       | Static public website     |
| `https://www.vgzt.org` | GitHub Pages / DNS | Alternate public hostname |
| `https://api.vgzt.org` | Cloudflare Worker  | Contact endpoint          |

Changing Site Settings does not change DNS, GitHub Pages, Turnstile, Email Routing, or Worker configuration. Provider changes need an administrator and the relevant runbook:

- [DEPLOYMENT.md](DEPLOYMENT.md) for GitHub Pages, domains, releases, and repository transfer;
- [CLOUDFLARE-SETUP.md](CLOUDFLARE-SETUP.md) for contact/email/Turnstile/Slack;
- [SECURITY.md](SECURITY.md) for secrets, privacy, and incidents.

## If something goes wrong

### A content edit broke the site

Use GitHub's **Revert** action on the bad commit, then wait for validation and deployment. Do not force-push or reset the shared branch.

### An event is wrong but the site still builds

Change it back to `draft` or correct it immediately through Pages CMS. Verify the public event page after deployment.

### The contact form fails

The rest of the website should remain available. Check whether Site Settings has the approved endpoint and Turnstile site key, then follow the troubleshooting section in [CLOUDFLARE-SETUP.md](CLOUDFLARE-SETUP.md). Do not paste a Worker secret into Site Settings.

### A secret may have leaked

Revoke or rotate it at the provider first. Reverting Git is not enough. Follow the incident procedure in [SECURITY.md](SECURITY.md).

### Pages CMS is unavailable

Do not panic: the live site is static. A GitHub maintainer can edit the same YAML file in a reviewed pull request, or wait for Pages CMS service to return.

## Annual maintenance review

At least once per season, confirm:

- current maintainers still need their GitHub, Pages CMS, Cloudflare, and Slack access;
- former organizers have been removed;
- the canonical domains and HTTPS are healthy;
- public email aliases reach an organizer-controlled inbox;
- Turnstile hostname/action restrictions still match production;
- Slack notifications still go to a private organizer destination;
- required launch items are resolved honestly;
- social and subscription destinations are canonical and still live;
- old events, people, and seasons remain intact;
- dependency and GitHub Action updates have received technical review.

## Glossary

**Astro**  
The tool that turns content and components into static HTML during the build. Organizers do not run an Astro server in production.

**Content collection**  
A folder of similarly shaped records, such as Events or People. Validation catches missing or malformed fields.

**Git commit**  
A saved, reversible change. Pages CMS creates one whenever an editor saves.

**GitHub Actions**  
Automated checks and deployment jobs attached to commits.

**GitHub Pages**  
The static web host serving `vgzt.org`.

**IANA timezone**  
A named timezone such as `America/New_York` whose daylight-saving rules can change by date.

**Pages CMS**  
The form editor for the Git-tracked content files.

**Turnstile**  
Cloudflare's browser/server verification used to reduce automated contact-form abuse.

**Worker**  
The small Cloudflare backend handling contact submissions. It is deployed separately from the website.

## Handover sign-off

Before the outgoing maintainer leaves, both people should confirm:

- [ ] the incoming maintainer can access all required systems;
- [ ] no secret was transferred in a public or long-lived message;
- [ ] the live site and contact flow have been tested with synthetic data;
- [ ] current launch blockers and known limitations have been explained;
- [ ] ownership of the domain, GitHub repository, organizer inbox, and Cloudflare account is clear;
- [ ] a recovery path exists if the primary maintainer is unavailable.
