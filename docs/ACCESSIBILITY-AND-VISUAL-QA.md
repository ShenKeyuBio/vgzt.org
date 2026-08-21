# Accessibility and visual QA

VGZT's browser suite uses Chromium at 1440×1000, 1024×768, 768×1024,
390×844, 360×800, and 320×720. GitHub Actions on Linux is the source of truth
for committed visual snapshots.

## Commands

- `pnpm run test:browser` builds and runs functional, accessibility, URL-contract,
  and visual checks.
- `pnpm run test:e2e` runs functional and URL-contract checks.
- `pnpm run test:a11y` runs axe checks, including expanded and error states.
- `pnpm run test:visual` compares snapshots.
- `pnpm run test:visual:update` intentionally updates snapshots. Run this only in
  the same Linux/Chromium environment used by CI, review every image, and commit
  only intended changes.

Third-party Microsoft Forms, EmailOctopus, Turnstile, and Slack requests are
blocked or deterministically stubbed in browser tests. VGZT-owned text, layout,
images, posters, navigation, and fixed actions are never masked. Functional tests
mock provider responses only where an external network result cannot be stable.

## Manual checklist

Keyboard-only:

- Use the skip link and confirm focus lands on `main` without being obscured.
- Open and close the mobile menu with Enter and Escape; confirm focus returns.
- Exercise season, event, and People tabs with arrows, Home, and End.
- Open and close a poster dialog and mobile Abstract TOC.
- Trigger Subscribe and Contact errors; confirm the first actionable error is
  focused and entered data remains.

Motion and reflow:

- With reduced motion enabled, confirm archive rotation is disabled and no smooth
  movement is required.
- At 200% browser zoom, and at 320 CSS px, confirm there is no horizontal document
  scroll, clipped poster, hidden focus ring, or fixed action over a field.
- Where supported, check forced colors/high contrast for visible labels, keylines,
  focus, selected tabs, and form errors.
- Disable JavaScript and confirm core content, the native mobile navigation, public
  organizer email, and external Abstract submission path remain usable. Gated
  Subscribe provider links must not be exposed.

Archive autoplay deliberately stays paused after keyboard, pointer, touch,
Previous, or Next interaction. Only explicit Play resumes it; this prevents focus
changes from unexpectedly moving content. Event Detail uses the same timezone
controller as the homepage so month, day, weekday, time, storage fallback, and DST
handling cannot drift between views.

## Content and media freeze

Visual and interaction work must not edit `src/content`, `src/data`, `src/assets`,
or `public`. Before and after a UI change, compare tracked SHA-256 inventories and
the frozen Abstract/Subscribe URL inventory. Public wording and provider URLs are
content contracts, not test fixtures to rewrite.
