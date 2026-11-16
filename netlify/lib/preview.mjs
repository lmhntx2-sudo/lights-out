// Link previews for shared Lights Out links. When someone pastes a daily
// season or a challenge link into WhatsApp, Threads, Discord or Telegram, the
// preview says what the link is ("Alex scored 193 points. Can you beat it?")
// instead of the generic one. The game itself is the same page either way.
//
// It only rewrites meta tags in the page head. Everything shown comes from the
// link, is cut to a safe length and is HTML-escaped.
import { parseVs } from '../../js/core/vs.js';
import { dayNumber, isDay } from '../../js/core/days.js';

const SITE = 'https://lights-out-racing.netlify.app';
const IMAGE = { day: `${SITE}/assets/og-daily.png`, career: `${SITE}/assets/og.png` };

// Only a few lines, so they live here rather than in the game's language files.
const WORDS = {
  en: {
    day: (n) => `Lights Out daily season #${n}`,
    dayToday: 'Lights Out daily season',
    dayVs: (v, n) => `${v.name} scored ${v.pts} points (P${v.pos}) in Lights Out daily season #${n}. Can you beat it?`,
    dayDesc: 'One Formula 1 season in about five minutes. Everyone gets the same car, the same grid and the same luck today, so only your calls differ. Free, in your browser.',
    careerVs: (v) => `${v.name} retired with a legacy score of ${v.score} (${v.titles} titles, ${v.wins} wins). Beat it in the same world.`,
    careerDesc: 'Lights Out: a free Formula 1 career simulator. Same seed, same rivals, same luck. From karting at eight to your last lap in F1.',
  },
  zh: {
    day: (n) => `Lights Out 每日賽季 #${n}`,
    dayToday: 'Lights Out 每日賽季',
    dayVs: (v, n) => `${v.name} 在 Lights Out 每日賽季 #${n} 拿到 ${v.pts} 分（P${v.pos}）。你能打敗嗎？`,
    dayDesc: '大約五分鐘跑完一個 F1 賽季。今天所有人都是同一部車、同一批對手、同一份運氣，分別只在你的決定。免費，瀏覽器即玩。',
    careerVs: (v) => `${v.name} 以傳奇分數 ${v.score} 退役（${v.titles} 屆冠軍、${v.wins} 場勝利）。在同一個世界打敗他。`,
    careerDesc: 'Lights Out：免費 F1 車手生涯模擬。同一個種子、同一批對手、同一份運氣。從八歲卡丁車到 F1 最後一圈。',
  },
  ja: {
    day: (n) => `Lights Out デイリーシーズン #${n}`,
    dayToday: 'Lights Out デイリーシーズン',
    dayVs: (v, n) => `${v.name}はLights Out デイリーシーズン #${n}で${v.pts}ポイント（P${v.pos}）。超えられる？`,
    dayDesc: '約5分でF1の1シーズン。今日は全員が同じマシン、同じライバル、同じ運で走ります。違いはあなたの判断だけ。無料、ブラウザですぐ遊べます。',
    careerVs: (v) => `${v.name}はレガシースコア${v.score}（タイトル${v.titles}回、${v.wins}勝）で引退。同じ世界で超えてみよう。`,
    careerDesc: 'Lights Out：無料のF1キャリアシミュレーター。同じシード、同じライバル、同じ運。8歳のカートからF1最後の1周まで。',
  },
  ko: {
    day: (n) => `Lights Out 데일리 시즌 #${n}`,
    dayToday: 'Lights Out 데일리 시즌',
    dayVs: (v, n) => `${v.name}님이 Lights Out 데일리 시즌 #${n}에서 ${v.pts}점(P${v.pos})을 기록했어요. 넘을 수 있나요?`,
    dayDesc: '약 5분 만에 F1 한 시즌. 오늘은 모두가 같은 차, 같은 경쟁자, 같은 운으로 달립니다. 차이는 당신의 판단뿐. 무료, 브라우저에서 바로.',
    careerVs: (v) => `${v.name}님이 레거시 점수 ${v.score}(우승 ${v.titles}회, ${v.wins}승)로 은퇴했어요. 같은 세계에서 넘어 보세요.`,
    careerDesc: 'Lights Out: 무료 F1 커리어 시뮬레이터. 같은 시드, 같은 경쟁자, 같은 운. 여덟 살 카트부터 F1 마지막 랩까지.',
  },
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// What the preview for this link should say, or null to leave the page as it is.
export function previewMeta(url) {
  const q = url.searchParams;
  const w = WORDS[q.get('l')] || WORDS.en;
  if (q.has('daily')) {
    const date = isDay(q.get('daily')) ? q.get('daily') : null;
    const n = date ? dayNumber(date) : 0;
    const vs = date ? parseVs(q.get('vs'), date) : null;
    return {
      title: vs ? w.dayVs(vs, n) : n > 0 ? w.day(n) : w.dayToday,
      description: w.dayDesc,
      image: IMAGE.day,
      url: url.href,
    };
  }
  if (q.has('seed')) {
    const vs = parseVs(q.get('vs'));
    if (!vs || vs.kind !== 'career') return null;
    return { title: w.careerVs(vs), description: w.careerDesc, image: IMAGE.career, url: url.href };
  }
  return null;
}

// Swap the preview tags in the page head. Tags that are not there are left out.
export function rewriteHead(html, meta) {
  const set = (attr, key, value) => {
    const re = new RegExp(`(<meta\\s+${attr}="${key}"\\s+content=")[^"]*(")`);
    html = html.replace(re, (_, a, b) => `${a}${esc(value)}${b}`);
  };
  set('property', 'og:title', meta.title);
  set('property', 'og:description', meta.description);
  set('property', 'og:image', meta.image);
  set('property', 'og:url', meta.url);
  set('name', 'twitter:title', meta.title);
  set('name', 'twitter:description', meta.description);
  set('name', 'twitter:image', meta.image);
  set('name', 'description', meta.description);
  return html.replace(/<title>[^<]*<\/title>/, `<title>${esc(meta.title)}</title>`);
}
