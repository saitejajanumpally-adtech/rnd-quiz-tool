# R&D Quiz Arena: setup guide, from zero to live

This guide takes you from the files in this folder to a live quiz site your team can open. You don't need to write code. You will copy and paste a few things.

**Time:** about 60 to 90 minutes the first time. **Cost:** nothing on the free plans, as long as you follow these steps (the free limits are explained in part 8).

## What you are setting up

Three pieces, each doing one job:

| Piece | Job | Where it lives |
|---|---|---|
| The website | The screens people see | GitHub Pages (free) |
| The database and sign-in | Stores quizzes, answers and scores, and checks that people have a databeat.io account | Firebase, free "Spark" plan |
| The helper (optional) | Posts to Google Chat, creates Gmail drafts, copies responses to Google Sheets | Google Apps Script (free) |

**Try it first.** Open `arena-demo.html` (or the demo link in the chat). It runs the real app with sample data and nothing is saved online. Use it to click around before you set anything up.

**Be honest about what is tested.** The app's logic and screens are tested (scoring, rules about who can do what, the whole quiz journey in a simulated browser). Three things could **not** be tested before handing this over, because they need your real Google accounts: the Firebase security rules (part 4 has a checklist), the Google sign-in popup, and the Apps Script helper. Part 6 is a dry run that tests all three with a small group before you announce anything.

---

## Part 1. Put the code on GitHub

Use a **company-owned GitHub organization** if you can, so the site survives if someone leaves. A personal account works for now, and you can transfer it later (part 9).

1. Sign in at github.com. Click **+** (top right), then **New repository**.
2. Name it, for example `rnd-quiz-arena`. Choose **Public**. (GitHub Pages is free for public repositories. Nothing secret is stored in the code; your data lives in Firebase.) Click **Create repository**.
3. Unzip `rnd-quiz-arena-source.zip` on your computer. Open the unzipped folder.
4. On your new repository page, click **uploading an existing file**. Drag in **everything inside the folder** (not the folder itself): `src`, `tests`, `apps-script`, `index.html`, `package.json`, `package-lock.json`, and the other files. Click **Commit changes**.
5. The hidden `.github` folder may not upload by drag and drop. Check: if you can't see `.github/workflows/deploy.yml` in the repository, click **Add file**, then **Create new file**. In the name box type `.github/workflows/deploy.yml` (typing the slashes creates the folders). Open `deploy.yml` from the unzipped folder in Notepad, copy everything, paste it into GitHub, and click **Commit changes**.
6. Go to **Settings**, then **Pages**. Under **Build and deployment**, set **Source** to **GitHub Actions**.
7. Click the **Actions** tab. A run called "Deploy to GitHub Pages" starts by itself. Wait for the green tick (about 2 minutes). Your address is shown under Settings, then Pages. It looks like `https://YOUR-NAME.github.io/rnd-quiz-arena/`.

Open the address. You should see the sign-in screen in **demo mode**. That proves the website part works.

## Part 2. Create the Firebase project

Use the Google account you want to **own** the project (ideally a shared or company account, not a personal one).

