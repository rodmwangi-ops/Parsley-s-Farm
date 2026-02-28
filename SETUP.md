# Parsley's Farm — Setup Guide

## Overview
This guide will help you deploy your farm management app with:
- **Google Sign-In** (so you, Joel, and Joshua can each log in)
- **Google Sheets backend** (all data synced to a spreadsheet you control)
- **GitHub Pages hosting** (free, accessible from anywhere)
- **Works offline** (service worker caches the app, IndexedDB stores data locally)

**Time needed:** ~30 minutes, one-time setup.

---

## Step 1: Create a Google Sheet

1. Go to **https://sheets.google.com**
2. Click **+ Blank** to create a new spreadsheet
3. Rename it to **"Parsley's Farm Data"**
4. **Copy the Sheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/THIS_PART_IS_YOUR_SHEET_ID/edit
   ```
5. Save this ID — you'll need it in Step 4

**Don't create any tabs manually** — the app will create them automatically (Beds, Sales, Harvests, Expenses, Activities, CreditPayments, Crops).

---

## Step 2: Set Up Google Cloud Project

This gives your app permission to access Google Sheets on behalf of signed-in users.

1. Go to **https://console.cloud.google.com**
2. Sign in with **rodmwangi@gmail.com**
3. Click the project dropdown (top left) → **New Project**
4. Name: **"Parsley Farm"** → Click **Create**
5. Make sure this project is selected in the dropdown

### Enable Google Sheets API:
6. Go to **APIs & Services → Library** (left sidebar)
7. Search **"Google Sheets API"**
8. Click it → Click **Enable**

### Configure OAuth Consent Screen:
9. Go to **APIs & Services → OAuth consent screen**
10. Choose **External** → Click **Create**
11. Fill in:
    - App name: **Parsley's Farm**
    - User support email: **rodmwangi@gmail.com**
    - Developer email: **rodmwangi@gmail.com**
12. Click **Save and Continue** through the remaining steps
13. On the **Test users** page, add:
    - **rodmwangi@gmail.com**
    - Joel's Gmail (when he has one)
    - Joshua's Gmail (when he has one)
14. Click **Save**

### Create OAuth Client ID:
15. Go to **APIs & Services → Credentials**
16. Click **+ Create Credentials → OAuth client ID**
17. Application type: **Web application**
18. Name: **Parsley Farm Web**
19. Under **Authorized JavaScript origins**, add:
    - `https://YOUR_GITHUB_USERNAME.github.io`
    - `http://localhost:8000` (for local testing)
20. Click **Create**
21. **Copy the Client ID** — it looks like: `123456789-xxxxx.apps.googleusercontent.com`

---

## Step 3: Create GitHub Repository

1. Go to **https://github.com** and sign in
2. Click **+** → **New repository**
3. Name: **parsleys-farm** (or whatever you prefer)
4. Make it **Public** (required for free GitHub Pages)
5. Click **Create repository**

### Upload the files:
6. Click **"uploading an existing file"** link
7. Drag and drop ALL the project files:
   ```
   index.html
   manifest.json
   sw.js
   js/config.js
   js/auth.js
   js/db.js
   js/sync.js
   icons/icon-192.svg
   icons/icon-512.svg
   ```
8. Click **Commit changes**

### Enable GitHub Pages:
9. Go to **Settings** → **Pages** (left sidebar)
10. Under **Source**, select **Deploy from a branch**
11. Branch: **main**, folder: **/ (root)**
12. Click **Save**
13. Wait 1-2 minutes, then visit: `https://YOUR_USERNAME.github.io/parsleys-farm/`

---

## Step 4: Configure the App

1. In your GitHub repo, click on **js/config.js**
2. Click the **pencil icon** (edit) 
3. Replace these values:

```javascript
GOOGLE_CLIENT_ID: 'YOUR_ACTUAL_CLIENT_ID.apps.googleusercontent.com',
SHEET_ID: 'YOUR_ACTUAL_SHEET_ID',
```

4. Click **Commit changes**
5. Wait 1-2 minutes for GitHub Pages to rebuild

---

## Step 5: Test It

1. Go to your app URL: `https://YOUR_USERNAME.github.io/parsleys-farm/`
2. Click **Sign in with Google**
3. Sign in with **rodmwangi@gmail.com**
4. The app will:
   - Create all tabs in your Google Sheet automatically
   - Start syncing data
   - Show the green sync indicator in the top bar
5. Check your Google Sheet — you should see tabs: Beds, Sales, Harvests, etc.

---

## Step 6: Add Team Members

When Joel and Joshua have Google accounts:
1. **Share the Google Sheet** with their email addresses (Viewer or Editor)
2. Add their emails to the **Google Cloud Console → OAuth consent screen → Test users**
3. Edit `js/config.js` on GitHub to add their emails to `ALLOWED_USERS`
4. Give them the app URL — they sign in with their own Google account

---

## How It Works

### Data Flow:
```
Joel records a sale on his phone
    ↓
Saved to IndexedDB (instant, works offline)
    ↓
Synced to Google Sheets (when online, every 60 seconds)
    ↓
Rod opens the Google Sheet from Wyoming and sees the sale
    ↓
OR Rod opens the app and pulls the latest data
```

### Offline Mode:
- If there's no internet, the app works normally
- All changes are saved locally in IndexedDB
- When internet returns, changes push to Google Sheets automatically
- Click the sync indicator in the top bar to force a sync

### Data Safety:
- **IndexedDB** = local copy on each device
- **Google Sheets** = cloud backup you control
- **Both are always in sync** when online
- Even if Joel clears his browser, the data is safe in Google Sheets

---

## Troubleshooting

### "Access denied" after signing in
- Make sure the email is in `ALLOWED_USERS` in config.js
- Make sure the email is added as a Test user in Google Cloud Console

### "Sign in" button doesn't appear
- Check that `GOOGLE_CLIENT_ID` is correct in config.js
- Make sure your GitHub Pages URL is in the Authorized JavaScript origins

### Sync not working
- Check the sync indicator (top bar) — click it to force sync
- Make sure the Google Sheet is shared with the signed-in user
- Check browser console (F12) for error messages

### App doesn't load offline
- Visit the app while online first (to cache it)
- The service worker needs one initial online visit to cache all files

---

## Local Development (Optional)

To test locally before deploying:
```bash
cd parsleys-farm
python3 -m http.server 8000
```
Then open `http://localhost:8000` in your browser.

Make sure `http://localhost:8000` is in your OAuth authorized origins (Step 2, #19).

---

## Migrating Existing Data

If you have data from the old artifact version (farm_app_v3.html):
1. Open the old version and export/note your data
2. The app will attempt to auto-migrate data from the old `window.storage` format
3. After migration, your data will be in IndexedDB and will sync to Sheets on first sign-in

---

## Version
- App: v3.1.0
- Architecture: GitHub Pages + Google Sheets API + IndexedDB + Service Worker
- Built for: Parsley's Farm, Kajiado County, Kenya (2.6 acres)
