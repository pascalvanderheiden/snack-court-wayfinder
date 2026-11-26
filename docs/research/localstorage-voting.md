# Snack Court: localStorage research

Research for [issue #3](https://github.com/pascalvanderheiden/snack-court-wayfinder/issues/3), 26 November 2026. This answers the storage question; it does not decide the voting flow or implement it.

## Answer

`localStorage` can remember a choice and local tally across reloads and normal browser restarts **when the same storage area remains available and intact**. Other open tabs sharing that area can observe changes. It is not a shared election database or a durable, tamper-proof browser identity. “One vote per browser” is at best a cooperative limit per retained storage area, not a guarantee of one vote per person, device, browser installation, or all time. [1][2][3][4]

## Persistence and boundaries

- `localStorage` stores string keys and values for an origin and normally persists across page loads and browser sessions. Reading it after reload can restore a previously saved choice and tally; it does not automatically restore the page's UI. Data can disappear or become unavailable, as described below. [1][5]
- An origin is the scheme, host, and port, not the URL path. Thus `https://example.com/a` and `/b` share an origin; HTTP versus HTTPS, another hostname, or another port does not. Same-origin applications can access the same storage, so keys should not be assumed private to one path. Different browser profiles, browsers, and devices should not be treated as one shared store. Browser privacy partitioning can further separate embedded third-party contexts even when origins match. [1][2][6]
- `file:` URL storage behavior is undefined and browser-dependent; it may be inaccessible. Findings about ordinary same-origin pages should not be extrapolated into a reliable `file:` deployment. [1]

## Tabs and notifications

- A successful change to a shared `localStorage` area queues a `storage` event for **other** documents sharing that area, including same-origin tabs; the document making the change does not receive its own event. The writing tab must update its own UI, and other tabs can use the event to refresh from storage. Event delivery is queued, not a lock or immediate cross-tab transaction; inactive documents may process events later. [3][7]
- The event supplies `key`, `oldValue`, `newValue`, `url`, and `storageArea`. Removal has a null new value; `clear()` emits a null key and null values. Setting an existing key to the same value, removing a nonexistent key, or clearing an already empty store does not broadcast a change. Do not equate every event with a distinct accepted vote, or assume browser-settings deletion produces the same event as script `clear()`. [7]
- A tab opened later must read current storage itself; notifications are not a durable history. Reading again on activation/reload is relevant to stale or missed UI state, but it does not solve simultaneous writes. [3][7]

## Concurrent votes and consistency

The HTML Standard explicitly advises authors to assume no locking across agent clusters: a read, increment, and write is not a transaction. For example, tabs A and B can both read count 0 and “no choice,” independently accept different choices, and each write 1; one update overwrites the other, while both UIs may initially report success. Events afterwards do not prevent this race. Two separate writes for choice and totals can also leave inconsistent state if a later write fails or another tab intervenes. [7]

Writing a single serialized record can avoid a partial update *between those fields on an individual successful set*, but it does not make a read-check-write sequence atomic or prevent a competing tab from overwriting the record. A cooperative alternative worth evaluating for the later flow/technical work is a shared exclusive Web Lock around reading, checking, and writing; it coordinates participating contexts within the same storage bucket, not non-cooperating scripts or users, and requires a secure context and browser support. This is not a decision to use it; fallback behavior and compatibility remain to be established. [7][8][9]

If enforcement relies only on a stored choice and an ordinary read/check/write, it works for sequential, cooperating interactions while the state remains intact, but cannot ensure exactly one accepted vote under simultaneous cross-tab actions. Stronger cooperative cross-tab coordination can address that specific race under its stated conditions, not make browser state authoritative or permanent. [7][8]

## Unavailable, deleted, private, or altered data

- Accessing the `localStorage` property can throw `SecurityError` for an opaque origin or blocked persistence; a write can throw `QuotaExceededError` because of quota or policy. Property existence alone does not establish that writes work; a successful probe also cannot guarantee the later real write will succeed. Both access and actual writes need failure-aware handling if persistence is claimed. [1][5][7]
- A user can clear site data, and best-effort data may be evicted under browser policies or storage pressure. WebKit explicitly includes `localStorage` in its storage policy and describes eviction, including inactivity-related policy. A site may request persistent storage, but granting it is browser-dependent and it is not protection against the user deleting data. Exact policies, quotas, timing, and notification behavior vary; no universal retention period is established here. [4][10]
- Private browsing is not uniformly equivalent to unavailable storage. It may have a different quota or be blocked; when usable, it is temporary. For example, Chrome ends an Incognito session after all Incognito windows close and removes session site data; MDN describes private `localStorage` as cleared when the last private tab closes. Do not assume closing one private tab ends a session if another private window remains. [1][4][5][11]
- If the choice or tally is cleared, overwritten, corrupted, or edited, the app cannot recover the former truth from `localStorage` alone. Clearing only one of multiple keys can leave inconsistent state. A user or same-origin script can alter client-side storage; a client-side flag cannot establish identity or prevent intentional repeat voting. [1][5][7]

## Consequences for the later voting-flow decision

- In the ordinary successful case, the initiating tab can show its updated choice and locally stored totals immediately; another open tab can refresh upon a storage event, and a returning tab can read stored data. This is conditional on successful storage and appropriate UI handling, not behavior supplied automatically by `localStorage`. [3][5][7]
- A single person's extra browser profile, private session, different browser/device, different origin, or cleared storage yields a separate or reset local state. Conversely, multiple people sharing one browser storage area share the same local restriction. Client-only storage cannot identify individuals, prevent deliberate resets, aggregate users' votes globally, or provide an authoritative audit. A local tally represents only that storage area's data, not a site-wide result. [1][2][4][6]
- The flow still needs a human decision on what to show when persistence fails, data is missing or inconsistent, or another tab changes state, and on how to communicate the local-only scope. This research does not choose those behaviors. Do not present a failed write as a durably saved vote.

## Uncertainties and verification boundary

These are specification and first-party documentation findings, not measurements on Snack Court's eventual deployment. The hosting origin, supported browsers and versions, secure-context availability, embedding/partition context, exact eviction policies, and desired recovery behavior are not specified. Test the chosen environment for reload, two tabs including concurrent clicks, blocked access, quota/write failure, deletion, and private-session termination before claiming that implementation behavior matches this research. Web Locks support and failure handling would also need verification if chosen; availability does not guarantee all writers cooperate.

## Sources

1. [MDN: Window.localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) — lifetime, origins, exceptions, private and `file:` behavior.
2. [MDN: Same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy#definition_of_an_origin) — scheme/host/port and path examples.
3. [MDN: Window storage event](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event) — writer versus other contexts.
4. [MDN: Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) — partitions, storage persistence, private mode, eviction.
5. [MDN: Using the Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API) — strings, reloads, feature detection and deletion.
6. [WHATWG Storage Standard: storage keys](https://storage.spec.whatwg.org/#storage-keys) — storage keys and partitioning framework.
7. [WHATWG HTML Standard: Web storage](https://html.spec.whatwg.org/multipage/webstorage.html) — no-locking warning, storage algorithms, exceptions and event dispatch.
8. [W3C: Web Locks API](https://w3c.github.io/web-locks/) — cooperative locks and storage-bucket scope.
9. [MDN: Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API) — secure context, coordination and availability.
10. [WebKit: Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/) — first-party WebKit storage and eviction policies.
11. [Google Chrome Help: Browse in Incognito mode](https://support.google.com/chrome/answer/95464?hl=en) — private session lifetime and removal of site data.
