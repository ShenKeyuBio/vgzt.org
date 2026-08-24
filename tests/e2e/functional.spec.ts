import { expect, test } from '@playwright/test';
import {
  calendarRoute,
  eventRoute,
  expectBasicPageIntegrity,
  expectFocusNotObscured,
  htmlRoutes,
  mockJoinFlow,
  stabilizePage,
  waitForStableLayout,
} from './helpers';

test.describe('public route integrity', () => {
  for (const route of htmlRoutes) {
    test(`${route} is responsive and keyboard reachable`, async ({ page }) => {
      await stabilizePage(page);
      const response = await page.goto(route);
      expect(response).not.toBeNull();
      await waitForStableLayout(page);
      await expectBasicPageIntegrity(page);

      const controls = page.locator(
        '.button:visible, button:visible:not([role="switch"]), .mobile-nav > summary:visible',
      );
      for (let index = 0; index < (await controls.count()); index += 1) {
        const control = controls.nth(index);
        const box = await control.boundingBox();
        if (box)
          expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(43);
      }

      await page.keyboard.press('Tab');
      await expect(page.locator('.skip-link')).toBeFocused();
      await expect(page.locator('.skip-link')).toBeVisible();
      await page.keyboard.press('Enter');
      await expect(page.locator('#main-content')).toBeFocused();
      await expectFocusNotObscured(page);
    });
  }

  test('calendar endpoint returns canonical UTC data', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-1440');
    const eventResponse = await page.goto(eventRoute);
    expect(eventResponse?.ok()).toBe(true);
    const instant = await page
      .locator('[data-local-date]')
      .getAttribute('data-local-date');
    const calendar = await page.request.get(calendarRoute);
    expect(calendar.ok()).toBe(true);
    const text = await calendar.text();
    expect(text).toContain('BEGIN:VCALENDAR');
    expect(text).toContain('DTSTART:');
    expect(text).toContain('DTEND:');
    if (instant) {
      const toIcs = (value: string) =>
        new Date(value)
          .toISOString()
          .replace(/[-:]/g, '')
          .replace(/\.000Z$/, 'Z');
      expect(text).toContain(`DTSTART:${toIcs(instant)}`);
    }
  });
});

test.describe('navigation and hierarchy', () => {
  test('mobile menu is a resilient native disclosure', async ({
    page,
  }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('mobile'));
    await stabilizePage(page);
    await page.goto('/people/');
    const menu = page.locator('[data-mobile-nav]');
    const summary = menu.locator('summary');
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(menu).toHaveAttribute('open', '');
    await expect(summary).toHaveAttribute(
      'aria-label',
      'Close site navigation',
    );
    await expect(menu.getByRole('link', { name: 'People' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await page.keyboard.press('Escape');
    await expect(menu).not.toHaveAttribute('open', '');
    await expect(summary).toBeFocused();

    await summary.click();
    await page.mouse.click(5, 500);
    await expect(menu).not.toHaveAttribute('open', '');
    await summary.click();
    await menu.getByRole('link', { name: 'About' }).click();
    await expect(page).toHaveURL(/\/about\/$/);
  });

  test('native menu remains usable without JavaScript', async ({ browser }) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await page.goto('/');
    const menu = page.locator('[data-mobile-nav]');
    await menu.locator('summary').click();
    await expect(menu).toHaveAttribute('open', '');
    await expect(menu.getByRole('link', { name: 'People' })).toBeVisible();
    await context.close();
  });

  test('homepage prioritizes programme and mobile copy order', async ({
    page,
  }) => {
    await stabilizePage(page);
    await page.goto('/');
    const order = await page.evaluate(() => {
      const programme = document.querySelector('#programme');
      const preview = document.querySelector('#speaker-preview');
      const copy = document.querySelector('.hero__copy');
      const mark = document.querySelector('.hero__mark');
      return {
        programmeBeforePreview: Boolean(
          programme &&
          preview &&
          programme.compareDocumentPosition(preview) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        ),
        copyBeforeMark: Boolean(
          copy &&
          mark &&
          copy.compareDocumentPosition(mark) & Node.DOCUMENT_POSITION_FOLLOWING,
        ),
      };
    });
    expect(order.programmeBeforePreview).toBe(true);
    expect(order.copyBeforeMark).toBe(true);

    const programmeTabs = page.getByRole('tablist', { name: 'VGZT seasons' });
    await programmeTabs.scrollIntoViewIfNeeded();
    expect(
      await programmeTabs.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        const center = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );
        return center === node || node.contains(center);
      }),
    ).toBe(true);
  });
});

