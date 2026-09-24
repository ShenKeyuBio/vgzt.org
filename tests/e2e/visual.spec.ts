import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { expect, test, type Page } from '@playwright/test';
import {
  eventRoute,
  mockJoinFlow,
  stabilizePage,
  waitForStableLayout,
} from './helpers';

async function openStable(page: Page, route: string) {
  await stabilizePage(page, true);
  await page.goto(route);
  await page.addStyleTag({
    content: '* { content-visibility: visible !important; }',
  });
  await page.evaluate(async () => {
    const images = [...document.images];
    images.forEach((image) => {
      image.loading = 'eager';
    });
    await Promise.all(
      images.map(async (image) => {
        if (!image.complete) {
          await new Promise<void>((resolve) => {
            image.addEventListener('load', () => resolve(), { once: true });
            image.addEventListener('error', () => resolve(), { once: true });
          });
        }
        await image.decode().catch(() => undefined);
      }),
    );
  });
  await waitForStableLayout(page);
}

async function fillSubscribeForm(page: Page) {
  const form = page.locator('[data-join-form]');
  await form.locator('#join-name').fill('Test Person');
  await form.locator('#join-affiliation').fill('Test Institute');
  await form.locator('#join-email').fill('test@example.org');
  await form.locator('#join-mailing-list').check();
  await form.locator('#join-slack').check();
  await form.locator('[data-join-submit]').click();
  return form;
}

// Weekly content changes must remain visible in layout checks without pinning
// the homepage to the opening session forever.
async function selectedEventMatchesContent(page: Page) {
  const panel = page.locator('[data-event-panel]:visible');
  await expect(panel).toHaveCount(1);
  const id = await panel.getAttribute('data-event-panel');
  const event = parse(await readFile(`src/content/events/${id}.yml`, 'utf8'));
  const tab = page.locator(`[data-event-tab][data-event-id="${id}"]`);
  await expect(tab).toBeVisible();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  for (const speaker of event.speakers) {
    const person = parse(
      await readFile(`src/content/people/${speaker.person}.yml`, 'utf8'),
    );
    await expect(panel).toContainText(person.preferredName || person.name);
    await expect(panel).toContainText(speaker.talkTitle);
    await expect(panel).toContainText(
      speaker.affiliationOverride || person.currentAffiliation,
    );
  }
  await expect(panel).toContainText(event.time);
  await expect(panel.locator('.poster-viewer__open img')).toHaveAttribute(
    'alt',
    event.poster ? event.posterAlt : 'Poster coming soon',
  );
  await expect(panel.locator('.poster-viewer__open img')).toBeVisible();
  await expect(page.locator('.schedule-empty')).toHaveCount(0);
  return panel;
}

test('home-desktop', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440');
  await openStable(page, '/');

  const eventPanel = await selectedEventMatchesContent(page);

  const layout = await eventPanel.evaluate((element) => ({
    columns: getComputedStyle(element).gridTemplateColumns.trim().split(' '),
    overflow: element.scrollWidth > element.clientWidth,
  }));
  expect(layout.columns).toHaveLength(2);
  expect(layout.overflow).toBe(false);
});

test('home-mobile', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390');
  await openStable(page, '/');

  const eventPanel = await selectedEventMatchesContent(page);

  const layout = await eventPanel.evaluate((element) => ({
    columns: getComputedStyle(element).gridTemplateColumns.trim().split(' '),
    overflow: element.scrollWidth > element.clientWidth,
  }));
  expect(layout.columns).toHaveLength(1);
  expect(layout.overflow).toBe(false);
});

test('home-season-archive-selected', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440');
  await openStable(page, '/?season=season-07#programme');
  await expect(page).toHaveScreenshot('home-season-archive-selected.png', {
    fullPage: true,
  });
});

test('abstracts-desktop-top', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440');
  await openStable(page, '/abstracts/');
  await expect(page).toHaveScreenshot('abstracts-desktop-top.png');
});

test('abstracts-desktop-awards', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440');
  await openStable(page, '/abstracts/');
  await page.locator('#early-career-awards').scrollIntoViewIfNeeded();
  await expect(page).toHaveScreenshot('abstracts-desktop-awards.png');
});

test('abstracts-mobile-toc-closed', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390');
  await openStable(page, '/abstracts/');
  await page.locator('[data-abstracts-toc]').scrollIntoViewIfNeeded();
  await expect(page).toHaveScreenshot('abstracts-mobile-toc-closed.png');
});

test('abstracts-mobile-submit', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390');
  await openStable(page, '/abstracts/');
  await page.locator('#submit').scrollIntoViewIfNeeded();
  await expect(page).toHaveScreenshot('abstracts-mobile-submit.png');
});

test('people-desktop-speakers', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440');
  await openStable(page, '/people/');
  await expect(page).toHaveScreenshot('people-desktop-speakers.png', {
    fullPage: true,
  });
});

test('people-mobile-filtered', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390');
  await openStable(page, '/people/?season=season-07&q=morsdorf');
  await expect(page).toHaveScreenshot('people-mobile-filtered.png', {
    fullPage: true,
  });
});

test('subscribe-desktop-both-success', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440');
  await mockJoinFlow(page);
  await openStable(page, '/subscribe/');
  const form = await fillSubscribeForm(page);
  const result = form.locator('[data-subscription-result]');
  await result.scrollIntoViewIfNeeded();
  await expect(result).toHaveScreenshot('subscribe-desktop-both-success.png');
});

test('subscribe-mobile-primary-form', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390');
  await mockJoinFlow(page);
  await openStable(page, '/subscribe/');
  const form = page.locator('[data-join-form]');
  await form.locator('#join-email').focus();
  await expect(
    page.locator('[data-persistent-mobile-actions]'),
  ).toHaveAttribute('data-form-focus', 'true');
  await form.scrollIntoViewIfNeeded();
  await expect(form).toHaveScreenshot('subscribe-mobile-primary-form.png');
});

test('contact-mobile-error', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390');
  await openStable(page, '/contact/');
  const form = page.locator('[data-contact-form]');
  await form.locator('button[type="submit"]').click();
  await form.scrollIntoViewIfNeeded();
  await expect(form).toHaveScreenshot('contact-mobile-error.png');
});

test('opportunities-empty', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440');
  await openStable(page, '/opportunities/');
  await expect(page).toHaveScreenshot('opportunities-empty.png', {
    fullPage: true,
  });
});

test('about-mobile', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390');
  await openStable(page, '/about/');
  await expect(page).toHaveScreenshot('about-mobile.png', { fullPage: true });
});

test('privacy-desktop', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440');
  await openStable(page, '/privacy/');
  await expect(page).toHaveScreenshot('privacy-desktop.png', {
    fullPage: true,
  });
});

test('event-detail-desktop', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440');
  await openStable(page, eventRoute);
  await expect(page).toHaveScreenshot('event-detail-desktop.png', {
    fullPage: true,
  });
});

test('event-detail-mobile', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390');
  await openStable(page, eventRoute);
  await expect(page).toHaveScreenshot('event-detail-mobile.png', {
    fullPage: true,
  });
});

test('404-mobile', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390');
  await openStable(page, '/guaranteed-missing-route/');
  await expect(page).toHaveScreenshot('404-mobile.png', { fullPage: true });
});
