import { expect, test, type Page } from '@playwright/test';
import { eventRoute, stabilizePage, waitForStableLayout } from './helpers';

async function openStable(page: Page, route: string) {
  await stabilizePage(page, true);
  await page.goto(route);
  await waitForStableLayout(page);
}

async function fillSubscribeGate(page: Page) {
  const form = page.locator('[data-join-form]');
  await form.locator('#join-slack').check();
  await form.locator('#join-name').fill('Test Researcher');
  await form.locator('#join-organization').fill('Test Institute');
  await form.locator('#join-career-stage').selectOption({ index: 1 });
  await form.locator('#join-email').fill('test@example.org');
  await form.locator('#join-slack-email').fill('slack@example.org');
  await form.locator('#join-privacy').check();
  await form.locator('[data-join-submit]').click();
  return form;
}

test('home-desktop', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440');
  await openStable(page, '/');
  await expect(page).toHaveScreenshot('home-desktop.png', { fullPage: true });
});

test('home-mobile', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390');
  await openStable(page, '/');
  await expect(page).toHaveScreenshot('home-mobile.png', { fullPage: true });
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

test('subscribe-desktop-gated-primary', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440');
  await openStable(page, '/subscribe/');
  const form = await fillSubscribeGate(page);
  const result = form.locator('[data-subscription-result]');
  await result.scrollIntoViewIfNeeded();
  await expect(result).toHaveScreenshot('subscribe-desktop-gated-primary.png');
});

test('subscribe-mobile-manual-fallback', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390');
  await openStable(page, '/subscribe/');
  const form = await fillSubscribeGate(page);
  await form.locator('[data-manual-fallback]').click();
  const result = form.locator('[data-subscription-result]');
  await result.scrollIntoViewIfNeeded();
  await expect(result).toHaveScreenshot('subscribe-mobile-manual-fallback.png');
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
