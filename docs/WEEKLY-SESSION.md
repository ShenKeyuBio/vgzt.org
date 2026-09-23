# Weekly session publication

Use Node 24 (CI's version), pnpm 11.19.0 and `pnpm install --frozen-lockfile` in a clean checkout of current remote main. Preserve unrelated local work. If a macOS Documents checkout stalls while reading Git objects or dependencies, use a fresh clone in a local temporary directory. Set `ASTRO_TELEMETRY_DISABLED=1` for sandboxed runs; this only disables Astro telemetry, not validation.

## Source and generation

1. Cross-check the supplied poster against the organizer's text. Ask only about conflicting or missing date, timezone, speaker or Zoom information. Preserve the original poster under `src/assets/posters/season-08/`.
2. Create a new event in `src/content/events/`; never replace a previous event. Reuse people records. Store the announced date, wall time and IANA timezone. Use 60 minutes if no duration was supplied and disclose that assumption. Follow the current event schema and content guide.
3. For explicitly organizer-approved public joining information, set `access: { url, meetingId, passcode }` on that event. All three values must be provided for this event and the meeting ID must match the URL. Do not infer a readable passcode from Zoom's `pwd` token or inherit another session's access. Access defaults to null for historical/private events.
4. Run `pnpm run session:prepare <event-id>`. This resolves speakers, affiliations, titles and the date-aware time conversions from the event; creates a 1200-pixel JPEG without altering the source; and creates a new HTML email plus subject/preview JSON in `docs/email-templates/`. It refuses to overwrite an existing email. Use `--output-dir /tmp/vgzt-rehearsal` for a rehearsal. Check the JPEG visually and decode any QR code before publication. If the default width loses QR readability, use `--poster-width 1400` (the opening-session rehearsal needed 1400 pixels, resulting in a 226 KB decodable JPEG). Preserve QR content exactly; do not redraw it or silently substitute a different URL.
5. `pnpm run build` generates `/events/<id>/calendar.ics` and `/events/<id>/calendar/` from that same event. Both automatic and manual downloads fetch the same ICS. Do not add calendar data to the download page. The legacy opening-session URL remains supported, with its previously distributed UID retained; all new emails use the canonical event calendar URL/UID.

The reusable `session-template.html` preserves the historical email's VGZT / The Node header, white body, responsive styles, footer and EmailOctopus merge tags. Generated posters are unlinked; Join Zoom is a separate text link. Every regional time includes its local date, including cross-day sessions. “Central Europe” uses `Europe/Paris`, not an assumed pan-European zone.

## Validate and deliver

- Format only changed files using the installed Prettier and repository config. Run all current CI checks: formatting, Astro/types, content graph, pending report, unit tests, build and browser suite; use CI's Linux run for visual baselines. Do not disable checks or regenerate unrelated baselines.
- Run `pnpm exec playwright test tests/e2e/calendar-download.spec.ts` after building. Download tests must inspect the saved file, not just HTTP status. Independently parse delivered ICS with a real calendar parser and compare UTC start/end, titles, access, stable UID, CRLF, 75-octet folding and exact Zoom URL. In an isolated Python environment, `icalendar` can perform the independent parse; it is not a website dependency.
- Preview the generated email at desktop and mobile widths, confirm no horizontal overflow, loaded images and an unlinked poster, inspect the exact Zoom href, and click the calendar link to save and parse its ICS. Email contains no JavaScript. A hyperlink is not a real email attachment.
- Check the diff and remote main again before one logical commit/push. Follow branch protection. Track the exact SHA through Actions and deployment. Then repeat the download, poster and session checks on production, including verifying production image bytes. A local pass or HTTP 200 alone is not deployment/download proof.
- Deliver the session URL, downloadable HTML, ICS, subject, preview, commit and CI/deployment links. State any incomplete verification. Do not send emails, alter subscribers or invite individuals. Remind the organizer to reimport the HTML into EmailOctopus: GitHub edits do not update an already imported campaign.

New weekly content needs only the poster and complete, confirmed session access; no new service, credentials, dependencies or workflow configuration is required.
