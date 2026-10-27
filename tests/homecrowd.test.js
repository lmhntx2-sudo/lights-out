import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, prompt, advance, choose, pickOffer, autoPick } from '../js/engine/game.js';
import { replayCareer, validateSetup, ReplayError } from '../js/engine/replay.js';
import { dailySetup } from '../js/engine/daily.js';
import { CONTENT_VERSION } from '../js/engine/constants.js';
import { ACH_BY_ID, achWords } from '../js/engine/achievements.js';
import { setLang } from '../js/i18n.js';

afterEach(() => setLang('en'));

const setup = (seed, nat = 'GB', extra = {}) => ({
  seed, first: 'Test', last: 'Driver', nat, style: 'fighter', bg: 'prodigy', helmet: { c1: '#F2F2F2', c2: '#E8002D' }, number: 44, ...extra,
});

function bestOffer(s, offers) {
  const ok = offers.map((o, i) => ({ o, i })).filter(({ o }) => (o.kind === 'seat' || o.kind === 'stay' || o.kind === 'reserve') && !(o.cost && o.cost > s.driver.money));
  const rank = (o) => (o.series === 'F1' ? 100 : 0) + ({ F2: 30, F3: 20, F4: 10 }[o.series] || 0) + (o.kind === 'reserve' ? -50 : 0) + (o.tier || 0) * 2;
  ok.sort((a, b) => rank(b.o) - rank(a.o));
  return !ok.length || s.driver.age >= 37 ? offers.length - 1 : ok[0].i;
}

// One call at a time, like the buttons. `until(s)` stops early.
function play(s, { until, pick } = {}) {
  for (let k = 0; k < 30000 && s.stage !== 'retired'; k++) {
    if (until?.(s)) return s;
    const p = prompt(s);
    if (p.type === 'choice') choose(s, pick ? pick(s, p) : s.fn % 3 === 0 ? autoPick(s) : s.fn % p.choices.length);
    else if (p.type === 'offers') pickOffer(s, bestOffer(s, p.offers));
    else advance(s);
  }
  return s;
}

const macauIds = (s) => s.feed.filter((e) => e.k === 'event' || e.k === 'race' || e.k === 'chapter').filter((e) => e.trackId === 'macau' || /Macau|澳門/.test(`${e.title} ${e.big}`));
const atInvite = (s) => s.pending?.id === 'macau_invite';

// ------------------------------------------------------------ content version

test('new careers get the current content version, old ones keep none', () => {
  assert.equal(newGame(setup('cv-new')).setup.cv, CONTENT_VERSION);
  const old = newGame(setup('cv-old', 'GB', { cv: 1 }));
  assert.ok(!('cv' in old.setup), 'version 1 is stored as no cv, so old setups stay byte-identical');
  assert.equal(JSON.stringify(old.setup), JSON.stringify(setup('cv-old')));
});

test('validateSetup passes the content version through and refuses bad ones', () => {
  assert.equal(validateSetup(setup('v')).cv, 1, 'a setup from before versions replays as version 1');
  assert.equal(validateSetup(setup('v', 'GB', { cv: 2 })).cv, 2);
  for (const cv of [0, 3, '2', 1.5, -1, CONTENT_VERSION + 1]) assert.throws(() => validateSetup(setup('v', 'GB', { cv })), ReplayError, `cv ${cv}`);
  // Macau arrived in version 2, so a version-1 career can't be from Macau.
  assert.throws(() => validateSetup(setup('v', 'MO', { cv: 1 })), ReplayError);
  assert.throws(() => validateSetup(setup('v', 'MO')), ReplayError);
  assert.equal(validateSetup(setup('v', 'MO', { cv: 2 })).nat, 'MO');
  // Replayed on the server, an old career still has no cv and a new one keeps its own.
  const old = play(newGame(setup('cv-replay', 'HK', { cv: 1 })));
  const r1 = replayCareer(JSON.parse(JSON.stringify(old.setup)), old.log);
  assert.ok(!('cv' in r1.setup));
  assert.equal(r1.retired.score, old.retired.score);
  const cur = play(newGame(setup('cv-replay', 'HK')));
  const r2 = replayCareer(JSON.parse(JSON.stringify(cur.setup)), cur.log);
  assert.equal(r2.setup.cv, CONTENT_VERSION);
  assert.equal(r2.retired.score, cur.retired.score);
});

test('the daily challenge never changes its driver', () => {
  for (let d = 1; d <= 400; d++) {
    const date = new Date(Date.UTC(2026, 0, d)).toISOString().slice(0, 10);
    assert.notEqual(dailySetup(date).nat, 'MO', date);
  }
  // Picked before Macau existed (d1cdbdf): same answers now.
  assert.deepEqual(['2026-10-20', '2026-11-01', '2027-02-14'].map((d) => dailySetup(d).nat), DAILY_BEFORE);
});