test.describe('programme, event rail and timezone', () => {
  test('season tabs expose complete ARIA and keyboard state', async ({
    page,
  }) => {
    await stabilizePage(page);
    await page.goto('/?season=invalid#programme');
    const tabs = page
      .getByRole('tablist', { name: 'VGZT seasons' })
      .getByRole('tab');
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
    const firstControls = await tabs.first().getAttribute('aria-controls');
    await expect(page.locator(`#${firstControls}`)).toHaveAttribute(
      'role',
      'tabpanel',
    );

    await tabs.first().focus();
    await page.keyboard.press('End');
    await expect(tabs.last()).toBeFocused();
    await expect(tabs.last()).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(/season=season-07/);
    await page.keyboard.press('Home');
    await expect(tabs.first()).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(tabs.last()).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(tabs.first()).toBeFocused();
  });

  test('archive pauses after focus until explicit Play', async ({ page }) => {
    await page.clock.install();
    await stabilizePage(page);
    await page.goto('/?season=season-07#programme');
    const archive = page.locator(
      '[data-schedule][data-archive-autoplay="true"]',
    );
    const playback = archive.locator('[data-archive-playback]');
    const selected = () =>
      archive
        .locator('[data-event-tab][aria-selected="true"]')
        .getAttribute('data-event-id');

    await expect(playback).toHaveText('Pause');
    const before = await selected();
    await page.clock.fastForward(5_100);
    expect(await selected()).not.toBe(before);
    await archive.locator('[data-event-tab][aria-selected="true"]').focus();
    await expect(playback).toHaveText('Play');
    const paused = await selected();
    await page.locator('.site-header__brand').focus();
    await page.clock.fastForward(10_100);
    expect(await selected()).toBe(paused);
    await playback.click();
    await expect(playback).toHaveText('Pause');
    await page.clock.fastForward(5_100);
    expect(await selected()).not.toBe(paused);
    await expect(
      archive.locator('.season-rail-shell__controls button').first(),
    ).toHaveAttribute('data-archive-playback', '');
  });

  test('reduced motion disables archive rotation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await stabilizePage(page);
    await page.goto('/?season=season-07#programme');
    const playback = page.locator(
      '[data-schedule][data-archive-autoplay="true"] [data-archive-playback]',
    );
    await expect(playback).toBeDisabled();
    await expect(playback).toHaveText('Motion off');
  });

  test('event detail timezone updates every local field and persists', async ({
    page,
  }) => {
    await stabilizePage(page);
    await page.goto(eventRoute);
    const select = page.locator('[data-timezone-select]');
    const instant = await page
      .locator('[data-local-date]')
      .getAttribute('data-local-date');
    expect(instant).toBeTruthy();
    await select.selectOption('Asia/Tokyo');
    await expect(select).toHaveValue('Asia/Tokyo');
    await expect(page.locator('[data-local-zone]')).toContainText(
      /Tokyo|Japan|GMT\+9/i,
    );
    const expectedTokyo = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Tokyo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(instant!));
    await expect(page.locator('[data-local-time]')).toContainText(
      expectedTokyo,
    );
    await page.reload();
    await expect(select).toHaveValue('Asia/Tokyo');
    await page.locator('[data-timezone-reset]').click();
    await expect(select).toHaveValue('auto');
  });

  test('month rollover and throwing storage fail safely', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new Error('storage unavailable');
        },
      });
    });
    const page = await context.newPage();
    await page.goto(eventRoute);
    await expect(page.locator('[data-schedule]')).toHaveAttribute(
      'data-schedule-ready',
      'true',
    );
    await page.locator('[data-schedule]').evaluate((schedule) => {
      const fixture = document.createElement('span');
      fixture.dataset.rolloverFixture = '';
      fixture.dataset.instant = '2026-01-01T00:30:00.000Z';
      fixture.innerHTML =
        '<b data-local-month></b><b data-local-day></b><b data-local-weekday></b><b data-local-time></b>';
      schedule.append(fixture);
    });
    await page
      .locator('[data-timezone-select]')
      .selectOption('America/New_York');
    const fixture = page.locator('[data-rollover-fixture]');
    await expect(fixture.locator('[data-local-month]')).toHaveText('Dec');
    await expect(fixture.locator('[data-local-day]')).toHaveText('31');
    await expect(fixture.locator('[data-local-weekday]')).toHaveText('Wed');
    await context.close();
  });
});

