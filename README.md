# FinPlan — Android App, Google Drive & Auto-Backup Setup

FinPlan is a single-page web app. This package turns it into an installable
Android app (a PWA) and adds an optional Google Drive backup option. There is
no native APK here — Android's own browser (Chrome) installs PWAs directly
as real home-screen apps with their own icon and window, which is the
realistic, maintainable equivalent of a native app for a tool like this.

## Files in this package

| File | Purpose |
|---|---|
| `finplan.html` | The app itself. Open this file directly to just use the app. |
| `manifest.json` | Tells the browser this is installable, with name/icons/colors. |
| `sw.js` | Service worker — caches the app shell so it opens instantly and works offline (your data is never cached here, only the app's code). |
| `icon-192.png`, `icon-512.png`, `icon-512-maskable.png` | App icons. |
| `README.md` | This file. |

**Keep all files in the same folder** — the manifest and service worker
reference the others by relative path.

---

## Part 1 — Install as an Android app (PWA)

Browsers only allow installable "apps" (and Google Sign-In, see Part 2) from
a real `https://` address — not from a file opened straight off your phone's
storage. You need to host these files somewhere. The easiest free options:

1. **GitHub Pages** (recommended, free, takes ~5 minutes):
   - Create a new GitHub repository, upload all the files in this package to it.
   - Go to the repo's Settings → Pages → set source to your main branch.
   - GitHub gives you a URL like `https://yourname.github.io/finplan/finplan.html`.
2. **Netlify Drop** (netlify.com/drop): drag-and-drop this folder, get an instant `https://` URL.
3. Your own web server / static hosting of your choice.

Once hosted:
1. Open the `https://.../finplan.html` URL on your Android phone in Chrome.
2. You'll see an **"Install as app"** button in the sidebar (or use Chrome's
   menu → **"Add to Home screen" / "Install app"**).
3. Tap it — FinPlan now opens like any other app, with its own icon, no
   browser address bar, and works even with no signal (for data already
   loaded in that session).

On iPhone/iPad, Safari doesn't support the automatic install prompt — use
Safari's Share button → **"Add to Home Screen"** instead; it works the same way.

> Your financial data itself still lives only in the page's memory for that
> session, exactly as before — installing as an app doesn't change where
> your data is stored. Keep exporting JSON backups (or use Google Drive
> backup below).

---

## Part 2 — Google Drive backup (optional)

This lets you back up / restore your FinPlan JSON data to your own Google
Drive with one tap, instead of manually downloading/uploading files. FinPlan
never sees your Google password, and — importantly — it uses Google's
restricted **`drive.file`** permission scope, meaning it can only ever see
files it created itself, never anything else in your Drive.

Because this uses Google Sign-In, it also requires the app to be hosted at a
real `https://` address (see Part 1), and **you** need to create your own
free Google Cloud OAuth Client ID — a one-time, five-minute setup that only
you control:

1. Go to [console.cloud.google.com](https://console.cloud.google.com/) and
   create a new project (any name).
2. In **APIs & Services → Library**, search for and enable the **Google
   Drive API**.
3. In **APIs & Services → OAuth consent screen**, choose "External", fill in
   the required fields (app name, your email) and save. You can leave it in
   "Testing" mode and add your own Google account as a test user.
4. In **APIs & Services → Credentials → Create Credentials → OAuth client
   ID**, choose **"Web application"**. Under **"Authorized JavaScript
   origins"**, add the exact origin you're hosting FinPlan at, e.g.
   `https://yourname.github.io` (no trailing slash, no path).
5. Copy the generated **Client ID** (looks like
   `123456-abc.apps.googleusercontent.com`).
6. In FinPlan, go to **Settings → Google Drive backup**, paste the Client
   ID, and click **Connect Google Drive**. Approve the Google sign-in
   prompt.
7. Click **Backup now** any time to save a timestamped JSON snapshot to your
   Drive, or **Restore…** to pick a previous one and load it back in.

The Client ID is remembered automatically in this browser (via the "Auto-save
to this browser" setting), so you shouldn't need to re-paste it each time you
reopen the app — but you will need to sign in to Google again each fresh
session, since the sign-in token itself isn't saved for security reasons.

---

## Part 3 — Auto backup (optional)

Once Google Drive is connected (Part 2), or once you've picked a local
folder, you can turn on **Auto backup** in Settings so you don't have to
remember to back up manually:

- **Auto-backup to Google Drive** — keeps one file,
  `finplan_autobackup.json`, continuously updated in your Drive: a few
  seconds after any change, and again every 15 minutes as a safety net.
- **Auto-backup to a local folder** — click "Choose backup folder" once
  (Chrome/Edge on desktop only — this uses the File System Access API,
  which most mobile browsers don't support yet), and FinPlan keeps
  `finplan_autobackup.json` updated there directly, no repeated download
  prompts.

Both only run while the tab/app is open — browsers don't allow background
work after you close it — and neither is saved across sessions by design
(you'll reconnect Drive or re-pick the folder next time you open the app),
so treat them as a convenience on top of, not a replacement for, occasional
manual exports.

---

## Updating the app later

If you edit or replace `finplan.html` on your hosting after installing it as
an app, Android/Chrome may keep serving the old cached version for a while
because of the service worker. Two ways to force the update:
- Bump the `CACHE_NAME` version string at the top of `sw.js` (e.g.
  `finplan-shell-v2` → `v3`) whenever you update the app — this makes the
  service worker discard the old cache and fetch everything fresh.
- Or simply uninstall and reinstall the app / do a hard refresh
  (Chrome menu → "Reload" while holding Shift, or clear site data).

---

## Privacy note

Both features are designed to preserve FinPlan's original local-first
promise:
- The service worker only ever caches the app's own code/icons — never your
  financial data.
- Google Drive backup uses the `drive.file` scope, so the app can only see
  files it created — not your whole Drive.
- Your transactions, goals, and assets are never sent to any third party or
  server other than the Google Drive file you explicitly choose to back up
  to.
