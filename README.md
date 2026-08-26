# Circle of Excellence — Digital Nomination System

This is the real, deployable version of the prototype — connected to your live Supabase
database instead of temporary chat storage, with real email/password sign-in for every
department account.

## What's in this folder

- `src/App.jsx` — the whole app (New Nomination, P&C Queue, GM Selection, Dashboard)
- `src/Login.jsx` — sign-in screen
- `src/db.js` — talks to your `nominations` table in Supabase
- `src/supabaseClient.js` — reads your Supabase URL/key from environment variables
- `.env.example` — shows the two values you need to set (never commit a real `.env` file)

## Step 1 — Upload this folder to your GitHub repository

You do **not** need to install Git or use the command line.

1. Go to your repository: `https://github.com/<your-username>/circle-of-excellence`
2. Click **"Add file" → "Upload files"**
3. Drag every file and folder from this project into the upload box
   (make sure the `src` folder goes in as a folder, not flattened)
4. Scroll down and click **"Commit changes"**

## Step 2 — Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign up using your GitHub account
2. Click **"Add New" → "Project"**
3. Select your `circle-of-excellence` repository and click **"Import"**
4. Before clicking Deploy, open **"Environment Variables"** and add two:
   - `VITE_SUPABASE_URL` → your Project URL from Supabase (Settings → API)
   - `VITE_SUPABASE_ANON_KEY` → your `anon public` key from the same page
5. Click **"Deploy"**

After a minute or two you'll get a real link like `circle-of-excellence.vercel.app` —
that's the one you send to your 13 department accounts.

## Step 3 — Test it

Sign in with one of the 13 accounts you already created in Supabase
(e.g. `frontoffice.head@coe.internal`) and try submitting a nomination, forwarding it as
P&C, and selecting a winner as the General Manager — using three different accounts in
three browser tabs (or one private/incognito window per role) so you can see the full
chain end to end.

## Notes

- Every time you push new changes to the `main` branch on GitHub, Vercel redeploys
  automatically — no extra steps needed.
- If someone resigns, you don't need to touch this code at all: just reset their
  password in Supabase (Authentication → Users) and hand the same login to their
  replacement.
