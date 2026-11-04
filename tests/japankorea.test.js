import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, prompt, advance, choose, pickOffer, autoPick } from '../js/engine/game.js';
import { replayCareer } from '../js/engine/replay.js';
import { ACH_BY_ID, achWords } from '../js/engine/achievements.js';
import { setLang } from '../js/i18n.js';

afterEach(() => setLang('en'));

const setup = (seed, nat, extra = {}) => ({
  seed, first: 'Test', last: 'Driver', nat, style: 'fighter', bg: 'royalty', helmet: { c1: '#F2F2F2', c2: '#E8002D' }, number: 44, ...extra,
});

function bestOffer(s, offers) {
  const ok = offers.map((o, i) => ({ o, i })).filter(({ o }) => (o.kind === 'seat' || o.kind === 'stay' || o.kind === 'reserve') && !(o.cost && o.cost > s.driver.money));
  const rank = (o) => (o.series === 'F1' ? 100 : 0) + ({ F2: 30, F3: 20, F4: 10 }[o.series] || 0) + (o.kind === 'reserve' ? -50 : 0) + (o.tier || 0) * 2;
  ok.sort((a, b) => rank(b.o) - rank(a.o));
  return !ok.length || s.driver.age >= 37 ? offers.length - 1 : ok[0].i;
}

// A whole career, one button at a time. Records every decision, each F1 calendar,
// and the milestones and race cards (the feed itself only keeps the latest entries).
function play(s) {
  const seen = new Set();
  const cals = [];
  const log = [];
  for (let k = 0; k < 30000 && s.stage !== 'retired'; k++) {
    const p = prompt(s);
    if (p.type === 'choice') {
      seen.add(s.pending.id);
      choose(s, s.fn % 3 === 0 ? autoPick(s) : s.fn % p.choices.length);
    } else if (p.type === 'offers') pickOffer(s, bestOffer(s, p.offers));
    else advance(s);
    const se = s.season;
    if (se?.series === 'F1' && cals[cals.length - 1]?.year !== se.year) cals.push({ year: se.year, cal: se.cal.slice(), starts: s.career.tot.F1.starts });
    const last = log[log.length - 1]?.n ?? 0;
    for (const e of s.feed) if (e.n > last) log.push(e);
  }
  return { s, seen, cals, log };
}

const NEW_EVENTS = ['suzuka_home', 'korea_gp', 'manga_hero', 'variety_show'];
const miles = (log) => log.filter((e) => e.k === 'mile');

// ------------------------------------------------------------ first sponsors

function moneyTalk(nat, lang = 'en') {
  setLang(lang);
  const s = newGame(setup('sponsor', nat, { bg: 'prodigy' }));
  while (s.pending.id !== 'pro_money') choose(s, 0);
  const e = s.feed.find((x) => x.n === s.pending.n);
  const label = e.choices[1].label;
  choose(s, 1);
  return { s, label, out: e.out };
}

test('Japanese and Korean drivers get their own first sponsor, on the same deal', () => {
  const gb = moneyTalk('GB');
  for (const [nat, lang, shop, king] of [
    ['JP', 'en', /Menya Hayate/, 'Ramen king'],
    ['KR', 'en', /Halmae Chicken/, 'Fried chicken king'],
    ['JP', 'ja', /麺屋はやて/, 'ラーメン王'],
    ['KR', 'ko', /할매치킨/, '치킨의 왕'],
    ['JP', 'zh', /麵屋疾風/, '拉麵之王'],
  ]) {
    const a = moneyTalk(nat, lang);
    assert.match(a.out, shop, `${nat} in ${lang}`);
    assert.ok(a.s.flags.kebab, `${nat}: same flag`);
    assert.equal(a.s.driver.money, gb.s.driver.money, `${nat}: same money`);
    assert.equal(achWords(ACH_BY_ID.kebab_king, nat).name, king);
  }
});

// ------------------------------------------------------------ the Korean Grand Prix