// Fingerprints from the commit before content versions (d1cdbdf), played with
// play() above. A version-1 career must never change, whatever gets added later.
const DAILY_BEFORE = ['BR', 'ES', 'CN'];
const GOLDEN = [
  { seed: 'gold-hk', nat: 'HK', rng: 1444507413, fn: 864, log: 786, score: 3842 },
  { seed: 'gold-tw', nat: 'TW', rng: 2052164070, fn: 911, log: 869, score: 6336 },
  { seed: 'gold-cn', nat: 'CN', rng: 1748425377, fn: 950, log: 901, score: 21881 },
  { seed: 'gold-gb', nat: 'GB', rng: 457840511, fn: 819, log: 778, score: 628 },
  { seed: 'gold-kr', nat: 'KR', rng: 251279498, fn: 902, log: 867, score: 3440 },
  { seed: 'gold-sg', nat: 'SG', rng: 578340023, fn: 875, log: 820, score: 7138 },
];

test('version-1 careers play exactly as they did before the home-crowd pack', () => {
  for (const g of GOLDEN) {
    const s = play(newGame(setup(g.seed, g.nat, { cv: 1 })));
    assert.deepEqual({ seed: g.seed, nat: g.nat, rng: s.rng, fn: s.fn, log: s.log.length, score: s.retired.score }, g, `${g.seed} ${g.nat}`);
    assert.equal(macauIds(s).length, 0, 'no Macau');
    assert.ok(!s.career.firsts.f1first, 'no first-from-home milestone');
    assert.ok(!('macau' in s.career), 'no Macau record');
  }
});

// ------------------------------------------------------------ Macau

function standings(s) {
  const ai = Object.values(s.drivers).map((d) => [d.id, d.starts, d.wins, d.podiums, d.titles]);
  const { stand, tstand, cal, round, series } = s.season;
  return JSON.stringify({ stand, tstand, cal, round, series, last: s.lastStand, hist: s.career.hist, tot: s.career.tot, sl: s.career.sl, raceIdx: s.raceIdx, champions: s.champions, ai });
}

test('an F3 driver from Hong Kong is invited to Macau, and the race changes no standings', () => {
  const s = play(newGame(setup('macau-hk', 'HK')), { until: atInvite });
  assert.ok(atInvite(s), 'invited at the end of the F3 season');
  assert.equal(s.stage, 'offers');
  assert.equal(s.season.series, 'F3');
  const before = standings(s);
  const offers = JSON.stringify(s.offers);
  choose(s, 0);
  assert.equal(s.pending?.id, 'macau_quali');
  const ids = [];
  while (s.pending?.id.startsWith('macau_')) {
    ids.push(s.pending.id);
    choose(s, autoPick(s));
  }
  assert.deepEqual(ids, ['macau_quali', 'macau_lisboa', 'macau_melco']);
  const card = s.feed.filter((e) => e.k === 'race').pop();
  assert.equal(card.trackId, 'macau');
  assert.equal(card.special, true);
  assert.equal(card.champ, null, 'no championship line');
  assert.equal(card.me.pts, 0, 'no points');
  assert.equal(card.track, 'Macau Grand Prix');
  assert.equal(standings(s), before, 'standings, season record, career totals and AI records are untouched');
  assert.equal(JSON.stringify(s.offers), offers, 'the contract offers are the same');
  assert.equal(s.season.race, null);
  assert.equal(s.career.macau.length, 1);
  assert.equal(s.career.macau[0].year, s.year);
  if (card.me.pos === 1 && !card.me.dnf) assert.ok(s.ach.includes('macau_win'));
  // And the career goes on.
  play(s);
  assert.equal(s.stage, 'retired');
  const r = replayCareer(JSON.parse(JSON.stringify(s.setup)), s.log);
  assert.equal(r.retired.score, s.retired.score, 'the server replays a career with Macau in it');
  assert.equal(r.career.macau.length, s.career.macau.length);
});

test('declining the invitation runs no race', () => {
  const s = play(newGame(setup('macau-hk', 'HK')), { until: atInvite });
  const fn = s.fn;
  choose(s, 1);
  assert.ok(!s.pending?.id?.startsWith('macau_'));
  assert.ok(!s.career.macau);
  assert.ok(!s.feed.some((e) => e.n > fn && e.k === 'race'));
});

