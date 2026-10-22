// A small profanity filter for public leaderboard names. Server-only, so the
// list never ships to players. It catches the obvious cases (accents, leetspeak,
// spacing, stretched letters); a determined troll will still get past it, so
// keep an eye on the board and remove entries with tools/leaderboard-admin.mjs.

// Blocked anywhere inside the name, even run together with other words.
const ANYWHERE = [
  'fuck', 'fvck', 'phuck', 'nigger', 'nigga', 'faggot', 'fagot', 'retard', 'whore', 'wanker',
  'hitler', 'bitch', 'pussy', 'asshole', 'arsehole', 'bastard', 'cocksuck', 'dickhead', 'bullshit', 'shithead',
  'jizz', 'dildo', 'blowjob', 'handjob', 'slut',
  // Cantonese and Mandarin
  '屌', '閪', '屄', '肏', '撚', '仆街', '冚家鏟', '冚家铲', '含家產', '操你', '他媽的', '他妈的', '傻逼', '傻屄', '戇鳩', '戆鸠', '雞巴', '鸡巴',
];

// Blocked only as a whole word, because they hide inside innocent names
// (Hancock, Dickens, Scunthorpe, Yoshitaka, Pornchai, Wankel, Ignazio, therapist).
const WHOLE_WORD = new Set([
  'shit', 'shitty', 'cunt', 'cunts', 'wank', 'porn', 'porno', 'ass', 'arse', 'cock', 'dick', 'fag', 'fags', 'cum', 'tits', 'twat', 'piss', 'rape', 'rapist', 'nazi', 'nazis', 'sex',
  'anal', 'kike', 'spic', 'chink', 'coon', 'tranny', 'kkk', 'isis', 'crap', 'knob', 'prick', 'on9',
]);

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i', '|': 'i' };

const squeeze = (s) => s.replace(/(.)\1+/gu, '$1');

export function isBlocked(name) {
  const base = String(name).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
  const leet = base.replace(/[0134578@$!|]/g, (c) => LEET[c]);
  for (const v of new Set([base, leet])) {
    const words = v.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    const joined = words.join('');
    // "f u c k" and "f.u.c.k" become "fuck"; "fuuuck" becomes "fuck".
    const forms = [joined, squeeze(joined)];
    if (ANYWHERE.some((w) => forms.some((f) => f.includes(w)))) return true;
    if ([...words, ...words.map(squeeze), joined].some((w) => WHOLE_WORD.has(w))) return true;
  }
  return false;
}
