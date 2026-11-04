# Lights Out

A formula racing career life simulator for the browser, in the spirit of FootLife.
You start with a battered kart at eight, climb through Formula 4, 3 and 2, and see how
far you get in Formula 1. Every race can throw up a decision: safety car calls, team
orders, last-lap lunges, sponsors, rivals, contracts, money and life off track.

Plain HTML, CSS and JavaScript, with no framework and no build step. The game runs
entirely in the browser and works offline. The only backend is two small Netlify
Functions: the optional global leaderboard and an anonymous play counter.

What's in it: a race number you pick, team liveries, an F1-broadcast-style timing tower,
Race Control banners, team targets each season, podium and championship celebrations,
short 3D cutscenes for the biggest moments,
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

## Play stats

To show how many people play, the game sends three events to `/api/stats`: the game
was opened, a career started, a career finished. Each event carries only a random id
made in that browser (kept in localStorage, never in backups), so the counter can count
people rather than page loads. The server keeps a salted hash of that id and nothing
else about the player. Browsers with Global Privacy Control or Do Not Track turned on
send nothing.

Counts are kept per Hong Kong day (UTC+8): visitors (browsers that opened the game),
players (browsers that started a career), careers started and careers finished, plus
all-time totals. One connection can send at most 120 events an hour. See them at
`/stats.html` (not linked from the game, and kept out of search engines), or as JSON from
`GET /api/stats?days=30`.

Data lives in Netlify Blobs in a store called `stats`. Deploy previews, branch deploys
and `npm start` each use their own store, so testing never adds to the real numbers.
Set `STATS_SALT` in Netlify's environment variables to choose the hash salt; otherwise
it uses `LEADERBOARD_SALT`, or a random salt kept in the store.

## Cutscenes

The biggest moments of a career play a short 3D scene, 7 to 9 seconds long:

- the F1 debut, with the five red lights going out
- the first Grand Prix win: the chequered flag, then the podium and the champagne
- every world title
- the proposal, on a beach after the race
- the baby on the way
- retirement

The home crowd gets its own scene for a driver's first F1 start or first win as the
country's first, a first home win, and the Macau Grand Prix. Hong Kong gets a neon street
and the harbour. Japan gets Suzuka in spring, with Mt Fuji and the Ferris wheel. Korea
gets the Han river, with the clap rhythm of "Dae-han-min-guk". Taiwan gets sky lanterns
and Taipei 101, and Macau gets the Guia Circuit and Grand Lisboa. Everyone else gets a
grandstand in their flag's colours.

At most one scene plays per button press. They are skippable (Skip, Escape, Enter, Space
or a tap) and can be switched off in Settings. They are off by default when race
animations are off, which is also the default for anyone who asks their system for
reduced motion.

