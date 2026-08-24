import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  eventRoute,
  htmlRoutes,
  mockJoinFlow,
  stabilizePage,
  waitForStableLayout,
} from './helpers';

async function expectNoSeriousAxeViolations(page: Page) {
  await waitForStableLayout(page);
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    ({ impact }) => impact === 'critical' || impact === 'serious',
  );
  expect(
    blocking.map(({ id, impact, nodes }) => ({
      id,
      impact,
      nodes: nodes.map(({ target, failureSummary, html }) => ({
        target,
        failureSummary,
        html,
      })),
    })),
  ).toEqual([]);
}

test.describe('route accessibility', () => {
  for (const route of htmlRoutes) {
    test(`${route} has no serious automated accessibility violations`, async ({
      page,
    }) => {
      await stabilizePage(page);
      await page.goto(route);
      await expectNoSeriousAxeViolations(page);
    });
  }
});

test.describe('expanded and error states', () => {
  test('open mobile navigation', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-390');
    await stabilizePage(page);
    await page.goto('/');
    await page.locator('[data-mobile-nav] > summary').click();
    await expectNoSeriousAxeViolations(page);
  });

  test('active archive programme and poster dialog', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440');
    await stabilizePage(page);
    await page.goto('/?season=season-07#programme');
    await expectNoSeriousAxeViolations(page);
    await page.goto(eventRoute);
    await page.locator('[data-poster-open]').click();
    await expectNoSeriousAxeViolations(page);
  });

  test('Abstract TOC and People filtered states', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-390');
    await stabilizePage(page);
    await page.goto('/abstracts/');
    await page.locator('[data-abstracts-toc] > summary').click();
    await expectNoSeriousAxeViolations(page);
    await page.goto('/people/?view=organizers&season=season-07&q=keyu');
    await expectNoSeriousAxeViolations(page);
  });

  test('Subscribe primary form and combined result state', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440');
    await mockJoinFlow(page);
    await stabilizePage(page);
    await page.goto('/subscribe/');
    const form = page.locator('[data-join-form]');
    await form.locator('#join-email').fill('test@example.org');
    await form.locator('#join-mailing-list').check();
    await form.locator('#join-slack').check();
    await expectNoSeriousAxeViolations(page);
    await form.locator('[data-join-submit]').click();
    await expectNoSeriousAxeViolations(page);
  });

  test('Contact validation error state', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-390');
    await stabilizePage(page);
    await page.goto('/contact/');
    await page.locator('[data-contact-form] button[type="submit"]').click();
    await expectNoSeriousAxeViolations(page);
  });
});
