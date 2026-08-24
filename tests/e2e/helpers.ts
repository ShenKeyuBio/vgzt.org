import { expect, type Page } from '@playwright/test';
import { readdirSync } from 'node:fs';

const eventSlug = readdirSync('dist/events', { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()[0];

if (!eventSlug) throw new Error('No generated event route was found in dist.');

export const eventRoute = `/events/${eventSlug}/`;
export const calendarRoute = `${eventRoute}calendar.ics`;
export const htmlRoutes = [
  '/',
  '/abstracts/',
  '/people/',
  '/opportunities/',
  '/subscribe/',
  '/contact/',
  '/about/',
  '/privacy/',
  '/guaranteed-missing-route/',
  eventRoute,
] as const;

const thirdPartyHosts = [
  'forms.cloud.microsoft',
  'forms.office.com',
  'challenges.cloudflare.com',
  'eomail',
  'emailoctopus',
  'join.slack.com',
];

export async function stabilizePage(page: Page, visual = false) {
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (!thirdPartyHosts.some((host) => url.includes(host))) {
      await route.continue();
      return;
    }

    if (visual && /forms\.(cloud\.microsoft|office)\.com/.test(url)) {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><html><body style="margin:0;background:#123f9f;color:#fff;font:700 20px system-ui;display:grid;min-height:100vh;place-items:center"><p>External form preview</p></body></html>',
      });
      return;
    }

    await route.abort();
  });
}

export async function waitForStableLayout(page: Page) {
  await page.evaluate(async () => {
    await document.fonts?.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
}

export interface MockJoinResponse {
  ok: true;
  requestId: string;
  mailingList:
    | { requested: false }
    | {
        requested: true;
        state:
          'confirmation-required' | 'already-known' | 'temporarily-unavailable';
      };
  slack:
    | { requested: false }
    | { requested: true; inviteUrl: string }
    | { requested: true; state: 'temporarily-unavailable' };
}

export async function mockJoinFlow(
  page: Page,
  response: MockJoinResponse = {
    ok: true,
    requestId: 'test-request',
    mailingList: { requested: true, state: 'confirmation-required' },
    slack: {
      requested: true,
      inviteUrl: 'https://join.slack.com/t/example/shared_invite/test',
    },
  },
) {
  await page.addInitScript((apiResponse) => {
    const nativeFetch = window.fetch.bind(window);
    Reflect.set(window, '__joinRequests', []);
    Reflect.set(window, '__turnstileRenderCount', 0);
    Reflect.set(window, 'turnstile', {
      render: (
        container: HTMLElement,
        options: { callback: (token: string) => void },
      ) => {
        const count = Number(
          Reflect.get(window, '__turnstileRenderCount') || 0,
        );
        Reflect.set(window, '__turnstileRenderCount', count + 1);
        const mock = document.createElement('div');
        mock.dataset.turnstileMock = '';
        mock.textContent = 'Verification complete';
        mock.style.cssText =
          'display:grid;min-height:65px;width:100%;border:2px solid #151515;background:#fff;place-items:center;font-weight:800;';
        container.append(mock);
        options.callback('test-turnstile-token');
        return 'test-widget';
      },
      reset: () => undefined,
    });
    Reflect.set(
      window,
      'fetch',
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : String(input);
        if (url === 'https://api.vgzt.org/join') {
          const requests = Reflect.get(window, '__joinRequests') as unknown[];
          requests.push(JSON.parse(String(init?.body || '{}')));
          return new Response(JSON.stringify(apiResponse), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        return nativeFetch(input, init);
      },
    );
  }, response);
}

export async function expectBasicPageIntegrity(page: Page) {
  await expect(page.locator('main:visible')).toHaveCount(1);
  await expect(page.locator('h1:visible')).toHaveCount(1);
  await expect(page.locator('body')).not.toContainText(
    /Internal Server Error|Unhandled Runtime Error|Application error/i,
  );

  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);

  expect(
    await page.evaluate(() => {
      const ids = [...document.querySelectorAll<HTMLElement>('[id]')].map(
        (node) => node.id,
      );
      return ids.length === new Set(ids).size;
    }),
  ).toBe(true);
}

export async function expectFocusNotObscured(page: Page) {
  expect(
    await page.evaluate(() => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement)) return false;
      const rect = active.getBoundingClientRect();
      if (
        rect.bottom <= 0 ||
        rect.top >= innerHeight ||
        rect.right <= 0 ||
        rect.left >= innerWidth
      ) {
        return false;
      }
      const pointX = Math.min(
        innerWidth - 1,
        Math.max(0, rect.left + Math.min(rect.width / 2, 20)),
      );
      const pointY = Math.min(
        innerHeight - 1,
        Math.max(0, rect.top + Math.min(rect.height / 2, 20)),
      );
      const top = document.elementFromPoint(pointX, pointY);
      return Boolean(
        top && (top === active || active.contains(top) || top.contains(active)),
      );
    }),
  ).toBe(true);
}