The scenes are built in code from simple shapes with [three.js](https://threejs.org)
(`js/vendor/three.module.min.js`, r170, MIT). There are no model or texture files.
three.js and the scenes load in the background once a career is on screen, so the game
itself loads as fast as before. Without WebGL, or if loading fails, the game just carries
on without them.

Which moment gets a scene is decided in `js/ui/cutscene-pick.js`, from the career before
and after a press. It never touches the engine, so careers play and replay exactly the same
with or without cutscenes. To try a scene on its own, run `npm start` and open
`http://localhost:5173/#cutscene=jp` (or `hk`, `kr`, `tw`, `mo`, `home:FR`, `debut`,
`win`, `title`, `proposal`, `baby`, `retire`). Add `@4.5` to stop at 4.5 seconds.

## Second generation

If a career ends with a kid (say yes to the romance, the ring and the big news), the kid can
carry it on: the retirement card offers "Continue with your kid". The kid keeps the surname and
nationality and starts from the parent's helmet colours. The background depends on how the
parent's career went. A parent who retired worth $500M or more means paddock royalty and
nothing on top. Anyone else's kid is a karting prodigy with up to $1M and +7 fame from the
family, which never adds up to more than a royalty start. Five family events only happen in
these careers: the press comparing you to your parent, the parent on the pit wall or in the
commentary box, the family race number, the kid of the parent's old rival, and living in the
parent's shadow. The retirement card and Hall of Fame show the family line, and the all-time
records list the parent next to the kid.

Everything the kid inherits travels in `setup.legacy`, so the global leaderboard can replay the
kid's career like any other. `validateLegacy` in `js/engine/replay.js` bounds every field,
checks that the parent's record adds up, and recomputes the background, money and fame from the
parent's net worth and tier. Ordinary careers have no `legacy` field and play exactly as before.

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
node tools/fingerprint.mjs   # one hash over 40 careers; compare with an older copy of js/
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
| `js/engine/legacy.js` | Retirement summary, epilogue, all-time records, and what a parent hands down to a kid. |
| `js/ui/` | Title screen, game screen, dialogs, donations. |
| `js/ui/cutscene-pick.js`, `js/ui/cutscene.js` | Which moment gets a cutscene, and the player that shows it. |
| `js/scenes/` | The 3D cutscenes: `kit.js` (props and effects), `moments.js`, `places.js`. |
| `js/vendor/three.module.min.js` | three.js r170, for the cutscenes. |
| `js/i18n.js` | Languages: English, 繁體中文 (Traditional Chinese), 日本語 (Japanese) and 한국어 (Korean). |
| `js/engine/events.zh.js`, `events.ja.js`, `events.ko.js` | The words for every event in each language, keyed by event id. |
| `js/lang/zh.js`, `ja.js`, `ko.js` and their `.data.js` files | The interface in each language, and names of tracks, nations, achievements and so on. |
| `js/api.js` | The browser side of the global leaderboard. |
| `netlify/functions/leaderboard.mjs` | The leaderboard function (`/api/leaderboard`). |
| `netlify/functions/stats.mjs` | The anonymous play counter (`/api/stats`). |
| `netlify/lib/` | Leaderboard and play counter logic, and the name blocklist. Not shipped to players. |
| `js/stats.js` | The browser side of the play counter. |
| `stats.html` | The play stats page for the developer. |

The same seed plus the same choices always replays the same career, in any language.

## Languages

The game is in English, 繁體中文 (written for Hong Kong and Taiwan players), 日本語 and
한국어. It starts in 繁體中文 when the browser's language is zh-HK, zh-TW, zh-MO or
zh-Hant, in Japanese or Korean when it is ja or ko, and in English otherwise. Players
switch with the 🌐 picker on the title screen or in Settings. Place names follow the
browser's region where Hong Kong and Taiwan spell them differently (意大利 or 義大利).

English text is the key for its own translation. When you add or change an event, add its
words to `js/engine/events.zh.js`, `events.ja.js` and `events.ko.js` with the same choices in
the same order; for any other text, run `node tools/i18n-keys.mjs --missing zh` (or `ja`,
`ko`) to list what still needs translating. `npm test` fails if something is missing in any
language, so a new event cannot ship half-translated.

Korean particles change with the word before them (이/가, 을/를), so in Korean text a
name is followed by 선수 or 님, and a team by 팀, before any particle.

The social preview image (`assets/og.png`) and app icons were drawn in the browser and saved
through the local dev server's `/__save/` endpoint, which only exists in `tools/serve.mjs`.

## Credits

Flag emoji are from [Twemoji](https://github.com/jdecked/twemoji), licensed CC-BY 4.0,
packaged as a font by [country-flag-emoji-polyfill](https://github.com/talkjs/country-flag-emoji-polyfill)
(MIT). The typeface is Saira, served by Google Fonts. The cutscenes use
[three.js](https://github.com/mrdoob/three.js) (MIT, Copyright 2010-2024 three.js authors).

All teams, drivers and sponsors are fictional. This is a fan-made game and isn't affiliated
with Formula 1, the FIA or any team.
