const { test, expect } = require('@playwright/test');

async function openSynced(page) {
  await page.goto('/');
}

test('a vote appears in another open tab without a reload', async ({ context, page }) => {
  await openSynced(page);
  const second = await context.newPage();
  await openSynced(second);

  await page.getByRole('button', { name: 'Pick Popcorn' }).click();
  await expect(second.getByRole('status')).toHaveText('Your vote for Popcorn is saved.');
  await expect(second.getByRole('listitem').filter({ hasText: 'Popcorn' }).locator('.score strong')).toHaveText('1');
  await expect(second.getByRole('listitem').filter({ hasText: 'Popcorn' }).getByText('Your pick')).toBeVisible();
  await expect(second.getByRole('button', { name: 'Pick Pretzels' })).toBeDisabled();
});

test('removing saved data updates the open scoreboard and a later tab', async ({ context, page }) => {
  await openSynced(page);
  await page.getByRole('button', { name: 'Pick Pretzels' }).click();
  await expect(page.getByRole('status')).toContainText('Pretzels');
  const second = await context.newPage();
  await openSynced(second);
  await expect(second.getByRole('status')).toContainText('Pretzels');

  await second.evaluate(() => localStorage.removeItem('snack-court-scoreboard'));
  await expect(page.getByRole('status')).toHaveText('Your browser has not voted yet.');
  await expect(page.getByRole('listitem').filter({ hasText: 'Pretzels' }).locator('.score strong')).toHaveText('0');
  await expect(page.getByRole('button', { name: 'Pick Pretzels' })).toBeEnabled();

  const third = await context.newPage();
  await openSynced(third);
  await expect(third.getByRole('status')).toHaveText('Your browser has not voted yet.');
});

test('malformed external data blocks voting without presenting a stale result as saved', async ({ context, page }) => {
  await openSynced(page);
  await page.getByRole('button', { name: 'Pick Popcorn' }).click();
  await expect(page.getByRole('status')).toContainText('Popcorn');
  const second = await context.newPage();
  await openSynced(second);
  await second.evaluate(() => localStorage.setItem('snack-court-scoreboard', '{broken'));

  await expect(page.getByRole('status')).toContainText('unreadable or inconsistent');
  await expect(page.getByRole('button', { name: 'Pick Popcorn' })).toBeDisabled();
  await expect(page.getByRole('listitem').filter({ hasText: 'Popcorn' }).locator('.score strong')).not.toHaveText('1');
  await expect(page.locator('.chosen:visible')).toHaveCount(0);
  expect(await second.evaluate(() => localStorage.getItem('snack-court-scoreboard'))).toBe('{broken');

  await second.evaluate(() => localStorage.removeItem('snack-court-scoreboard'));
  await expect(page.getByRole('status')).toContainText('has not voted');
  await expect(page.getByRole('button', { name: 'Pick Popcorn' })).toBeEnabled();
  await second.evaluate(() => localStorage.setItem('snack-court-scoreboard', JSON.stringify({
    choice: 'pretzels', totals: { chips: 0, popcorn: 0, pretzels: 1 },
  })));
  await expect(page.getByRole('status')).toContainText('Pretzels');
  await expect(page.getByRole('button', { name: 'Pick Popcorn' })).toBeDisabled();
  await expect(page.getByRole('listitem').filter({ hasText: 'Pretzels' }).locator('.score strong')).toHaveText('1');
});

test('simultaneous votes converge on the one saved result', async ({ context, page }) => {
  await openSynced(page);
  const second = await context.newPage();
  await openSynced(second);
  await Promise.all([
    page.getByRole('button', { name: 'Pick Potato chips' }).click(),
    second.getByRole('button', { name: 'Pick Pretzels' }).click(),
  ]);
  await expect(page.getByRole('status')).toContainText('is saved');
  await expect(second.getByRole('status')).toHaveText(await page.getByRole('status').textContent());
  const third = await context.newPage();
  await openSynced(third);
  await expect(third.getByRole('status')).toHaveText(await page.getByRole('status').textContent());
  expect((await third.locator('.score strong').allTextContents()).sort()).toEqual(['0', '0', '1']);
  await expect(page.getByRole('button', { name: 'Pick Popcorn' })).toBeDisabled();
  await expect(second.getByRole('button', { name: 'Pick Popcorn' })).toBeDisabled();
});

