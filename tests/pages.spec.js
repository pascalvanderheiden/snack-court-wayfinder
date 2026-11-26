const { test, expect } = require('@playwright/test');
const path = require('node:path');

test('the deployed scoreboard works beneath a GitHub Pages project path', async ({ page }) => {
  const prefix = '/snack-court-wayfinder/';
  const files = {
    '': 'index.html',
    'app.js': 'app.js',
    'tab-sync.js': 'tab-sync.js',
    'style.css': 'style.css',
  };
  await page.route('**/*', route => {
    const pathname = new URL(route.request().url()).pathname;
    const file = pathname.startsWith(prefix) && files[pathname.slice(prefix.length)];
    if (!file) return route.abort();
    return route.fulfill({ path: path.join(__dirname, '..', file) });
  });

  await page.goto(prefix);
  await expect(page.getByRole('heading', { name: 'The scoreboard.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pick Popcorn' })).toBeEnabled();
  await expect(page.locator('.brand')).toHaveAttribute('href', './');
  await page.getByRole('button', { name: 'Pick Popcorn' }).click();
  await expect(page.getByRole('status')).toContainText('Your vote for Popcorn is saved.');
  await page.reload();
  await expect(page.getByRole('status')).toContainText('Your vote for Popcorn is saved.');
});
