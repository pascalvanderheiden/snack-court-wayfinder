# Snack Court

A small, interactive snack vote built with vanilla HTML, CSS, and JavaScript.

**[Open Snack Court](https://pascalvanderheiden.github.io/snack-court-wayfinder/)** · [Deployment runs](https://github.com/pascalvanderheiden/snack-court-wayfinder/actions/workflows/pages.yml)

## Features

- Pick **Potato chips**, **Popcorn**, or **Pretzels** from the dark-green scoreboard.
- See your choice and its total update immediately after a successful save.
- Keep your vote across reloads and later visits using `localStorage`.
- Synchronize open tabs; Web Locks coordinate simultaneous votes so only one is accepted.
- Recover from storage failures with retry, or explicitly reset unreadable data.
- Use keyboard-accessible controls and a responsive layout.

**These are browser-local totals, not a shared leaderboard.** Each retained storage area can save one vote. Clearing storage or using another profile, browser, device, or origin separates or resets it. There are no accounts, admin tools, backend, or server synchronization.

Voting requires available browser storage and Web Locks in a secure context (HTTPS or localhost). The app disables voting and explains the issue rather than claiming an unsaved vote succeeded.

## Run locally

With Node.js installed:

```sh
node server.js
```

Open <http://127.0.0.1:4173>. Use HTTP(S), not a `file:` URL. The server serves static files only; it does not collect votes.

## Test

Install Microsoft Edge, then run:

```sh
npm ci
npm test
```

Playwright uses the installed **Microsoft Edge** browser. Tests exercise voting, reloads, concurrent tabs, storage failures, recovery, keyboard interaction, and deployment beneath a project URL. Tests start and stop their own local server; stop any manually running server on port 4173 first.

## GitHub Pages deployment

The [deployment workflow](.github/workflows/pages.yml) publishes on every push to `main`, including merged pull requests. It also supports **Actions > Deploy Snack Court to GitHub Pages > Run workflow** on `main`.

The workflow uses standard GitHub Actions, not an AI agent: deployment is deterministic and needs no inference credentials. It copies only the four runtime assets into the Pages artifact, then deploys with the `github-pages` environment and scoped Pages/OIDC permissions. Repository sources, tests, and agent skills are not included in the site artifact. Asset URLs are relative so the app works under `/snack-court-wayfinder/`.

The repository is public, Pages uses **GitHub Actions** as its publishing source, and the repository's About website links to the live app. No build step, application server, or custom deployment secrets are required.

## How Wayfinder shaped the app

We planned before implementing. The [Wayfinder map](https://github.com/pascalvanderheiden/snack-court-wayfinder/issues/1) defined the destination and boundaries, then tracked exactly three child decisions:

1. [Agree on the three fixed snacks](https://github.com/pascalvanderheiden/snack-court-wayfinder/issues/4): Potato chips, Popcorn, and Pretzels.
2. [Research storage across reloads and tabs](https://github.com/pascalvanderheiden/snack-court-wayfinder/issues/3): establish persistence limits, local-only results, and cross-tab races.
3. [Prototype the voting flow](https://github.com/pascalvanderheiden/snack-court-wayfinder/issues/2): try three interactive designs and decide the experience.

The prototype decision depended on the snack and storage decisions. Three alternatives were compared: **A - Snack stand**, **B - Scoreboard**, and **C - Paper ballot**. After reopening the decision to correct the interactive preview, **B - Scoreboard was selected**, superseding the earlier A selection. [Screenshots of all three and the final choice](https://github.com/pascalvanderheiden/snack-court-wayfinder/issues/2#issuecomment-7187366165) are preserved on the decision issue. Throwaway prototypes and research remain on separate reference branches, not in the production site.

The completed map fed an [implementation spec](https://github.com/pascalvanderheiden/snack-court-wayfinder/issues/5), then three vertical-slice tickets: [safe voting](https://github.com/pascalvanderheiden/snack-court-wayfinder/issues/6) first, followed by [tab synchronization](https://github.com/pascalvanderheiden/snack-court-wayfinder/issues/7) and [storage recovery](https://github.com/pascalvanderheiden/snack-court-wayfinder/issues/8) in parallel. Implementation used browser-level test-driven development in Edge, then standards/spec reviews and integration fixes.