test('the Korean Grand Prix comes back from a Korean driver\'s second F1 season', () => {
  let checked = 0;
  for (let i = 0; i < 16 && checked < 2; i++) {
    const { s, seen, cals, log } = play(newGame(setup(`korea-${i}`, 'KR')));
    if (cals.length < 2) continue;
    checked++;
    cals.forEach(({ cal, starts }, n) => {
      const back = starts > 0;
      assert.equal(cal.includes('korea'), back, `season ${n}: Korea on the calendar only after the debut`);
      if (back) assert.equal(cal.indexOf('korea'), cal.indexOf('japan') + 1, 'the week after Suzuka');
    });
    const ann = miles(log).filter((e) => e.title === 'The Korean Grand Prix is back');
    assert.equal(ann.length, 1, 'announced once');
    assert.equal(s.career.firsts.koreagp, cals.find((c) => c.cal.includes('korea')).year);
    assert.ok(log.some((e) => e.k === 'race' && e.trackId === 'korea'), 'raced at Yeongam');
    assert.ok(seen.has('korea_gp'), 'the Yeongam decision came up');
    // The server replays it to the same career.
    const saved = JSON.parse(JSON.stringify(s));
    const r = replayCareer(saved.setup, saved.log);
    assert.equal(r.retired.score, s.retired.score);
    assert.equal(r.rng, s.rng);
  }
  assert.equal(checked, 2, 'two Korean careers had more than one F1 season');
});

test('nobody else, and no career from before version 3, races in Korea', () => {
  for (const [nat, cv] of [['KR', 2], ['JP', 3], ['GB', 3]]) {
    for (let i = 0; i < 4; i++) {
      const { s, seen, cals } = play(newGame(setup(`no-korea-${nat}-${cv}-${i}`, nat, { cv })));
      assert.ok(cals.every(({ cal }) => !cal.includes('korea')), `${nat} v${cv}`);
      assert.ok(!s.career.firsts.koreagp);
      if (cv < 3) assert.deepEqual(NEW_EVENTS.filter((id) => seen.has(id)), [], 'no version-3 events');
    }
  }
});

// ------------------------------------------------------------ events

test('Japanese and Korean careers meet their own events, from version 3 only', () => {
  const seen = { JP: new Set(), KR: new Set() };
  for (const nat of ['JP', 'KR']) {
    for (let i = 0; i < 10; i++) {
      const r = play(newGame(setup(`jk-events-${nat}-${i}`, nat)));
      r.seen.forEach((id) => seen[nat].add(id));
      const old = play(newGame(setup(`jk-events-${nat}-${i}`, nat, { cv: 2 })));
      assert.deepEqual(NEW_EVENTS.filter((id) => old.seen.has(id)), [], `${nat} v2`);
    }
  }
  assert.ok(seen.JP.has('suzuka_home') && seen.JP.has('manga_hero'), 'Suzuka home crowd and the manga');
  assert.ok(seen.KR.has('korea_gp') && seen.KR.has('variety_show'), 'Yeongam and the variety show');
  assert.ok(!seen.JP.has('variety_show') && !seen.JP.has('korea_gp') && !seen.KR.has('manga_hero') && !seen.KR.has('suzuka_home'));
});

// ------------------------------------------------------------ first Grand Prix winner

test('the first Japanese Grand Prix winner makes history, but only from version 3', () => {
  let found = null;
  let log = null;
  for (let i = 0; i < 30 && !found; i++) {
    const r = play(newGame(setup(`jp-win-${i}`, 'JP')));
    if (r.s.career.firsts.f1natwin) ({ s: found, log } = r);
  }
  assert.ok(found, 'a Japanese career won a Grand Prix with no Japanese winner before it');
  const m = miles(log).find((e) => e.title === "Japan's first Grand Prix winner");
  assert.ok(m, 'the milestone');
  assert.equal(found.career.firsts.f1natwin, found.career.firsts.f1win, 'on the first win');
  assert.ok(found.ach.includes('history_maker'));

  const old = play(newGame({ ...found.setup, cv: 2 })).s;
  assert.ok(!old.career.firsts.f1natwin && !old.ach.includes('history_maker'), 'nothing for version 2');
});

test('a country that has already won gets no history-making win', () => {
  for (let i = 0; i < 12; i++) {
    const { s } = play(newGame(setup(`gb-win-${i}`, 'GB')));
    assert.ok(!s.career.firsts.f1natwin && !s.ach.includes('history_maker'));
  }
});
