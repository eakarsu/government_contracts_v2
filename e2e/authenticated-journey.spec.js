'use strict';

const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

async function signIn(page) {
  await page.goto('/');
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (await page.getByRole('heading', { name: /sign in to your workspace/i }).isVisible().catch(() => false)) {
    test.skip(!email || !password, 'E2E_EMAIL and E2E_PASSWORD are required for local authentication');
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /^sign in$/i }).click();
  }
  await expect(page.getByText('GovContract AI')).toBeVisible();
}

test('authenticated capture workspace is reachable and has no serious accessibility violations', async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole('link', { name: 'RFP Workspace' })).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations.filter(item => ['critical', 'serious'].includes(item.impact))).toEqual([]);
});

test('production-only suite modules follow server feature flags', async ({ page }) => {
  await signIn(page);
  const body = await page.evaluate(async () => {
    const token = localStorage.getItem('auth_token');
    const response = await fetch('/api/config', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    return response.json();
  });
  if (body.features.sportsContracts === false) await expect(page.getByRole('link', { name: 'Sports Contracts' })).toHaveCount(0);
  if (body.features.smartContractAssurance === false) await expect(page.getByRole('link', { name: 'Smart-Contract Assurance' })).toHaveCount(0);
});
