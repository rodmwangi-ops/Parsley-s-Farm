# Setting up Parsley's Farm v6

Allow about 45 minutes. You need a laptop, your GitHub account, and a Supabase account. Do the steps in order.

**Before you start:** this version uses a **new, empty Supabase project**. Don't reuse the old one. Phones running the old app still hold unsent records, and they would push those stale records into the new database. A new project gives the app a new address, so that can't happen.

---

## Part 1. Create the database (Supabase)

### 1.1 Make a new project
1. Go to https://supabase.com/dashboard and sign in.
2. Click **New project**.
3. Name it `parsleys-farm-v6`. Create a strong database password and save it somewhere safe (you'll rarely need it).
4. For the region, pick the one closest to Kenya from the list.
5. Click **Create new project** and wait 1 to 2 minutes for it to finish.

### 1.2 Build the tables
1. In the left menu, open **SQL Editor** and click **New query**.
2. Open `supabase/01_schema.sql` from this folder in a text editor. Copy all of it, paste it into the editor, and click **Run**.
   You should see "Success. No rows returned". Messages starting with "NOTICE" are normal.
3. Click **New query** again. Paste all of `supabase/02_seed.sql` and click **Run**.
   This loads today's farm: 206 beds, the crops, the blocks, the greenhouse, the regular bills and the products.
4. Open `supabase/03_first_admin.sql` in a text editor and change three things:
   - Replace `ROD-EMAIL@example.com` with your email.
   - Replace `LORNA-EMAIL@example.com` with Mum's email. If you don't have it yet, delete her whole statement, from `insert` down to the semicolon.
   - Replace `KIPCHOGE-EMAIL@example.com` with Kipchoge's email. If you don't have it yet, delete his whole statement, from `insert` down to the semicolon.
   - Replace `0000` with the PIN you want for the Expenses screen.
   Paste the edited file into a new query and click **Run**.

To check it worked: open **Table Editor**, then the **beds** table. You should see 206 rows.

### 1.3 Turn on sign-in by email code
1. Left menu: **Authentication** → **Sign In / Providers**. Make sure **Email** is enabled.
2. **Authentication** → **Emails** (on some dashboards, **Email Templates**) → **Magic Link**. Replace the message body with:

   ```
   <h2>Your Parsley's Farm sign-in code</h2>
   <p>Your code is: <strong>{{ .Token }}</strong></p>
   <p>Or tap this link to sign in: <a href="{{ .ConfirmationURL }}">Sign in to Parsley's Farm</a></p>
   ```

   Click **Save**. Do the same for the **Confirm signup** template, so a person's very first sign-in also shows the code.
   The code matters because a link from the email can open in the phone's browser instead of the installed app. Typing the code always works.
3. **Authentication** → **URL Configuration**:
   - **Site URL:** your app's address, for example `https://YOUR-GITHUB-NAME.github.io/Parsley-s-Farm/`
   - **Redirect URLs:** add the same address.
   Click **Save**.

Supabase's built-in email service only sends a few emails per hour. That's fine for a small team. If codes stop arriving, wait an hour, or set up your own email sender under **Authentication** → **Emails** → **SMTP**.

### 1.4 Copy the two settings the app needs
1. **Project Settings** (gear icon) → **API**. On newer dashboards this is **API Keys**, and the anon key is under a **Legacy API keys** tab.
2. Copy the **Project URL** (it looks like `https://abcdxyz.supabase.co`).
3. Copy the **anon public** key (a long string starting with `eyJ`).
4. Open `js/config.js` in a text editor and paste them between the quotes:

   ```js
   SUPABASE_URL: 'https://abcdxyz.supabase.co',
   SUPABASE_ANON_KEY: 'eyJhbGciOi...',
   ```

   Save the file. The anon key is meant to be public. The database rules decide who can read and change what. **Never** put the `service_role` key in the app.

---

## Part 2. Put the app online (GitHub)

Your app already lives in the GitHub repository `Parsley-s-Farm`, published with GitHub Pages. You'll replace its files with this version.

### 2.1 Upload the new files
1. Open your repository on github.com.
2. Click **Add file** → **Upload files**.
3. Drag in everything from this folder: `index.html`, `sw.js`, `manifest.json`, `README.md`, `SETUP.md`, `_config.yml`, and the folders `css`, `js`, `icons`, `supabase` and `tools`.
   (The `.well-known` folder is already in your repository. Leave it as it is. It links the Android app.)
4. Write a message such as "Version 6: fresh start" and click **Commit changes**.

### 2.2 Delete the old files
These belong to the old app and are no longer used. Open each one on GitHub, click the **⋯** menu → **Delete file**, then commit:
- `js/auth.js`
- `js/db.js`
- `js/sync.js`
- `FINAL_SUPABASE_MIGRATION.sql`

### 2.3 Check GitHub Pages
**Settings** → **Pages**: the source should be **Deploy from a branch**, branch `main`, folder `/ (root)`. Wait 1 to 2 minutes after committing, then open your app's address.

---

## Part 3. First sign-in

1. On your phone, **remove the old app first**: long-press its icon → Remove/Uninstall. If you open the old app in a browser, close that tab too.
2. Open your app's address in Chrome (Android) or Safari (iPhone).
3. Enter your email and tap **Send code**. Type the 6-digit code from the email and tap **Sign in**.
4. The farm loads. Add it to your home screen:
   - **Android:** Chrome menu ⋮ → **Add to Home screen**
   - **iPhone:** Share button → **Add to Home Screen**
5. Open the app from the new icon and sign in once more there. After that, it stays signed in.

If you see "Not on the farm list yet", the email you typed doesn't exactly match the one in step 1.2.4. Fix it in Supabase: **Table Editor** → **people**.

---

## Part 4. Add everyone else

In the app: **More** → **People and access**. Enter each person's name and email and pick a role:

| Role | Can do |
|---|---|
| Admin | Everything, including money and people. For you and Lorna |
| Supervisor | Field records, edit beds, sales, add expenses. For the new manager |
| Checker | Field records and edit beds. For Kipchoge; the Add expenses switch is already on for him |
| Family | View everything, including money. For Levi |
| Farm hand | Field records only. For Joel and Joshua |

You can switch individual permissions on or off under each person. Then send each of them the app's address. They sign in with their own email, the same way you did.

---

## Part 5. Quick check (10 minutes)

- [ ] **Map:** both farms show. Joshua's Block B beds 5–7 say "Day … · Vegetative".
- [ ] **Edit a bed:** tap one bed → **Bed details** → change the note → **Save changes**. The button at the top briefly shows "Saving…", then "All saved".
- [ ] **Offline:** turn on airplane mode and record a note on a bed. The top button turns amber and says "1 waiting". Turn airplane mode off and it goes back to "All saved".
- [ ] **Expenses:** the PIN unlocks it. Add a small test expense, then open it and delete it.
- [ ] **Bills:** **Mark paid** on Rent, then **Undo**.
- [ ] **Reports:** **Expenses** → **Reports** → **Download spreadsheet**.
- [ ] **Another phone:** a change made on one phone appears on the other within a minute, or straight away after reopening the app.

---

## Fixing problems

| What you see | What to do |
|---|---|
| The top button is red and says "… not saved" | Tap it. The message from the server explains why, usually missing permission. Fix the person's permissions, then tap **Try again**. |
| The code email doesn't arrive | Check spam. Wait a few minutes. Supabase's free email has a low hourly limit. |
| The app still looks like the old one | Close it fully and reopen it. If that doesn't help, remove the home-screen icon and add it again. |
| "Connect once to load the farm" | The phone needs signal the first time. After that it works offline. |
| You forgot the Expenses PIN | An admin can set a new one: **More** → **Change expenses PIN**. |

## Changing things later
- **Crops, colours, stages and feeding days:** More → Crops and calendar
- **Products** (active ingredient, waiting days before harvest): More → Products
- **Rent and salaries:** Expenses → Edit regular bills
- **Greenhouse beds:** tap the greenhouse on Joel's map
- **Starting data:** `js/seed-data.js` only matters for the first setup and demo mode. After setup, everything is edited in the app.
