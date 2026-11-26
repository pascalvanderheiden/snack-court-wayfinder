# Snack Court

A browser-local snack scoreboard. Each retained storage area can save one vote; totals are not shared. Clearing storage or using another profile, browser, device, or origin separates or resets the vote.

Run `node server.js` and open <http://127.0.0.1:4173>. Use HTTP(S), not a `file:` URL. Voting requires working browser storage and Web Locks in a secure context; it fails closed otherwise.

For browser tests, install dependencies with `npm install` and run `npm test`. The tests use the installed Microsoft Edge browser.