test.describe('abstract, people and forms', () => {
  test('abstract sections, TOC and frozen destinations stay aligned', async ({
    page,
  }, testInfo) => {
    await stabilizePage(page);
    await page.goto('/abstracts/');
    const toc = page.locator('[data-section-nav]');
    const hrefs = await toc
      .locator('a')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')!));
    const positions = await page.evaluate(
      (ids) =>
        ids.map(
          (id) => document.querySelector(id)?.getBoundingClientRect().top,
        ),
      hrefs,
    );
    expect([...positions].sort((a, b) => Number(a) - Number(b))).toEqual(
      positions,
    );
    const order = await page
      .locator('.abstracts-copy > section')
      .evaluateAll((sections) => sections.map((section) => section.id));
    expect(order.indexOf('early-career-awards')).toBe(
      order.indexOf('seminar-format') + 1,
    );
    expect(order.indexOf('matching')).toBe(
      order.indexOf('early-career-awards') + 1,
    );

    if (testInfo.project.name.startsWith('mobile')) {
      const disclosure = page.locator('[data-abstracts-toc]');
      await expect(disclosure).not.toHaveAttribute('open', '');
      await disclosure.locator('summary').focus();
      await page.keyboard.press('Enter');
      await expect(disclosure).toHaveAttribute('open', '');
    }

    const submitLink = page
      .getByRole('link', { name: 'Submit abstract', exact: true })
      .first();
    await submitLink.click();
    await expect(page).toHaveURL(/#submit$/);
    await expect(page.locator('#submit')).toBeInViewport();
    const frame = page.locator('[data-external-form-frame]');
    const external = page.getByRole('link', {
      name: /open form in a new tab/i,
    });
    const externalHref = await external.getAttribute('href');
    expect(externalHref).not.toBeNull();
    expect(externalHref).toBe('https://forms.cloud.microsoft/e/T5xbTx7YEP');
    await expect(frame).toHaveAttribute(
      'src',
      /\/Pages\/ResponsePage\.aspx\?.*embed=true$/,
    );
    await expect(external).toBeVisible();
    await page.locator('#submit').scrollIntoViewIfNeeded();
    await expect(
      page.locator(
        '[data-persistent-desktop-actions]:visible, [data-persistent-mobile-actions]:visible',
      ),
    ).toBeVisible();
  });

  test('people filters combine, normalize accents and restore URL state', async ({
    page,
  }) => {
    await stabilizePage(page);
    await page.goto('/people/?view=organizers&season=season-07&q=keyu');
    const tabs = page
      .getByRole('tablist', { name: 'People views' })
      .getByRole('tab');
    await expect(tabs.last()).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-season-filter]')).toHaveValue('season-07');
    await expect(page.locator('[data-people-search]')).toHaveValue('keyu');
    await expect(page.locator('[data-people-result]')).toContainText(
      'organizers shown',
    );
    await tabs.last().focus();
    await page.keyboard.press('Home');
    await expect(tabs.first()).toBeFocused();
    await page.keyboard.press('End');
    await expect(tabs.last()).toBeFocused();

    await tabs.first().click();
    await page.locator('[data-season-filter]').selectOption('all');
    await page.locator('[data-people-search]').fill('benoit');
    await expect(
      page.locator('[data-speaker-card]:visible').first(),
    ).toContainText(/Beno.t/i);
    await page.locator('[data-people-search]').fill('zzzz-no-person');
    await expect(page.locator('[data-people-no-match]')).toBeVisible();

    await page.goto('/people/?view=organizers&season=season-07&q=keyu');
    await page.goto('/people/?q=benoit');
    await page.goBack();
    await expect(tabs.last()).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-season-filter]')).toHaveValue('season-07');
    await expect(page.locator('[data-people-search]')).toHaveValue('keyu');
  });

  test('Subscribe sends one email, two choices and one Turnstile token', async ({
    page,
  }) => {
    await mockJoinFlow(page);
    await stabilizePage(page);
    await page.goto('/subscribe/');
    const form = page.locator('[data-join-form]');
    const submit = form.locator('[data-join-submit]');

    await expect(form.locator('input[type="email"]')).toHaveCount(1);
    await expect(form.locator('input[type="checkbox"]')).toHaveCount(2);
    await expect(form.locator('#join-mailing-list')).not.toBeChecked();
    await expect(form.locator('#join-slack')).not.toBeChecked();
    await expect(form.locator('[data-turnstile-mock]')).toHaveCount(1);
    await expect(form.locator('#join-name')).toHaveCount(0);
    await expect(form.locator('#join-organization')).toHaveCount(0);
    await expect(form.locator('#join-career-stage')).toHaveCount(0);
    await expect(form.locator('#join-slack-email')).toHaveCount(0);
    await expect(form.locator('#join-privacy')).toHaveCount(0);

    await submit.click();
    await expect(form.locator('#join-services-error')).not.toBeEmpty();
    await expect(form.locator('[data-subscription-result]')).toBeHidden();

    await form.locator('#join-email').fill('test@example.org');
    await form.locator('#join-mailing-list').check();
    await form.locator('#join-slack').check();
    await submit.click();
    await expect(form.locator('[data-subscription-result]')).toBeVisible();
    await expect(form.locator('[data-mailing-list-message]')).toHaveText(
      'Check your inbox to confirm your VGZT Talks subscription.',
    );
    await expect(form.locator('[data-slack-action]')).toBeVisible();
    await expect(form.locator('[data-join-fields]')).toBeHidden();
    expect(
      await page.evaluate(() => Reflect.get(window, '__joinRequests')),
    ).toEqual([
      {
        email: 'test@example.org',
        joinMailingList: true,
        joinSlack: true,
        website: '',
        turnstileToken: 'test-turnstile-token',
      },
    ]);
    expect(
      await page.evaluate(() =>
        Number(Reflect.get(window, '__turnstileRenderCount')),
      ),
    ).toBe(1);
    await expect(page.locator('script[src*="eomail5"]')).toHaveCount(0);
    await expect(form).not.toHaveAttribute('data-slack-url', /.+/);
  });

  test('Subscribe renders the mailing-list-only confirmation state', async ({
    page,
  }) => {
    await mockJoinFlow(page, {
      ok: true,
      requestId: 'mailing-only',
      mailingList: { requested: true, state: 'confirmation-required' },
      slack: { requested: false },
    });
    await stabilizePage(page);
    await page.goto('/subscribe/');
    const form = page.locator('[data-join-form]');
    await form.locator('#join-email').fill('test@example.org');
    await form.locator('#join-mailing-list').check();
    await form.locator('[data-join-submit]').click();

    await expect(form.locator('[data-result-title]')).toHaveText(
      "You're almost there.",
    );
    await expect(form.locator('[data-mailing-list-support]')).toHaveText(
      "We've sent a confirmation email to the address you provided.",
    );
    await expect(form.locator('[data-slack-result]')).toBeHidden();
  });

  test('Subscribe no-JS state exposes no gated provider link', async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/subscribe/');
    await expect(page.locator('[data-slack-action]')).toBeHidden();
    await expect(page.locator('[data-join-submit]')).toBeDisabled();
    await expect(
      page.getByRole('link', { name: /organizers@vgzt.org/i }).first(),
    ).toBeVisible();
    await context.close();
  });

  test('contact validation and provider failure retain input and focus recovery', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Reflect.set(window, 'turnstile', {
        render: (
          _container: HTMLElement,
          options: { callback: (token: string) => void },
        ) => {
          options.callback('test-token');
          return 'test-widget';
        },
        reset: () => undefined,
      });
    });
    await stabilizePage(page);
    await page.route('https://api.vgzt.org/contact', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: '{"message":"Unavailable"}',
      }),
    );
    await page.goto('/contact/');
    const form = page.locator('[data-contact-form]');
    await form.getByRole('button', { name: /Send message/ }).click();
    await expect(form.locator('#contact-name')).toBeFocused();
    await form.locator('#contact-name').fill('Test Researcher');
    await form.locator('#contact-email').fill('test@example.org');
    await form
      .locator('#contact-message')
      .fill('A test message with enough content.');
    await form.locator('#contact-privacy').check();
    await form.getByRole('button', { name: /Send message/ }).click();
    await expect(form.locator('[data-form-status]')).toContainText(
      'Unavailable',
    );
    await expect(form.locator('[data-form-status]')).toBeFocused();
    await expect(form.locator('#contact-message')).toHaveValue(
      'A test message with enough content.',
    );
    await expect(
      form.getByRole('button', { name: /Send message/ }),
    ).toBeEnabled();
  });
});

test('poster dialog is keyboard-safe and uncropped', async ({ page }) => {
  await stabilizePage(page);
  await page.goto(eventRoute);
  const trigger = page.locator('[data-poster-open]');
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.locator('[data-poster-dialog]');
  await expect(dialog).toHaveAttribute('open', '');
  await expect(dialog.locator('[data-poster-close]')).toBeFocused();
  await expect(dialog.locator('img')).toHaveCSS('object-fit', 'contain');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toHaveAttribute('open', '');
  await expect(trigger).toBeFocused();
});
