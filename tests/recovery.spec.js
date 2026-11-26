const { test, expect } = require('@playwright/test');

test('a visitor deliberately resets an unreadable scoreboard and can vote', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('snack-court-scoreboard', '{broken'));
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('unreadable or inconsistent');
  await expect(page.getByRole('button', { name: 'Pick Popcorn' })).toBeDisabled();
  expect(await page.evaluate(() => localStorage.getItem('snack-court-scoreboard'))).toBe('{broken');
  await page.getByRole('button', { name: 'Reset unreadable scoreboard' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('has not voted');
  await page.getByRole('button', { name: 'Pick Popcorn' }).click();
  await expect(page.getByRole('status')).toContainText('Your vote for Popcorn is saved');
});

test('retry restores voting after blocked storage becomes available', async ({ page }) => {
  await page.addInitScript(() => {
    const getItem = Storage.prototype.getItem;
    window.storageBlocked = true;
    Storage.prototype.getItem = function (key) {
      if (window.storageBlocked) throw new DOMException('blocked', 'SecurityError');
      return getItem.call(this, key);
    };
  });

  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('storage');
  await expect(page.getByRole('button', { name: 'Pick Popcorn' })).toBeDisabled();
  await page.evaluate(() => { window.storageBlocked = false; });
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('status')).toContainText('has not voted');
  await page.getByRole('button', { name: 'Pick Popcorn' }).click();
  await expect(page.getByRole('status')).toContainText('Your vote for Popcorn is saved');
});

test('a storage error named invalid never offers to erase a valid vote', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('snack-court-scoreboard', JSON.stringify({
      choice: 'popcorn', totals: { chips: 0, popcorn: 1, pretzels: 0 },
    }));
    Storage.prototype.getItem = () => { throw new Error('invalid'); };
  });
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('storage');
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset unreadable scoreboard' })).toBeHidden();
});

test('a failed reset read cannot erase a vote saved since the error appeared', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('snack-court-scoreboard', '{broken'));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Reset unreadable scoreboard' })).toBeVisible();
  await page.evaluate(() => {
    localStorage.setItem('snack-court-scoreboard', JSON.stringify({
      choice: 'pretzels', totals: { chips: 0, popcorn: 0, pretzels: 1 },
    }));
    window.getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = () => { throw new Error('invalid'); };
  });
  await page.getByRole('button', { name: 'Reset unreadable scoreboard' }).click();
  await expect(page.getByRole('status')).toContainText('storage');
  await page.evaluate(() => { Storage.prototype.getItem = window.getItem; });
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('status')).toContainText('Your vote for Pretzels is saved');
  await expect(page.getByRole('button', { name: 'Reset unreadable scoreboard' })).toBeHidden();
});

