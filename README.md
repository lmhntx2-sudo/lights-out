# Lights Out

A formula racing career life simulator for the browser, in the spirit of FootLife.
You start with a battered kart at eight, climb through Formula 4, 3 and 2, and see how
far you get in Formula 1. Every race can throw up a decision: safety car calls, team
orders, last-lap lunges, sponsors, rivals, contracts, money and life off track.

Plain HTML, CSS and JavaScript, with no framework and no build step. The game runs
entirely in the browser and works offline. The only backend is the optional global
leaderboard, a single Netlify Function.

What's in it: a race number you pick, team liveries, an F1-broadcast-style timing tower,
Race Control banners, team targets each season, podium and championship celebrations,
an all-time records table against fictional legends, shareable career-card images,
achievements, a daily challenge, seeds you can share, a global leaderboard, optional
sound effects, and a "Fuel the dev" tip jar.

## Play locally

```bash
npm install   # only needed for the global leaderboard
npm start
```

Then open http://localhost:5173. Opening `index.html` straight from disk won't work,
because browsers block JavaScript modules on `file://` pages.

## Global leaderboard

At retirement, players can submit their career under a display name. There are two
boards: the top 100 careers of all time by legacy score, and one board per daily
challenge, where meeting the day's goal ranks above any score that missed it.

Nobody can just post a score. The game records the setup and every button press in the
save (`s.setup` and `s.log`, about 800 short entries per career). The function at
`/api/leaderboard` replays the whole career with the same engine and only accepts it if
it ends in retirement with the score the player claimed. It also rejects anything the
game's buttons couldn't have done, like buying a seat the driver can't afford or forging
a daily challenge.

Abuse protection:

- Display names: 2 to 20 characters, letters (any script), numbers, spaces and basic
  punctuation, checked against a small profanity list in `netlify/lib/blocklist.mjs`.
- At most 5 submissions per 10 minutes and 30 a day from one IP address. Only a salted
  hash of the IP is stored. The salt is random and kept in the blob store, or set
  `LEADERBOARD_SALT` in Netlify's environment variables to choose it.
- Request bodies over 100 KB and logs over 12,000 actions are refused.
- Submitting the same career twice changes nothing.

Data lives in Netlify Blobs, in a store called `leaderboard`. Deploy previews, branch
deploys and local runs each use their own store (`leaderboard-deploy-preview` and so on),
so testing never touches the real board. Reads are cached on Netlify's CDN for 30 seconds,
and each new submission purges that cache.

Moderation: list the boards and take a career off for good with

```bash
NETLIFY_AUTH_TOKEN=your-personal-access-token node tools/leaderboard-admin.mjs list
NETLIFY_AUTH_TOKEN=your-personal-access-token node tools/leaderboard-admin.mjs remove <entry id>
```

Add `--local` to work on the data from `npm start` instead (kept in `tmp/blobs`).

Locally, `npm start` runs the real function against Netlify's own local Blobs server, so
you can submit careers and see the boards without deploying. `netlify dev` works too.

If you change how the engine plays out (events, odds, balance), careers that were in
progress when the change went live replay differently on the server and get refused.
Careers started after the change are fine. Text-only changes are safe. To add content
without breaking careers in progress, bump `CONTENT_VERSION` in `js/engine/constants.js`
and gate the new content on `contentVersion(s)`: every career keeps the version it
started with (`s.setup.cv`, missing means 1), and the server replays it with that version.

## Set up donations ("Fuel the dev")

Amounts are in Hong Kong dollars: HK$30, HK$50, HK$100 and HK$200. Edit `js/config.js` and
fill in any of these payment methods. Each one you fill in shows up in the donation window,
with a switcher when there is more than one.

- **Card (Stripe)**: put a Stripe payment page in `methods.card.url`, or give each amount its
  own Stripe Payment Link in `tiers[].stripe`.
- **PayPal**: put your PayPal.me name in `methods.paypal.me`. Each amount card then opens
  `paypal.me/yourname/50HKD` and so on, with the amount filled in. Any other PayPal link
  can go in `methods.paypal.url`.
- **PayMe**: save your QR code as `assets/donate-qr.png` and set
  `methods.payme.qr: 'assets/donate-qr.png'`. Your `payme.hsbc` link can go in
  `methods.payme.url` for people on their phones.