test('storage changes cannot enable a ballot while a vote waits for coordination', async ({ context, page }) => {
  await openSynced(page);
  const second = await context.newPage();
  await openSynced(second);
  await second.evaluate(() => new Promise(resolve => {
    navigator.locks.request('snack-court-scoreboard', async () => {
      resolve();
      await new Promise(release => { window.releaseTestLock = release; });
    });
  }));
  await page.getByRole('button', { name: 'Pick Popcorn' }).click();
  await second.evaluate(() => localStorage.setItem('snack-court-scoreboard', JSON.stringify({
    choice: 'pretzels', totals: { chips: 0, popcorn: 0, pretzels: 1 },
  })));
  await expect(page.getByRole('status')).toContainText('Pretzels');
  await second.evaluate(() => localStorage.clear());
  await expect(page.getByRole('status')).toHaveText('Your browser has not voted yet.');
  await expect(page.getByRole('button', { name: 'Pick Potato chips' })).toBeDisabled();
  await second.evaluate(() => window.releaseTestLock());
  await expect(page.getByRole('status')).toContainText('Popcorn');
  await expect(second.getByRole('status')).toContainText('Popcorn');
});

test('a storage read failure hides stale results and remains blocked after a later change', async ({ context, page }) => {
  await openSynced(page);
  await page.getByRole('button', { name: 'Pick Popcorn' }).click();
  await expect(page.getByRole('status')).toContainText('Popcorn');
  const second = await context.newPage();
  await openSynced(second);
  await page.evaluate(() => {
    window.originalGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = () => { throw new DOMException('blocked', 'SecurityError'); };
  });
  await second.evaluate(() => localStorage.removeItem('snack-court-scoreboard'));
  await expect(page.getByRole('status')).toContainText('storage');
  await expect(page.locator('.score strong')).toHaveText(['—', '—', '—']);
  await expect(page.locator('.chosen:visible')).toHaveCount(0);
  await page.evaluate(() => { Storage.prototype.getItem = window.originalGetItem; });
  await second.evaluate(() => localStorage.setItem('snack-court-scoreboard', JSON.stringify({
    choice: null, totals: { chips: 0, popcorn: 0, pretzels: 0 },
  })));
  await expect(page.getByRole('status')).toContainText('storage');
  await expect(page.getByRole('button', { name: 'Pick Popcorn' })).toBeDisabled();
});

test('a failed storage update cannot leave a pending vote to be saved after the failure', async ({ context, page }) => {
  await openSynced(page);
  const second = await context.newPage();
  await openSynced(second);
  await second.evaluate(() => new Promise(resolve => {
    navigator.locks.request('snack-court-scoreboard', async () => {
      resolve();
      await new Promise(release => { window.releaseTestLock = release; });
    });
  }));
  await page.getByRole('button', { name: 'Pick Popcorn' }).click();
  await second.evaluate(() => localStorage.setItem('snack-court-scoreboard', '{broken'));
  await expect(page.getByRole('status')).toContainText('unreadable or inconsistent');
  await expect(page.getByRole('button', { name: /reset/i })).toBeDisabled();
  await second.evaluate(() => localStorage.removeItem('snack-court-scoreboard'));
  await second.evaluate(() => window.releaseTestLock());
  await second.evaluate(() => navigator.locks.request('snack-court-scoreboard', () => {}));
  await expect(page.getByRole('status')).toContainText('unreadable or inconsistent');
  await expect(page.getByRole('button', { name: /reset/i })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Pick Popcorn' })).toBeDisabled();
  await expect(second.getByRole('status')).not.toContainText('is saved');
  expect(await second.evaluate(() => localStorage.getItem('snack-court-scoreboard'))).toBeNull();
});
