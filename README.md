# Brigade 2026 Leaderboard

Live troop standings for Nissi Academy Inc. Converted from PHP + MySQL to:

| Part | Tech | Hosted on |
| --- | --- | --- |
| `client/` | React, Vite, Tailwind CSS, Lucide icons | Vercel |
| `server/` | Node.js, Express | Render |
| Database | PostgreSQL | Neon |
| Code | Git | GitHub |

- **Public page** (`/`): live standings, scores by game, recent points, merit and demerit guide. Refreshes every 10 seconds.
- **TV view** (`/tv`): every team as a card on one screen, with total, each game, merit and demerit. No scrolling.
- **Judge page** (`/judge`): each judge signs in with their own code and scores events like Mr. and Ms. or Flag Making on a phone or tablet.
- **Organizer page** (`/admin`): sign in with a password, add merit, demerit or game points, undo mistakes.

## What changed from the old system

- **Organizer login.** The old `add_score.php` had no password, so anyone with the link could change scores. `/admin` now needs `ADMIN_PASSWORD`.
- **Undo.** Every change is logged. Wrong entry? Tap Undo and the points go back.
- **Recent points feed** on the public page, so troops can see awards as they happen.
- **Quick buttons** for every merit and demerit in the guide (edit them in `server/src/rules.js`).
- **Same scoring.** Total = merit − demerit + all game scores, exactly like before. Points still add up (adding 10 to a game that has 30 makes 40).
- Title now says 2026. The old page said 2025.

## Judged events (Mr., Ms., Flag Making)

For events scored by judges instead of typed in by an organizer:

1. Open `/admin`, then the **Judging** tab. Add each judge by name. A code like `K7QM-4XD2` appears **once**. Give it to that judge. (Lost it? Use **Reset code**.)
2. Click **New judged event**, name it (for example `Mr. Brigade`), set the criteria and the maximum points for each, and choose the judges. There are sample criteria buttons to start from, and **Copy as new event** makes `Ms. Brigade` from `Mr. Brigade` in two clicks.
3. Click **Open for judging**. Judges go to `https://YOUR-SITE.vercel.app/judge`, type their code, and score every troop on every criterion. Scores save as they type. They press **Submit final scores** when done.
4. Watch the totals arrive on the Judging tab. When enough judges have submitted, click **Publish results**.

How the score is worked out: each judge's scores for a troop are added up, then the troops' totals are averaged across the judges who submitted, and rounded to a whole number. That number becomes the troop's score for that game on the leaderboard and TV view, exactly like any other game.

Good to know:
- Nothing shows publicly until you publish. **Reopen scoring** takes it off the leaderboard again.
- A judged game can't be typed in by hand on the Add points tab.
- **Allow edit** lets one judge change their scores after submitting.
- Judge codes are tied to `JWT_SECRET`. If you ever change that, reset the judges' codes.
- **Already deployed?** Run `npm run db:init` again (or paste `server/db/schema.sql` into Neon's SQL Editor). It only adds the new judging tables and erases nothing.

## Show it on a TV

1. Open `https://YOUR-SITE.vercel.app/tv` in the browser on the computer that is plugged into the TV (or tap **TV view** at the top of the leaderboard).
2. Press **F11**, or click the full-screen button at the top right.
3. Leave it open. It refreshes every 8 seconds and shows the latest award along the bottom.

It fits 4 to 6 teams side by side, and wraps to two rows if you ever have 7 or more. Set the TV or projector to 1920x1080 (or 1280x720); the cards resize to match.

## Run it on your computer

You need Node 20+ and a Postgres database (a free Neon one works, see below).

```bash
# 1. API
cd server
cp .env.example .env        # fill in DATABASE_URL, ADMIN_PASSWORD, JWT_SECRET
npm install
npm run db:init             # creates tables and the 5 troops / 6 games
npm run dev                 # http://localhost:4000

# 2. Website (second terminal)
cd client
npm install
npm run dev                 # http://localhost:5173  (admin: /admin)
```

## Deploy

Do these in order. The first three give you the two URLs the next step needs.

### 1. GitHub
Create a new repository (for example `brigade2026`) and push this whole folder, so `client/` and `server/` sit side by side.

### 2. Neon (database)
1. Create a project at neon.tech.
2. Copy the **connection string** (it ends with `?sslmode=require`).
3. Create the tables, either way:
   - On your computer: put the string in `server/.env` as `DATABASE_URL`, then run `npm run db:init`.
   - Or open Neon's **SQL Editor**, paste the contents of `server/db/schema.sql`, and run it.

### 3. Render (API)
1. **New > Web Service**, pick your GitHub repo.
2. Settings: **Root Directory** `server`, **Build Command** `npm install`, **Start Command** `npm start`, **Health Check Path** `/api/health`.
3. Environment variables:
   - `DATABASE_URL`: your Neon string
   - `ADMIN_PASSWORD`: the password organizers will type
   - `JWT_SECRET`: any long random text (for example the output of `openssl rand -hex 32`)
   - `CLIENT_ORIGIN`: leave as a placeholder for now, you will set it in step 5
4. Deploy, then copy the URL, like `https://brigade2026-api.onrender.com`.

(`render.yaml` in this folder does the same thing if you prefer a Blueprint.)

### 4. Vercel (website)
1. **Add New > Project**, pick the same GitHub repo.
2. Set **Root Directory** to `client`. Vercel detects Vite on its own.
3. Add the environment variable `VITE_API_URL` = your Render URL (no trailing slash).
4. Deploy and copy the Vercel URL.

### 5. Connect them
Back in Render, set `CLIENT_ORIGIN` to your Vercel URL (for example `https://brigade2026.vercel.app`) and let it redeploy. Without this, the browser blocks the website from talking to the API.
To also allow Vercel preview deployments, add a second value: `https://brigade2026-*.vercel.app` (comma separated).

Open your Vercel URL for the leaderboard, and add `/admin` to sign in.

## Good to know

- **Render's free plan sleeps** after about 15 minutes without visits, and the first load afterwards can take up to a minute. The site shows a "waking up" note. Before the event, open the site once, or have a free uptime monitor (such as UptimeRobot) ping `https://YOUR-API.onrender.com/api/health` every 5 minutes.
- **Old data.** Every score in the old MySQL dump was 0, so nothing needed migrating. The new database starts with the same 5 troops and 6 games.
- **Add, rename or delete a game, and edit merits and demerits:** open `/admin`, then the **Games & guide** tab. The public page and TV pick the changes up on their own.
- **Add a troop:** open Neon's SQL Editor and run `INSERT INTO troops (troop_name) VALUES ('Foxtrot');`.
- **Placement points (200, 180, ...):** edit `PLACEMENT_SCALES` in `server/src/rules.js`.
- **Careful:** running `npm run db:init` again adds back any default game you deleted.
- **Reset for a new year:** in the SQL Editor run `TRUNCATE point_log; UPDATE troops SET merit_points = 0, demerit_points = 0; UPDATE scores SET score = 0;`