- **Buy Me a Coffee**: `methods.bmc.url` (currently a placeholder).
- `nudgeCooldownDays`: the game shows a small, dismissable coffee reminder after a first
  Grand Prix win or a world title, at most once per this many days. Supporters never see it.

Until at least one method is filled in, the donation window says the tip jar opens soon
and the reminders stay off. On localhost it also shows a red note so you don't forget.

Where the donation prompt appears:

- a "Fuel the dev" button on the title screen and in the in-game header
- the retirement screen, at the end of every career
- the gentle reminder after big moments (above)

Supporters can claim a gold helmet ring, gold and chrome helmet colours and the
"Pit crew" achievement. Payments can't be verified without a backend, so this is an
honour system.

## Deploy

The game is a static site, but the global leaderboard needs Netlify (Functions and Blobs).

- **Netlify**: connect the repo or deploy with the Netlify CLI. `netlify.toml` has the build
  command (`node tools/build.mjs`, which copies the site into `dist/`), the publish folder
  and the function settings. Drag-and-drop deploys don't include functions, so the
  leaderboard won't work with those.
- **Anywhere else** (Vercel, GitHub Pages): deploy the project root as a static site. The
  game works; the leaderboard buttons just say it isn't available.

## Develop

```bash
npm test                     # plays 120+ full careers headless, checks invariants and the leaderboard
node tools/balance.mjs 80    # outcome stats per background, for tuning difficulty
```

The leaderboard tests replay recorded careers, check that tampered logs are refused, and
run the real function against a local Blobs server (that one is skipped until
`npm install` has been run).

Where things live:

| Path | What it is |
| --- | --- |
| `js/engine/events.js` | Every decision moment. Add new events here. |
| `js/data/teams.js` | Teams, colours, academies (all fictional). |
| `js/data/tracks.js` | Circuits and calendars. |
| `js/data/nations.js` | Playable nationalities, home races, sponsor markets. |
| `js/engine/constants.js` | Series, backgrounds, driving styles, training. |
| `js/engine/market.js` | Contracts, offers, AI careers, car development. |
| `js/engine/achievements.js` | Achievements. |
| `js/engine/replay.js` | Rebuilds a career from its setup and action log, for the leaderboard. |
| `js/ui/` | Title screen, game screen, dialogs, donations. |
| `js/i18n.js` | Languages: English and 繁體中文 (Traditional Chinese). |
| `js/engine/events.zh.js` | Chinese words for every event, keyed by event id. |
| `js/lang/zh.js`, `js/lang/zh.data.js` | Chinese for the interface, and names of tracks, nations, achievements and so on. |
| `js/api.js` | The browser side of the global leaderboard. |
| `netlify/functions/leaderboard.mjs` | The leaderboard function (`/api/leaderboard`). |
| `netlify/lib/` | Leaderboard logic and the name blocklist. Not shipped to players. |

The same seed plus the same choices always replays the same career, in either language.

## Languages

The game is in English and 繁體中文, written for Hong Kong and Taiwan players. It starts in
繁體中文 when the browser's language is zh-HK, zh-TW, zh-MO or zh-Hant, and in English
otherwise. Players switch on the title screen or in Settings. Place names follow the
browser's region where Hong Kong and Taiwan spell them differently (意大利 or 義大利).

English text is the key for its own translation. When you add or change an event, add its
Chinese to `js/engine/events.zh.js` with the same choices in the same order; for any other
text, run `node tools/i18n-keys.mjs --missing` to list what still needs Chinese.
`npm test` fails if something is missing, so a new event cannot ship half-translated.

The social preview image (`assets/og.png`) and app icons were drawn in the browser and saved
through the local dev server's `/__save/` endpoint, which only exists in `tools/serve.mjs`.

## Credits

Flag emoji are from [Twemoji](https://github.com/jdecked/twemoji), licensed CC-BY 4.0,
packaged as a font by [country-flag-emoji-polyfill](https://github.com/talkjs/country-flag-emoji-polyfill)
(MIT). The typeface is Saira, served by Google Fonts.

All teams, drivers and sponsors are fictional. This is a fan-made game and isn't affiliated
with Formula 1, the FIA or any team.