test('retry after a failed write never reports an unsaved vote', async ({ page }) => {
  await page.addInitScript(() => {
    const setItem = Storage.prototype.setItem;
    window.writeBlocked = true;
    Storage.prototype.setItem = function (key, value) {
      if (window.writeBlocked) throw new DOMException('full', 'QuotaExceededError');
      return setItem.call(this, key, value);
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Pick Popcorn' }).click();
  await expect(page.getByRole('status')).toContainText('could not be saved');
  await expect(page.getByRole('listitem').filter({ hasText: 'Popcorn' })).toContainText('0');
  await page.evaluate(() => { window.writeBlocked = false; });
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('status')).toContainText('has not voted');
  await page.getByRole('button', { name: 'Pick Pretzels' }).click();
  await expect(page.getByRole('status')).toContainText('Your vote for Pretzels is saved');
});

test('retry checks that failed coordination is available again', async ({ page }) => {
  await page.addInitScript(() => {
    const request = navigator.locks.request.bind(navigator.locks);
    window.lockBlocked = true;
    navigator.locks.request = (...args) => window.lockBlocked
      ? Promise.reject(new Error('unavailable'))
      : request(...args);
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Pick Popcorn' }).click();
  await expect(page.getByRole('status')).toContainText('coordination');
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('status')).toContainText('coordination');
  await expect(page.getByRole('button', { name: 'Pick Popcorn' })).toBeDisabled();
  await page.evaluate(() => { window.lockBlocked = false; });
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('status')).toContainText('has not voted');
  await page.getByRole('button', { name: 'Pick Popcorn' }).click();
  await expect(page.getByRole('status')).toContainText('Your vote for Popcorn is saved');
});

test('keyboard retry recovers when initially unavailable coordination returns', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.addInitScript(() => {
    const locks = navigator.locks;
    window.lockBlocked = true;
    Object.defineProperty(navigator, 'locks', { get: () => window.lockBlocked ? undefined : locks });
  });
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('coordination');
  await expect(page.getByRole('button', { name: 'Pick Popcorn' })).toBeDisabled();
  await page.evaluate(() => { window.lockBlocked = false; });
  await page.getByRole('button', { name: 'Retry' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('has not voted');
  await expect(page.getByRole('button', { name: 'Pick Popcorn' })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('reset waits for coordination and preserves a concurrent valid vote', async ({ context, page }) => {
  await page.addInitScript(() => localStorage.setItem('snack-court-scoreboard', '{broken'));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Reset unreadable scoreboard' })).toBeVisible();
  const other = await context.newPage();
  await other.goto('/');
  await other.evaluate(() => {
    window.lockHeld = false;
    window.lockDone = navigator.locks.request('snack-court-scoreboard', async () => {
      window.lockHeld = true;
      await new Promise(resolve => { window.releaseLock = resolve; });
    });
  });
  await expect.poll(() => other.evaluate(() => window.lockHeld)).toBe(true);
  await page.getByRole('button', { name: 'Reset unreadable scoreboard' }).click();
  await expect(page.getByRole('button', { name: 'Reset unreadable scoreboard' })).toBeDisabled();
  await other.evaluate(async () => {
    localStorage.setItem('snack-court-scoreboard', JSON.stringify({
      choice: 'pretzels', totals: { chips: 0, popcorn: 0, pretzels: 1 },
    }));
    window.releaseLock();
    await window.lockDone;
  });
  await expect(page.getByRole('status')).toContainText('Your vote for Pretzels is saved');
  await expect(page.getByRole('button', { name: 'Reset unreadable scoreboard' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Pick Popcorn' })).toBeDisabled();
  await other.reload();
  await expect(other.getByRole('status')).toContainText('Your vote for Pretzels is saved');
});

test('an inconsistent record stays intact when reset fails, then can be recovered', async ({ page }) => {
  const invalid = JSON.stringify({ choice: 'popcorn', totals: { chips: 1, popcorn: 1, pretzels: 0 } });
  await page.addInitScript(value => {
    localStorage.setItem('snack-court-scoreboard', value);
    const removeItem = Storage.prototype.removeItem;
    window.removeBlocked = true;
    Storage.prototype.removeItem = function (key) {
      if (window.removeBlocked) throw new DOMException('blocked', 'SecurityError');
      return removeItem.call(this, key);
    };
  }, invalid);
  await page.goto('/');
  await page.getByRole('button', { name: 'Reset unreadable scoreboard' }).click();
  await expect(page.getByRole('status')).toContainText('storage');
  expect(await page.evaluate(() => localStorage.getItem('snack-court-scoreboard'))).toBe(invalid);
  await page.evaluate(() => { window.removeBlocked = false; });
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('status')).toContainText('unreadable or inconsistent');
  await page.getByRole('button', { name: 'Reset unreadable scoreboard' }).click();
  await expect(page.getByRole('status')).toContainText('has not voted');
});

test('reset does not discard data when coordination fails', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('snack-court-scoreboard', '{broken');
    const request = navigator.locks.request.bind(navigator.locks);
    window.lockBlocked = true;
    navigator.locks.request = (...args) => window.lockBlocked
      ? Promise.reject(new Error('unavailable'))
      : request(...args);
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Reset unreadable scoreboard' }).click();
  await expect(page.getByRole('status')).toContainText('coordination');
  expect(await page.evaluate(() => localStorage.getItem('snack-court-scoreboard'))).toBe('{broken');
  await page.evaluate(() => { window.lockBlocked = false; });
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('status')).toContainText('unreadable or inconsistent');
  await page.getByRole('button', { name: 'Reset unreadable scoreboard' }).click();
  await expect(page.getByRole('status')).toContainText('has not voted');
});

test('another tab resetting an unreadable record restores the open scoreboard', async ({ context, page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('snack-court-scoreboard', '{broken'));
  const second = await context.newPage();
  await second.goto('/');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Reset unreadable scoreboard' })).toBeVisible();
  await second.getByRole('button', { name: 'Reset unreadable scoreboard' }).click();
  await expect(second.getByRole('status')).toContainText('has not voted');
  await expect(page.getByRole('status')).toContainText('has not voted');
  await expect(page.getByRole('button', { name: 'Pick Popcorn' })).toBeEnabled();
  await page.getByRole('button', { name: 'Pick Popcorn' }).click();
  await expect(second.getByRole('status')).toContainText('Your vote for Popcorn is saved');
  await expect(page.getByRole('button', { name: 'Reset unreadable scoreboard' })).toBeHidden();
});

test('recovery waits until a pending vote has stopped after a storage error', async ({ context, page }) => {
  await page.goto('/');
  const other = await context.newPage();
  await other.goto('/');
  await other.evaluate(() => new Promise(resolve => {
    navigator.locks.request('snack-court-scoreboard', async () => {
      resolve();
      await new Promise(release => { window.releaseLock = release; });
    });
  }));
  await page.getByRole('button', { name: 'Pick Popcorn' }).click();
  await other.evaluate(() => localStorage.setItem('snack-court-scoreboard', '{broken'));
  await expect(page.getByRole('status')).toContainText('unreadable or inconsistent');
  await expect(page.getByRole('button', { name: 'Reset unreadable scoreboard' })).toBeDisabled();
  await other.evaluate(() => window.releaseLock());
  await expect(page.getByRole('button', { name: 'Reset unreadable scoreboard' })).toBeEnabled();
  await page.getByRole('button', { name: 'Reset unreadable scoreboard' }).click();
  await expect(page.getByRole('status')).toContainText('has not voted');
});
