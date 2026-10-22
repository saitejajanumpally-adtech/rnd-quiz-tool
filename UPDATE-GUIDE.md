# Updating the live site with Delivery 2

Four steps. About 20 minutes. Do them in this order.

## Step 1. Publish the new rules (2 minutes)
The new rules add one small collection (it marks who removed their profile) and lock raw answers of archived quizzes to admins.
They still accept everything the live site does today, so this is safe to do first.

1. Firebase Console > **rnd-quiz-tool** > **Firestore Database** > **Rules** tab.
2. Keep a copy of what is there now (select all, copy, paste into a Notepad file called `rules-before-delivery2.txt`). It is your way back.
3. Click in the editor, **Ctrl+A**, then paste the whole text of `firestore-rules.txt` (from this delivery).
4. Click **Publish**. If Firebase shows a red error it does NOT publish. Send me a screenshot.
5. Wait about a minute, then open the live site and check it still loads.

## Step 2. Run the Playground checks (10 minutes)
Open `PLAYGROUND-CHECKS.txt` and run the checks in it. Anything different from "Expected": stop and send me a screenshot.

## Step 3. Upload the images, then the code (GitHub, 2 uploads)
GitHub's web page takes at most 100 files per upload, and this project has more, so it is done in two parts.

**Part A: the mascot images**
1. Unzip `step1-mascot-images.zip`. You get a folder called `public`.
2. Open your repo `saitejajanumpally-adtech/rnd-quiz-tool` on GitHub > **Add file** > **Upload files**.
3. Drag the whole `public` folder onto the page. Wait until all 72 files are listed.
4. Write "Add mascot images" as the message and click **Commit changes**.

**Part B: the app code**
1. Unzip `step2-app-code.zip`. Open the folder.
2. On GitHub: **Add file** > **Upload files**. Select everything inside the folder (the `src` and `tests` folders and the loose files like `package.json`) and drag it onto the page.
3. Message: "Delivery 2". Click **Commit changes**.
4. Open the **Actions** tab. A run starts. After about 40 seconds it should show a green tick. If it shows a red cross, click it and send me a screenshot.

## Step 4. Test the live site
1. Open the live site in a private window. Sign in as yourself. The welcome tour should appear once.
2. Follow `TEST-SCRIPT.txt` yourself, then ask two teammates (not admins) to follow it too.

## If something goes wrong
- **The site looks broken after Step 3:** on GitHub open the **Actions** tab, find the last green run before yours, and choose **Re-run all jobs**. That restores the previous site.
- **People get "permission" errors after Step 1:** paste `rules-before-delivery2.txt` back into the Rules tab and Publish.
