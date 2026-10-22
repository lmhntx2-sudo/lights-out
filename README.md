# Lights Out

A formula racing career life simulator for the browser, in the spirit of FootLife.
You start with a battered kart at eight, climb through Formula 4, 3 and 2, and see how
far you get in Formula 1. Every race can throw up a decision: safety car calls, team
orders, last-lap lunges, sponsors, rivals, contracts, money and life off track.

Plain HTML, CSS and JavaScript. No dependencies, no backend.

What's in it: a race number you pick, team liveries, an F1-broadcast-style timing tower,
Race Control banners, team targets each season, podium and championship celebrations,
an all-time records table against fictional legends, shareable career-card images,
achievements, a daily challenge, seeds you can share, optional sound effects, and a
"Fuel the dev" tip jar.

## Play locally

```bash
npm start
```

Then open http://localhost:5173. Opening `index.html` straight from disk won't work,
because browsers block JavaScript modules on `file://` pages.

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

It's a static site, so any static host works.

- **Vercel**: import the folder or repo and deploy with no framework preset and no build
  command. The output directory is the project root.
- **Netlify**: drag the folder onto app.netlify.com/drop, or connect the repo with an empty
  build command and `.` as the publish directory.
- **GitHub Pages**: push the repo and enable Pages on the main branch root.

## Develop

```bash
npm test                     # plays 120+ full careers headless and checks invariants
node tools/balance.mjs 80    # outcome stats per background, for tuning difficulty
```

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
| `js/ui/` | Title screen, game screen, dialogs, donations. |
| `js/i18n.js` | Languages: English and 繁體中文 (Traditional Chinese). |
| `js/engine/events.zh.js` | Chinese words for every event, keyed by event id. |
| `js/lang/zh.js`, `js/lang/zh.data.js` | Chinese for the interface, and names of tracks, nations, achievements and so on. |

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
