import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const id = 'season-08-2026-09-25';
const zoom =
  'https://ucla.zoom.us/j/98329340653?pwd=QiBe55nprSOyULlvirAL0Lx6KoNOEH.1';

test('poster-pending session and text-only email preserve the supplied details', async ({
  page,
}) => {
  await page.goto(`/events/${id}/`);
  await expect(page.locator('h1')).toHaveText('Chun So & Benjamin Swedlund');
  await expect(page.locator('.poster-viewer__open img')).toHaveAttribute(
    'src',
    '/assets/poster-placeholder.svg',
  );
  await expect(
    page.getByRole('link', { name: 'Join Zoom', exact: true }),
  ).toHaveAttribute('href', zoom);
  const source = await readFile(
    `docs/email-templates/vgzt-season-8-2026-09-25-session.html`,
    'utf8',
  );
  expect(source).toMatch(/^<!doctype html>/i);
  expect(source).not.toMatch(
    /<script\b|session-poster|Shi-Lei|McMahon|96731487183|September 18/,
  );
  for (const tag of [
    'PreviewText',
    'SenderInfo',
    'UnsubscribeURL',
    'RewardsURL',
  ])
    expect(source).toContain(`{{${tag}}}`);
  // Render using local brand assets/calendar while retaining the exact Zoom URL.
  await page.setContent(
    source.replaceAll('https://vgzt.org', 'http://127.0.0.1:4321'),
  );
  await expect(page.locator('img')).toHaveCount(2);
  await expect(
    page.getByRole('link', { name: 'Join Zoom', exact: true }),
  ).toHaveAttribute('href', zoom);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const pending = page.waitForEvent('download');
  await page
    .getByRole('link', { name: 'Add to calendar (.ics)', exact: true })
    .click();
  const download = await pending;
  const calendar = await readFile((await download.path())!, 'utf8');
  const unfolded = calendar.replace(/\r\n[ \t]/g, '');
  expect(download.suggestedFilename()).toBe(`${id}.ics`);
  for (const text of [
    'DTSTART:20260925T140000Z',
    'DTEND:20260925T150000Z',
    'Chun So',
    'Benjamin Swedlund',
    'Illuminating the beginning of human life',
    'Deconstructing and Reconstructing Multicellular Self-organisation with Synthetic Biology',
    'Meeting ID: 983 2934 0653',
    'Passcode: vgzt8',
    `URL:${zoom}\r\n`,
  ])
    expect(unfolded).toContain(text);
});
