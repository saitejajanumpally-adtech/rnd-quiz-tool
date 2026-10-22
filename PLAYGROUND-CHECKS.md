# Rules checks in the Firebase Rules Playground (after publishing the Delivery 2 rules)

Where: Firestore Database > Rules tab > Rules Playground. It only simulates; nothing changes.
Always tick **Email verified**. The Playground cannot test "list" requests.

## A. Quick re-run of the earlier checks
Run these again, because the rules changed. They should all behave as before.
| # | Person | Type | Location | Expected |
|---|---|---|---|---|
| 1 | Signed out | get | quizIndex/main | Denied |
| 2 | Outsider (someone@gmail.com) | get | quizIndex/main | Denied |
| 3 | Participant (p1@databeat.io) | get | quizIndex/main | Allowed |
| 4 | Participant | get | quizIndex/archived | Denied |
| 5 | Admin (saiteja.janumpally@databeat.io) | get | quizIndex/archived | Allowed |
| 6 | Participant | get | quizKeys/zvmb8io | Allowed |
| 7 | Participant (p1) | get | users/O8x7IrHYEKMHhgD7fT86P5zNVLC2 | Denied |
| 8 | Participant using UID O8x7IrHYEKMHhgD7fT86P5zNVLC2 | get | users/O8x7IrHYEKMHhgD7fT86P5zNVLC2 | Allowed |
| 9 | Admin | delete | quizzes/zvmb8io | Denied (it was released) |

## B. New in Delivery 2
Use any real response id from Firestore Data > `responses` (it looks like `quizid_uid`) where it says RESPONSE-ID.
| # | Person | Type | Location | Expected |
|---|---|---|---|---|
| 10 | Participant (p1) | get | profileStatus/anyone | Allowed |
| 11 | Outsider | get | profileStatus/anyone | Denied |
| 12 | Participant (UID p1) | get | responses/RESPONSE-ID (someone else's) | Denied |
| 13 | Creator (creator.test@databeat.io, UID c1, role saved in Roles) | get | responses/RESPONSE-ID of a normal, released quiz | Allowed |

For create and update checks the form may show a box for the data. Send me a screenshot of that form before you run:
- Participant with UID p1 creates `profileStatus/p1` with data `removed: true, at: 1` (expected Allowed).
- The same person creates `profileStatus/o1` (someone else) (expected Denied).

## C. After you archive a test quiz (Delivery 2 has the Archive button)
Archive a test quiz in the app. Then:
| # | Person | Type | Location | Expected |
|---|---|---|---|---|
| 14 | Creator | get | responses/<an id from the archived quiz> | Denied |
| 15 | Admin | get | responses/<the same id> | Allowed |
| 16 | Participant | get | quizzes/<archived quiz id> | Denied |
| 17 | Admin | get | quizzes/<archived quiz id> | Allowed |

## D. Checks only the real site can do
- A creator opens Manage quizzes > a closed quiz > Calculate scores. If that works, creators can still list responses for active quizzes. (This is the one place the new response rule could surprise us. If it fails with "permission", tell me. The fix is a one-line change.)
- An admin opens Admin settings. The user totals appear and Export Users CSV downloads a file.
- Remove a test account's profile, then check that its name is greyed with "Profile removed" on a leaderboard.
