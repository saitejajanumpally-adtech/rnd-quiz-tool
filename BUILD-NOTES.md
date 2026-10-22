# Delivery 2: build notes

## What is in this build
**Participants**
- Redesigned Arena: greeting, hero with your mascot, three centered scorecards, a learning-journey card with readable stage cards.
- Welcome tour on first sign-in (six steps, one mascot each), skippable, replayable from Menu > Take the tour.
- Required questions: tagged, and Submit stays off until they are answered, with "Go to question" links.
- In-page submit confirmation, then a "Round complete" finish moment, then "You're in".
- Leaderboard: podium, full names (no initials, no roles), rank movement against the previous round, "Your round" panel with a personal-best chip, "How rankings work".
- Answer key: "Show my answers" off hides your answers, feedback and score, and keeps the correct answers and the "strong answer" text.
- Profile: mascot picker with the real art, "Show mascots" (key moments / every screen / off), Account with Sign out and Remove my profile.
- 72 mascot images (12 poses x 6 mascots), used for 28 moments. A missing image falls back to the wave pose, then to the old drawn mascot.

**Leads and above**
- Full leaderboard on its own page (button on the Top 10), search, section scores, rank change with "was #n", fixed "previous round" label.

**Creators and admins**
- Every creator can edit every quiz. Manage quizzes shows who created each one.
- Quiz editor: Back and Cancel on every step (asks only if something changed), settings off by default, no "Show in Quiz library" switch, a Required switch, a formatting bar (bold, italic, bullets, links), a format-first start, and optional sections.
- Save changes returns to Manage quizzes.
- Admin only: Archive, Restore (Archived tab), Delete (only quizzes nobody answered and never released).
- Written scoring: one self-contained export (instructions and rubric inside, no email addresses), a column guide, plain-language upload checks, one-click rounding to half points.
- Admin settings: grouped settings, quiz defaults for new quizzes, rank-movement switch, funnel levels, Users totals and Export Users CSV.

## Things that differ from the mockups (please read)
1. **Formatting is stored as simple markers** (like **bold**), with a toolbar and a live preview, not as a word-processor box. This avoids needing a sanitizer library, and nothing is ever turned into HTML. The answer options accept the markers when typed, but have no toolbar.
2. **The two email switches in Admin settings are saved but do nothing yet.** Sending emails needs the Apps Script helper, which is part of the notifications update. The page says so.
3. **Rank movement starts with the next scored round.** Rounds scored before this build have no movement, so their leaderboards show no arrows.
4. **The tour is shown to every role on first sign-in**, and covers participant screens only.
5. **"Start to submit" on the finish screen** is the time between the first and last save, so it includes breaks.
6. Names on leaderboards come from the Google account. Removed profiles show "Profile removed" (a public marker records only that, with a time).
7. The funnel is now stage cards. The old funnel drawing is still in the code, unused.
8. Missing mascot poses fall back to Wave. Staff moments included: no quizzes yet, published, checklist complete, results released.
9. If a required question is left blank and answers are auto-submitted at close, it scores 0, and the full leaderboard shows an "N required blank" chip.

## Fixes and findings
- **Deploy safety:** the earlier delivery listed two test-only packages in `package.json` that were not in the lock file, which would have made the GitHub build fail. They are removed. If you pushed the earlier code and the build failed, this is why.
- **Auto-submit and review requests "on by default":** new quizzes were already off. The sample quiz in demo mode had them on. Demo data is fixed, and new quizzes now take their defaults from Admin settings.
- **"Show my answers" off with an empty written section:** the writer had left "What a strong answer covers" blank. The page now says "No model answer was added for this question."
- **Missing submit popup:** I could not reproduce it. The popup appears in every automated test. It is now an in-page dialog. Please check it with a teammate.
- **CSV upload errors:** your file had a comma inside the feedback, which split the row. The upload now says so in plain words and tells you to wrap that text in double quotes.

## What is tested, and what is not
- 95 automated tests pass, covering scoring, movement, required questions, optional sections, formatting, the tour, mascots and fallbacks, leaderboards, archive, removing a profile, the answer key, written scoring, and admin settings.
- A clean install from the lock file, the build, and all tests pass, as GitHub will run them.
- A check for undefined names across the whole app reports no errors.
- **Not verified:** how it looks in a real browser (I cannot open one here), the Firestore rules (use the Playground checks), and live Firebase behavior.

## Costs to watch (free plan)
- Saving an answer now also checks that the profile is active: about +1 read per save. Around 5,000 extra reads on a deadline day for 500 people.
- Opening Admin settings reads every user record (about 500 reads) and each released quiz's results. Open it when you need it, not repeatedly.
- The leaderboard reads one small list of removed profiles.

## Known limits
- Creators can no longer see raw answers of an archived quiz. Only admins can. This means a creator cannot score an archived quiz.
- Notifications rework is still to come. Participants can still switch their own notification notices off.
