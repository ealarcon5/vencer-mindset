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

## Shared voting (everyone's votes combined, live)
The site has two modes, and it switches automatically:

- **Preview mode (default):** votes are saved on each device. Good for a
  kiosk/tablet or a personal try-out.
- **Live mode:** every phone reads/writes one shared database, so votes combine
  and update in **real time** for everyone. A pill in the header shows which
  mode is active.

### Turn on Live mode — free Firebase, ~2 minutes (one time)
1. Go to **console.firebase.google.com** → **Add project** (any name) → skip
   Google Analytics → Create.
2. In the left menu: **Build → Realtime Database → Create Database** →
   pick a location → start in **Test mode** → Enable.
3. Back on the project **Overview**, click the **web icon `</>`** to add a web
   app (any nickname, no hosting needed). Firebase shows a `firebaseConfig`
   block — copy those values.
4. Open `docs/index.html`, find `FIREBASE_CONFIG` near the top of the
   `<script>`, and paste in your `apiKey`, `authDomain`, `databaseURL`, and
   `projectId`. Save and push.

That's it — the header pill flips to **"Live — everyone's votes combined."**
(You can also just paste the values here and ask Claude to drop them in.)

> Test mode leaves the database open for 30 days, which is fine for parade day.
> For anything longer, tighten the Realtime Database rules afterward.
