'use strict';

window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  try {
    if (event.storageArea !== localStorage || (blocked && (!invalidRecord || busy))) return;
    const record = readRecord();
    if (blocked) {
      if (!navigator.locks || typeof navigator.locks.request !== 'function') throw new CoordinationError();
      blocked = false;
      invalidRecord = false;
    }
    render(record);
  } catch (error) {
    fail(error);
    for (const row of document.querySelectorAll('[data-snack]')) {
      row.querySelector('.score strong').textContent = '—';
      row.querySelector('.chosen').hidden = true;
    }
  }
});
