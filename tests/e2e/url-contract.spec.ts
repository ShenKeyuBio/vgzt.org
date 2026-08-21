import { expect, test } from '@playwright/test';
import { stabilizePage } from './helpers';

const abstractFormUrl =
  'https://forms.cloud.microsoft/Pages/ResponsePage.aspx?id=B3jtTq3rWkGnqZFwlH9OrscM_7z6UFVOiVCj04ix33hURVdFWDhBUUJPNzY3MUxWRVRBUzRHTU9QVi4u&embed=true';
const slackInviteUrl =
  'https://join.slack.com/t/gastrulationseminars/shared_invite/zt-3ygitwchd-AD29YjXgMZ7Md~RpDggsww';

test.beforeEach(async ({ page }) => stabilizePage(page));

test('printed Abstract URL contract remains exact', async ({ page }) => {
  const response = await page.goto('/abstracts/');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/abstracts\/$/);
  await expect(page.locator('h1')).toHaveText('Share your science with VGZT.');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://vgzt.org/abstracts/',
  );
  await expect(page.locator('#submit iframe')).toHaveAttribute(
    'src',
    abstractFormUrl,
  );
  await expect(page.locator('#submit a[target="_blank"]')).toHaveAttribute(
    'href',
    abstractFormUrl,
  );
});

test('printed Subscribe URL and gated destinations remain exact', async ({
  page,
}) => {
  const response = await page.goto('/subscribe/');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/subscribe\/$/);
  await expect(page.locator('h1')).toHaveText('Stay connected with VGZT.');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://vgzt.org/subscribe/',
  );
  await expect(page.locator('[data-join-form]')).toHaveAttribute(
    'action',
    '/subscribe/',
  );
  await expect(page.locator('[data-slack-action]')).toHaveAttribute(
    'href',
    slackInviteUrl,
  );
  await expect(page.locator('[data-subscription-result]')).toBeHidden();
});