1. Go to console.firebase.google.com and click **Create a project**. Name it `rnd-quiz-arena`. Turn **off** Google Analytics. Click **Create**.
2. **Sign-in:** left menu, **Build**, **Authentication**, **Get started**. Click **Google**, switch **Enable** on, choose your support email, **Save**.
3. **Allow your website:** Authentication, **Settings**, **Authorized domains**, **Add domain**. Enter `YOUR-NAME.github.io` (just the domain, no `https://` and no repository name).
4. **Database:** left menu, **Build**, **Firestore Database**, **Create database**. Pick a location close to your team (for example `asia-south1`, Mumbai). Choose **Start in production mode**. Click **Create**. (The location can't be changed later.)
5. Do **not** enable "Storage". The app keeps pictures inside the database so you never need a paid plan.

## Part 3. Connect the website to Firebase

1. In Firebase, click the gear next to **Project Overview**, then **Project settings**. Scroll to **Your apps** and click the **web** icon `</>`. Nickname it `arena`. Leave Hosting off. Click **Register app**.
2. You'll see a block of code with `apiKey`, `authDomain`, `projectId` and more. Keep this page open.
3. In GitHub, open the file `src/config.js`. Click the pencil icon to edit. Copy each value from Firebase into the matching line (keep the quote marks):

   ```js
   firebase: {
     apiKey: 'paste here',
     authDomain: 'paste here',
     projectId: 'paste here',
     storageBucket: 'paste here',
     messagingSenderId: 'paste here',
     appId: 'paste here'
   },
   bootstrapAdmin: 'your.email@databeat.io',
   ```
   The `apiKey` is not a password. It is meant to be public. The security rules in part 4 protect your data.
4. Change `bootstrapAdmin` to **your own work email**. This account is always an Admin.
5. Click **Commit changes**. Wait for the green tick under the Actions tab. The site is now live and connected.

## Part 4. Install the security rules (important)

The rules decide who can read and change what. Without them, anyone with the link could read answers. **Don't skip this and don't announce the site until this is done.**

1. In `firestore.rules`, find the line `me() == 'saiteja.janumpally@databeat.io'` and change the email to **the same email you put in `bootstrapAdmin`**. (In GitHub: edit the file, change it, commit.)
2. Open `firestore.rules`, select all, and copy.
3. In Firebase: **Firestore Database**, **Rules** tab. Delete everything in the box, paste the rules, click **Publish**. If Firebase shows red error marks, don't publish: send me the message and the line it points to.
4. Rules checklist (do this after the dry run in part 6, using a normal teammate account, not yours):
   - While a quiz is **scheduled** (not open yet): the teammate opens the quiz link and sees "This quiz hasn't opened yet".
   - While a quiz is **live**: the teammate can answer and submit, but cannot open the answer key link for it.
   - After the teammate **submits**: reopening the quiz shows "Answers are locked".
   - After the quiz **closes**: the teammate sees "This quiz is closed".
   - The teammate cannot open **Manage quizzes** or **Admin** (they see "You don't have access").
   - After you **release**: the teammate sees their own score and the answer key, and the Top 10, but not the full leaderboard (unless they are a Lead).
   If any of these fail, treat it as a problem with the rules and stop before announcing.

## Part 5. The Google Apps Script helper (optional, 15 minutes)

You can skip this. Without it, every step still works: you copy the Chat message, click "Open email draft in Gmail", and download the backup CSV. The helper saves you those clicks.

1. Go to script.google.com, sign in with the same account that owns Firebase, and click **New project**. Name it `Arena helper`.
2. Delete the sample code. Paste in everything from `apps-script/Code.gs`.
3. Click the gear (**Project settings**). Tick **Show "appsscript.json" manifest file in editor**. Go back to the editor, open `appsscript.json`, and replace its contents with `apps-script/appsscript.json`.
4. In **Project settings**, scroll to **Script properties**, click **Add script property** and add:
   - `FIREBASE_PROJECT_ID`: your Firebase project id (from Project settings in Firebase)
   - `CHAT_WEBHOOK_URL`: in Google Chat, open your space, **Apps and integrations**, **Webhooks**, add one and copy its URL (optional)
   - `EMAIL_TO`: who email drafts are addressed to (optional)
   - `SHEET_FOLDER_ID`: the folder id from the Drive folder's address, for backup sheets (optional)
5. Select the function `testEverything` and click **Run**. Approve the permissions (click **Advanced**, then **Go to Arena helper**). Open **Execution log**. Every line should say `OK`. If a line says `FIX`, follow its message. The most common one: *"Cloud Firestore API has not been used in project..."*. To fix it: in Project settings, under **Google Cloud Platform (GCP) Project**, click **Change project** and enter your Firebase project **number** (Firebase Project settings shows it).
6. Select `installTrigger` and click **Run**. This makes the helper check for jobs every 5 minutes.
7. In the Arena, open **Admin settings**, **Integrations and scoring**, and switch on **Apps Script helper is set up**.

Jobs wait for up to 5 minutes before they run. The Admin settings page shows each job's status.

## Part 6. First sign-in and a dry run

1. Open your site and click **Sign in with Google**. You'll arrive as an Admin. (The first load may show a short "Couldn't load" if the rules weren't published; fix part 4 and refresh.)
2. **Add your team's leads and creators:** menu (top right), **Roles**. Add emails one by one or upload a CSV (columns: `email`, `role`). Everyone else is automatically a Participant.
3. **Create a test quiz:** **Manage quizzes**, **New quiz**. Fill in the four steps. Set it to open in 5 minutes and close in 30 minutes. Publish.
4. Ask **two or three teammates** (including one Lead) to take it. Test auto-submit by having one person answer a question and not submit.
5. When it closes: **Manage quizzes**, open the quiz, and work down the **Release checklist**: Calculate scores, score written answers (see "Scoring written answers" below), Review, Back up, Announcement ready, then **Release**.
6. Check that participants see their results, the Top 10, and the answer key, and that part 4's checklist passes.
7. Delete the test quiz data later, or leave it. It only appears in the Quiz library for people who open it.

## Running a normal round

1. **Create** (Manage quizzes, New quiz). Dates are pre-filled for every second Tuesday 10:00 AM to Thursday 11:59 PM, answer key Saturday 1:00 AM. Change them for holidays. Choose auto-submit, review requests and library visibility.
2. **Publish.** Copy the announcement into your Chat space (or let the helper post it).
3. **During the round:** Manage quizzes shows how many have submitted. Copy the reminder message into Chat. You can change the close time (Change close time) or end early (Close now).
4. **After it closes:** run the release checklist and click **Release**. The Arena then shows each person their result, and Quiz library gets the answers.

### Scoring written answers

1. In the checklist, step **Score written answers**: click **Export for scoring**. Two files download: the answers (CSV) and a scoring prompt (text).
2. Open Claude, paste the prompt, attach the CSV, and ask it to return only the CSV.
3. Save Claude's reply as a `.csv` file and click **Upload scored CSV**. The tool checks every row (known keys, scores from 0 to the maximum in steps of 0.5) and lists any problem **before** saving anything.
4. Review flagged answers (the tool lists them) and change any score. Every change asks for a reason and goes in the change log.

## Part 7. Who can do what

| | Participant | Lead | Creator | Admin |
|---|---|---|---|---|
| Take quizzes, see own results, Top 10, Quiz library | Yes | Yes | Yes | Yes |
| Full leaderboard with section scores | No | Yes (admins can change this) | Yes | Yes |
| Create quizzes, edit their own, release results | No | No | Yes | Yes (any quiz) |
| Edit someone else's quiz | No | No | Only if granted | Yes |
| Manage Lead roles | No | No | Yes | Yes |
| Grant Creator or Admin, see settings, change log | No | No | No | Yes |

## Part 8. Free limits, and what to watch

Firebase's free plan allows 50,000 database reads and 20,000 writes per day, resetting daily. For about 500 people, one round uses roughly 10,000 to 25,000 reads and about 10,000 writes on the busiest day (the deadline). That fits, with room to spare, but not unlimited room.

- If you ever hit a limit, the site stops loading data until the next day. To avoid it: don't leave many extra tabs auto-refreshing, and don't run two big rounds on the same day.
- Check usage in Firebase: **Firestore Database**, **Usage**. If you are over 60% on a normal round, tell me.
- If you need more headroom, upgrade the project to the pay-as-you-go plan. It still includes the same free amounts, and a round this size usually costs well under a few dollars. I haven't priced it for your region, so check Firebase's pricing page first.

## Part 9. Keep it alive

- **Add a second owner.** In Firebase: Project settings, **Users and permissions**, add another person as **Owner**. In GitHub: Settings, Collaborators (or transfer the repository to a company organization under Settings, Danger zone).
- **Changing anything in the app** later means editing a file on GitHub and committing. The Actions tab rebuilds the site automatically.
- **Back up each round.** The release checklist asks you to download the responses CSV. Keep those files somewhere safe: the free Firebase plan has no automatic backups.
- **Getting a change made:** tell me what you want and I'll prepare the edited files.

## Troubleshooting

| What you see | What it usually means |
|---|---|
| Site shows "Demo mode" | `apiKey` in `src/config.js` is still empty, or the last commit hasn't finished building (Actions tab) |
| Sign-in popup says "unauthorized domain" | Part 2, step 3: add `YOUR-NAME.github.io` to Authorized domains |
| "Sign in with your @databeat.io account" | The person chose a personal Gmail. They should choose their work account |
| "The database refused this action" | The rules aren't published, the email in the rules doesn't match `bootstrapAdmin`, the quiz has closed, or your role doesn't allow it |
| Actions tab shows a red cross | Open the run and send me the message. Often a file didn't upload |
| Everything loads slowly or blanks | You may be over the daily free limit (part 8) |
| Helper jobs stay "pending" | The trigger isn't installed (part 5, step 6), or the helper switch is off in Admin settings |

## What this version does not do yet

- Account-level scoring and the Process Excellence formula (a later phase).
- Scoring written answers automatically with an API key. It uses the export, Claude, upload route instead.
- Light theme. Dark only for now.
- Per-person email or Chat reminders. Reminders go to your whole space.
