'use strict';

const STORAGE_KEY = 'snack-court-scoreboard';
const LOCK_NAME = 'snack-court-scoreboard';
const names = { chips: 'Potato chips', popcorn: 'Popcorn', pretzels: 'Pretzels' };
const rows = [...document.querySelectorAll('[data-snack]')];
const status = document.querySelector('[role="status"]');
const retryButton = document.querySelector('#retry');
const resetButton = document.querySelector('#reset');
let busy = false;
let blocked = false;
let invalidRecord = false;

class InvalidRecordError extends Error {}
class CoordinationError extends Error {}

function emptyRecord() {
  return { choice: null, totals: { chips: 0, popcorn: 0, pretzels: 0 } };
}

function readRecord() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return emptyRecord();
  let record;
  try {
    record = JSON.parse(raw);
  } catch {
    throw new InvalidRecordError();
  }
  if (!record || typeof record !== 'object' || !record.totals ||
      typeof record.totals !== 'object' ||
      !(record.choice === null || (typeof record.choice === 'string' && Object.hasOwn(names, record.choice))) ||
      Object.keys(record.totals).length !== 3 ||
      !Object.keys(names).every(key => record.totals[key] === (record.choice === key ? 1 : 0))) {
    throw new InvalidRecordError();
  }
  return record;
}

function render(record) {
  retryButton.hidden = true;
  resetButton.hidden = true;
  for (const row of rows) {
    const key = row.dataset.snack;
    row.querySelector('.score strong').textContent = record.totals[key];
    row.querySelector('.chosen').hidden = record.choice !== key;
    row.querySelector('button').disabled = busy || blocked || record.choice !== null;
  }
  status.textContent = record.choice
    ? `Your vote for ${names[record.choice]} is saved.`
    : 'Your browser has not voted yet.';
}

function fail(error) {
  blocked = true;
  invalidRecord = error instanceof InvalidRecordError;
  for (const row of rows) {
    row.querySelector('button').disabled = true;
    if (error instanceof InvalidRecordError) {
      row.querySelector('.score strong').textContent = '—';
      row.querySelector('.chosen').hidden = true;
    }
  }
  retryButton.hidden = error instanceof InvalidRecordError;
  resetButton.hidden = !(error instanceof InvalidRecordError);
  retryButton.disabled = busy;
  resetButton.disabled = busy;
  status.textContent = error instanceof InvalidRecordError
    ? 'Your saved scoreboard is unreadable or inconsistent. Voting is unavailable; your data has not been changed. Reset it only if you want to discard the unreadable data.'
    : error instanceof CoordinationError
      ? 'Safe vote coordination is unavailable. Voting is disabled; try again or use a supported browser.'
      : 'Browser storage is unavailable or your vote could not be saved. Voting is disabled; check storage permissions and try again.';
}

async function resetUnreadable() {
  if (busy) return;
  busy = true;
  resetButton.disabled = true;
  let operationError;
  let record;
  try {
    if (!navigator.locks || typeof navigator.locks.request !== 'function') throw new CoordinationError();
    await navigator.locks.request(LOCK_NAME, async () => {
      try {
        try {
          record = readRecord();
        } catch (error) {
          if (!(error instanceof InvalidRecordError)) throw error;
          localStorage.removeItem(STORAGE_KEY);
          record = readRecord();
        }
      } catch (error) {
        operationError = error;
        throw error;
      }
    });
    blocked = false;
  } catch {
    fail(operationError || new CoordinationError());
  } finally {
    busy = false;
    retryButton.disabled = false;
    resetButton.disabled = false;
  }
  if (record && !blocked) render(record);
}

resetButton.addEventListener('click', resetUnreadable);

async function retry() {
  if (busy) return;
  busy = true;
  retryButton.disabled = true;
  let operationError;
  let record;
  try {
    if (!navigator.locks || typeof navigator.locks.request !== 'function') throw new CoordinationError();
    await navigator.locks.request(LOCK_NAME, () => {
      try {
        record = readRecord();
      } catch (error) {
        operationError = error;
        throw error;
      }
    });
    blocked = false;
  } catch {
    fail(operationError || new CoordinationError());
  } finally {
    busy = false;
    retryButton.disabled = false;
    resetButton.disabled = false;
  }
  if (record && !blocked) render(record);
}

retryButton.addEventListener('click', retry);

async function vote(choice) {
  if (busy || blocked) return;
  busy = true;
  for (const row of rows) row.querySelector('button').disabled = true;
  let operationError;
  try {
    await navigator.locks.request(LOCK_NAME, async () => {
      try {
        if (blocked) return;
        const current = readRecord();
        if (current.choice !== null) {
          render(current);
          return;
        }
        const next = emptyRecord();
        next.choice = choice;
        next.totals[choice] = 1;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        render(next);
      } catch (error) {
        operationError = error;
        throw error;
      }
    });
  } catch {
    fail(operationError || new CoordinationError());
  } finally {
    busy = false;
    retryButton.disabled = false;
    resetButton.disabled = false;
  }
}

for (const row of rows) {
  row.querySelector('button').addEventListener('click', () => vote(row.dataset.snack));
}

try {
  if (!navigator.locks || typeof navigator.locks.request !== 'function') throw new CoordinationError();
  render(readRecord());
} catch (error) {
  fail(error);
}
