# 🎆 Monmouth–Independence 4th of July Parade — Float Voting

A single-file website where parade-goers vote for their favorite floats. Three
categories, live **Top 3** leaderboard for each, patriotic red/white/blue theme.
Works great on phones.

## What it does
- **3 categories:** Most Patriotic 🇺🇸, Most Creative 🎨, Crowd Favorite ⭐
- Tap a float to vote — **one pick per category** (tap again to change or remove it)
- Each category shows a **live Top 3 podium** (🥇🥈🥉) with vote bars
- Votes are saved in the visitor's browser (`localStorage`), so the same phone
  can't stuff the ballot

## How to run it
It's just one file — no build step, no server needed.
- **Locally:** open `index.html` in any browser.
- **Publish free (GitHub Pages):** put this folder in a repo, enable Pages, and
  share the link / a QR code with the crowd.

## Customize your floats
Open `index.html` and edit the `CATEGORIES` array near the top of the `<script>`
block. Each float is just:

```js
{ id:"p1", name:"Stars & Stripes Express", org:"Independence Rotary Club", emoji:"🎇" }
```

Change the names, orgs, and emojis to match this year's real entries. Give every
float a **unique `id`**. You can add or remove floats and categories freely.

## Note on vote totals
This version tallies votes **per device** (in the browser). That's perfect for a
kiosk/tablet at a booth, or a fun per-visitor tally. If you want **one shared,
combined count across everyone's phones**, it needs a small backend — a free
Firebase Realtime Database or a Google Sheet + Apps Script both work. Ask Claude
to wire that in and it can swap the `load`/`save`/`castVote` functions over.
