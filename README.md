# R&D Quiz Tool

A web app for running the biweekly R&D quiz: quizzes with eight question formats, autosave, one submission per person, scoring (automatic for choice questions; written answers via export, Claude and upload), a release checklist, results, leaderboard, a quiz library with answer keys, roles, and a change log.

- **Start here:** `SETUP-GUIDE.md` (setup from zero to live, in plain steps).
- **Demo mode:** with an empty `apiKey` in `src/config.js` the app runs on sample data, saved only in your browser.
- **Stack:** React + Vite on GitHub Pages, Firebase Authentication + Firestore (free Spark plan), optional Google Apps Script helper.

For developers: `npm install`, `npm run dev`, `npm test`, `npm run build`.
