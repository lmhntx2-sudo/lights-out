# Lights Out

A formula racing career life simulator for the browser, in the spirit of FootLife.
You start with a battered kart at eight, climb through Formula 4, 3 and 2, and see how
far you get in Formula 1. Every race can throw up a decision: safety car calls, team
orders, last-lap lunges, sponsors, rivals, contracts, money and life off track.

Plain HTML, CSS and JavaScript. No build step, no dependencies, no backend.

## Play locally

```bash
npm start
```

Then open http://localhost:5173. Opening `index.html` straight from disk won't work,
because browsers block JavaScript modules on `file://` pages.

## Set up donations ("Fuel the dev")

Edit `js/config.js`:

- `primaryUrl`: your main donation page, for example `https://www.buymeacoffee.com/yourname`
  or `https://ko-fi.com/yourname`. Every button falls back to this.
- `platforms`: fill in any of Buy Me a Coffee, Ko-fi or PayPal. Empty ones are hidden.
- `tiers`: the four amounts shown in the modal. Give a tier its own `url` (for example a
  Stripe Payment Link for exactly $5) to send people straight to that amount.
- `nudgeCooldownDays`: the game shows a small, dismissable coffee reminder after a first
  Grand Prix win or a world title, at most once per this many days. Supporters never see it.

While `primaryUrl` still contains `YOUR_NAME`, the donation dialog shows a red developer
note so you can't forget. It disappears once a real link is set.

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

The same seed plus the same choices always replays the same career.

## Credits

Flag emoji are from [Twemoji](https://github.com/jdecked/twemoji), licensed CC-BY 4.0,
packaged as a font by [country-flag-emoji-polyfill](https://github.com/talkjs/country-flag-emoji-polyfill)
(MIT). The typeface is Saira, served by Google Fonts.

All teams, drivers and sponsors are fictional. This is a fan-made game and isn't affiliated
with Formula 1, the FIA or any team.
