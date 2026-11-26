const { test, expect } = require('@playwright/test');

test('a fresh browser can save a vote and restore it after reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'The scoreboard.' })).toBeVisible();
  await page.getByRole('button', { name: 'Pick Popcorn' }).click();
  await expect(page.getByRole('status')).toContainText('Popcorn');
  await expect(page.getByRole('listitem').filter({ hasText: 'Popcorn' })).toContainText('1');
  await page.reload();
  await expect(page.getByRole('status')).toContainText('Popcorn');
  await expect(page.getByRole('button', { name: 'Pick Pretzels' })).toBeDisabled();
});

for (const snack of ['Potato chips', 'Popcorn', 'Pretzels']) {
  test(`one ${snack} choice is saved despite repeated clicks`, async ({ page }) => {
    await page.goto('/');
    const pick = page.getByRole('button', { name: `Pick ${snack}` });
    await pick.dblclick({ force: true });
    await expect(page.getByRole('status')).toContainText(`Your vote for ${snack} is saved`);
    await expect(page.getByRole('listitem').filter({ hasText: snack })).toContainText('1');
    await expect(pick).toBeDisabled();
    await page.reload();
    await expect(page.getByRole('status')).toContainText(snack);
    await expect(page.getByRole('listitem').filter({ hasText: snack })).toContainText('1');
  });
}

test('simultaneous tabs accept only one vote, and a new tab restores it', async ({ context, page }) => {
  await page.goto('/');
  const second = await context.newPage();
  await second.goto('/');
  await Promise.all([
    page.getByRole('button', { name: 'Pick Potato chips' }).click(),
    second.getByRole('button', { name: 'Pick Pretzels' }).click(),
  ]);
  await expect(page.getByRole('status')).toContainText('is saved');
  await expect(second.getByRole('status')).toHaveText(await page.getByRole('status').textContent());
  const third = await context.newPage();
  await third.goto('/');
  await expect(third.getByRole('status')).toHaveText(await page.getByRole('status').textContent());
  const scores = await third.locator('.score strong').allTextContents();
  expect(scores.filter(score => score === '1')).toHaveLength(1);
  expect(scores.filter(score => score === '0')).toHaveLength(2);
});

test('a failed coordination request disables voting with an explanation', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.locks.request = () => Promise.reject(new Error('lock failure'));
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Pick Popcorn' }).click();
  await expect(page.getByRole('status')).toContainText('coordination');
  await expect(page.getByRole('button', { name: 'Pick Popcorn' })).toBeDisabled();
  await expect(page.getByRole('listitem').filter({ hasText: 'Popcorn' })).toContainText('0');
});

test('a damaged record appearing after load is not overwritten by a vote', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('snack-court-scoreboard', 'damaged'));
  await page.getByRole('button', { name: 'Pick Popcorn' }).click();
  await expect(page.getByRole('status')).toContainText('unreadable or inconsistent');
  await expect(page.getByRole('button', { name: 'Pick Popcorn' })).toBeDisabled();
  expect(await page.evaluate(() => localStorage.getItem('snack-court-scoreboard'))).toBe('damaged');
});
test('missing safe coordination disables voting before a choice', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'locks', { value: undefined }));
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('coordination');
  await expect(page.getByRole('button', { name: 'Pick Popcorn' })).toBeDisabled();
});

test('blocked storage fails closed', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException('blocked', 'SecurityError'); };
  });
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('storage');
  await expect(page.getByRole('button', { name: 'Pick Popcorn' })).toBeDisabled();
});

test('failed write does not claim or display a saved vote', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Pick Popcorn' }).click();
  await expect(page.getByRole('status')).toContainText('could not be saved');
  await expect(page.getByRole('listitem').filter({ hasText: 'Popcorn' })).toContainText('0');
  await expect(page.getByRole('button', { name: 'Pick Pretzels' })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('status')).toContainText('has not voted');
});

for (const raw of [
  '{not json',
  JSON.stringify({ choice: 'popcorn', totals: { chips: 1, popcorn: 1, pretzels: 0 } }),
  JSON.stringify({ choice: ['popcorn'], totals: { chips: 0, popcorn: 0, pretzels: 0 } }),
]) {
  test(`invalid stored record fails closed without being overwritten: ${raw}`, async ({ page }) => {
    await page.addInitScript(value => localStorage.setItem('snack-court-scoreboard', value), raw);
    await page.goto('/');
    await expect(page.getByRole('status')).toContainText('unreadable or inconsistent');
    await expect(page.getByRole('button', { name: 'Pick Popcorn' })).toBeDisabled();
    expect(await page.evaluate(() => localStorage.getItem('snack-court-scoreboard'))).toBe(raw);
  });
}

test('saved vote survives a new browser session with retained storage', async ({ browser }) => {
  const first = await browser.newContext();
  const page = await first.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'Pick Pretzels' }).click();
  await expect(page.getByRole('status')).toContainText('Pretzels');
  const storageState = await first.storageState();
  await first.close();
  const next = await browser.newContext({ storageState });
  const returned = await next.newPage();
  await returned.goto('/');
  await expect(returned.getByRole('status')).toContainText('Pretzels');
  await expect(returned.getByRole('button', { name: 'Pick Potato chips' })).toBeDisabled();
  await next.close();
});

test('keyboard voting works on a narrow screen without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Pick Potato chips' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('Potato chips');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