test('invitations go to the F3 top 8 and to drivers from Macau, Hong Kong, China and Taiwan', () => {
  const tally = { f3: 0, invited: 0, notInvited: 0 };
  for (const [i, nat] of ['GB', 'HK', 'IT', 'TW', 'BR', 'CN', 'JP', 'MO', 'US', 'KR', 'FR', 'AU'].entries()) {
    const s = newGame(setup(`invite-${i}`, nat));
    for (let k = 0; k < 30000 && s.stage !== 'retired'; k++) {
      const p = prompt(s);
      const review = s.stage === 'seasonEnd' && !s.pending;
      if (p.type === 'choice') choose(s, s.fn % 3 === 0 ? autoPick(s) : s.fn % p.choices.length);
      else if (p.type === 'offers') pickOffer(s, bestOffer(s, p.offers));
      else advance(s);
      if (!review) continue;
      // Straight after the season review: the invitation, if any, is the open decision.
      const h = s.career.hist[s.career.hist.length - 1];
      const invited = s.pending?.id === 'macau_invite';
      if (h.series !== 'F3') {
        assert.ok(!invited, `${nat} invited from ${h.series}`);
        continue;
      }
      tally.f3++;
      const want = h.role === 'race' && h.pos > 0 && !s.driver.injured && (h.pos <= 8 || ['MO', 'HK', 'CN', 'TW'].includes(nat));
      assert.equal(invited, want, `${nat} ${h.year}: P${h.pos} in F3`);
      tally[invited ? 'invited' : 'notInvited']++;
    }
  }
  assert.ok(tally.invited >= 4 && tally.notInvited >= 1, JSON.stringify(tally));
});

test('the Macau race reads in Chinese', () => {
  setLang('zh', 'hk');
  const s = play(newGame(setup('macau-hk', 'HK')), { until: atInvite });
  choose(s, 0);
  while (s.pending?.id.startsWith('macau_')) choose(s, 0);
  const fresh = s.feed.slice(-12).filter((e) => ['event', 'race', 'chapter', 'mile'].includes(e.k));
  const text = fresh.map((e) => [e.title, e.text, e.out, e.big, e.sub, e.track].filter(Boolean).join(' ')).join(' ');
  assert.match(text, /澳門格蘭披治大賽車/);
  assert.match(text, /葡京彎/);
  assert.match(text, /新濠髮夾彎/);
  assert.doesNotMatch(text, /Macau|Lisboa|Melco|undefined/);
});

// ------------------------------------------------------------ first driver from your country

const reachF1 = (s) => s.career.tot.F1.starts > 0;

test('the first Hong Kong driver in Formula 1 gets a milestone, a Chinese driver does not', () => {
  const firsts = {};
  for (const nat of ['HK', 'TW', 'CN']) {
    for (let i = 0; i < 12 && !(nat in firsts); i++) {
      const s = play(newGame(setup(`first-${nat}-${i}`, nat)), { until: reachF1 });
      if (!reachF1(s)) continue;
      const mile = s.feed.find((e) => e.k === 'mile' && e.icon === (nat === 'HK' ? '🇭🇰' : nat === 'TW' ? '🇹🇼' : '🇨🇳'));
      firsts[nat] = { year: s.career.firsts.f1first, title: mile?.title };
    }
  }
  assert.equal(firsts.HK?.title, 'First from Hong Kong');
  assert.equal(firsts.TW?.title, 'First from Taiwan');
  assert.ok(firsts.HK.year && firsts.TW.year);
  assert.ok('CN' in firsts, 'a Chinese career reached F1');
  assert.equal(firsts.CN.year, undefined, 'Zhou Guanyu got there first');
  assert.equal(firsts.CN.title, undefined);
});

// ------------------------------------------------------------ first sponsor

function moneyTalk(nat, lang = 'en') {
  setLang(lang, nat === 'TW' ? 'tw' : 'hk');
  const s = newGame(setup('sponsor', nat));
  while (s.pending.id !== 'pro_money') choose(s, 0);
  const e = s.feed.find((x) => x.n === s.pending.n);
  const label = e.choices[1].label;
  choose(s, 1);
  return { s, label, out: e.out };
}

test('the first sponsor is the local shop, with the same deal everywhere', () => {
  const gb = moneyTalk('GB');
  assert.match(gb.out, /Dönerland Express/);
  for (const [nat, en, zh] of [['HK', /Sun Keung Kee/, /新強記茶餐廳/], ['TW', /A-Ma Boba/, /阿嬤珍奶/], ['MO', /Ping Kee/, /炳記/]]) {
    const a = moneyTalk(nat);
    assert.match(a.out, en);
    assert.ok(a.s.flags.kebab, `${nat}: same flag`);
    assert.equal(a.s.driver.money - gb.s.driver.money, 0, `${nat}: same money`);
    const z = moneyTalk(nat, 'zh');
    assert.match(z.out, zh);
  }
  assert.match(moneyTalk('HK', 'zh').label, /茶餐廳/);
  assert.match(moneyTalk('TW', 'zh').label, /手搖飲料店/);
  setLang('en');
  assert.equal(achWords(ACH_BY_ID.kebab_king, 'HK').name, 'Pineapple bun king');
  assert.equal(achWords(ACH_BY_ID.kebab_king, 'TW').name, 'Bubble tea king');
  assert.equal(achWords(ACH_BY_ID.kebab_king, 'GB').name, 'Kebab king');
  assert.equal(achWords(ACH_BY_ID.kebab_king).name, 'Kebab king');
});
