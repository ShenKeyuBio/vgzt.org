import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('session detail shows its own approved Zoom access', async ({ page }) => {
  await page.goto('/events/season-08-2026-09-18/');
  await expect(
    page.getByRole('link', { name: 'Join Zoom', exact: true }),
  ).toHaveAttribute(
    'href',
    'https://ucla.zoom.us/j/96731487183?pwd=bBfYjemAodscbi3Pb5phgMRkikO82G.1',
  );
  await expect(page.locator('.event-metadata__access')).toContainText(
    '967 3148 7183',
  );
  await expect(page.locator('.event-metadata__access')).toContainText('vgzt8');
});

for (const route of [
  '/events/season-08-2026-09-18/calendar/',
  '/calendar/vgzt-season-8-opening-session.html',
]) {
  test(`calendar automatic and manual downloads: ${route}`, async ({
    page,
  }) => {
    const downloadPromise = page.waitForEvent('download');
    await page.goto(route);
    const automatic = await downloadPromise;
    const first = await readFile((await automatic.path())!, 'utf8');
    expect(automatic.suggestedFilename()).toMatch(/\.ics$/);
    const manualPromise = page.waitForEvent('download');
    await page.locator('#download').click();
    const manual = await manualPromise;
    expect(await readFile((await manual.path())!, 'utf8')).toBe(first);
    const unfolded = first.replace(/\r\n[ \t]/g, '');
    expect(unfolded).toContain('Riley McMahon');
    expect(unfolded).toContain('Meeting ID: 967 3148 7183');
    expect(unfolded).toContain('Passcode: vgzt8');
    expect(unfolded).toContain('DTSTART:20260918T130000Z');
    expect(unfolded).toContain('DTEND:20260918T140000Z');
    expect(unfolded).toContain(
      'URL:https://ucla.zoom.us/j/96731487183?pwd=bBfYjemAodscbi3Pb5phgMRkikO82G.1\r\n',
    );
    for (const line of first.split('\r\n'))
      expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
  });
}

test('failed calendar fetch can be retried with the manual button', async ({
  page,
}) => {
  let attempts = 0;
  await page.route(
    '**/events/season-08-2026-09-18/calendar.ics',
    async (route) => {
      if (++attempts === 1)
        await route.fulfill({ status: 503, body: 'Unavailable' });
      else await route.continue();
    },
  );
  await page.goto('/events/season-08-2026-09-18/calendar/');
  await expect(page.locator('#status')).toContainText('retry');
  const downloaded = page.waitForEvent('download');
  await page.locator('#download').click();
  expect((await downloaded).suggestedFilename()).toBe(
    'season-08-2026-09-18.ics',
  );
});
