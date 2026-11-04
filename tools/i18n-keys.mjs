// Lists every literal t('...'), tr('...') and tn('...') key in js/, so the
// dictionaries in js/lang (zh.js, ja.js, ko.js) can be checked for gaps.
// Usage: node tools/i18n-keys.mjs [--missing] [zh|ja|ko]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const CALL = /\b(?:t|tr|tn)\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|(`))/g;

function files(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.js') ? [p] : [];
  });
}

const unescape = (s) => s.replace(/\\(.)/g, '$1');

// { key: [file:line, ...] } plus calls whose key is not a plain string.
export function scanKeys() {
  const keys = new Map();
  const dynamic = [];
  for (const file of files(join(root, 'js'))) {
    // Translations themselves, and third-party code that only looks like t('...') calls.
    if (file.includes(join('js', 'lang')) || file.includes(join('js', 'vendor'))) continue;
    // Comment lines often show example calls; skip them.
    const src = readFileSync(file, 'utf8').replace(/^\s*\/\/.*$/gm, '');
    for (const m of src.matchAll(CALL)) {
      const line = src.slice(0, m.index).split('\n').length;
      const where = `${relative(root, file)}:${line}`;
      if (m[3]) {
        dynamic.push(where);
        continue;
      }
      const key = unescape(m[1] ?? m[2]);
      if (!keys.has(key)) keys.set(key, []);
      keys.get(key).push(where);
    }
  }
  return { keys, dynamic };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { keys, dynamic } = scanKeys();
  const lang = ['zh', 'ja', 'ko'].find((l) => process.argv.includes(l)) || 'zh';
  const dict = (await import(pathToFileURL(join(root, 'js', 'lang', `${lang}.js`)).href))[lang.toUpperCase()];
  const only = process.argv.includes('--missing');
  for (const [k, where] of keys) if (!only || dict[k] == null) console.log(`${JSON.stringify(k)}  ${where[0]}`);
  if (dynamic.length) console.log(`\nTemplate-literal keys (not checkable): ${dynamic.join(', ')}`);
  console.log(`\n${keys.size} keys, ${[...keys.keys()].filter((k) => dict[k] == null).length} missing in ${lang}.js`);
}
