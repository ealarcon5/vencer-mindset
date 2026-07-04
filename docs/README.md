# 🎆 Monmouth–Independence 4th of July Parade — Float Voting

A single-file website where parade-goers vote for their favorite floats. Three
categories, a live **Top 3** leaderboard for each, patriotic red/white/blue
theme. Works great on phones.

**Live site:** https://ealarcon5.github.io/vencer-mindset/

## What it does
- **3 categories:** Most Patriotic 🇺🇸, Most Creative 🎨, Crowd Favorite ⭐
- **One shared list of floats**, judged under all three categories — every
  category keeps its own separate Top 3 tally
- Tap a float to vote — **one pick per category** (tap again to change/remove)
- Live **Top 3 podium** (🥇🥈🥉) per category with vote bars
- Votes are saved in the visitor's browser (`localStorage`) so the same phone
  can't stuff the ballot

## Add or edit floats (the only list you touch)
Open `index.html` and edit the `FLOATS` array near the top of the `<script>`
block. Each float is one line:

```js
{ id:"monfit", name:"Monmouth Fitness Club", org:"Monmouth Fitness Club", emoji:"💪" }
```

Give every float a **unique `id`**. Add as many as you want — they show up in
all three categories automatically.

## Turn on the live site (one time, ~30 seconds)
On GitHub: **Settings → Pages → Build and deployment**
- **Source:** Deploy from a branch
- **Branch:** `claude/parade-float-voting-site-sap917`  ·  **Folder:** `/docs`
- **Save**

In about a minute the site is live at
`https://ealarcon5.github.io/vencer-mindset/`. Only the `/docs` folder is
published — the rest of the repo stays private to visitors.

## Note on vote totals
This version tallies votes **per device** (in the browser) — perfect for a
kiosk/tablet at a booth, or a fun per-visitor tally. For **one shared, combined
count across everyone's phones**, it needs a small backend (a free Firebase
Realtime Database or a Google Sheet + Apps Script). Ask Claude to wire it in.
