// Copies just the files the website needs into dist/, so tests and tools stay
// out of the public deploy. Usage: node tools/build.mjs
//
// With --portal it builds the copy for game portals such as itch.io instead:
// dist-portal/, without the stats page, calling the live site's leaderboard and
// play counter, and zipped into tmp/lights-out-web.zip ready to upload.
import { cp, rm, mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

const LIVE = 'https://lights-out-racing.netlify.app';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const portal = process.argv.includes('--portal');
const out = join(root, portal ? 'dist-portal' : 'dist');
const include = ['index.html', ...(portal ? [] : ['stats.html']), 'manifest.webmanifest', 'css', 'js', 'assets'];

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const item of include) await cp(join(root, item), join(out, item), { recursive: true });

if (portal) {
  const config = join(out, 'js', 'config.js');
  const src = await readFile(config, 'utf8');
  const patched = src.replace(/origin: '',/, `origin: '${LIVE}',`);
  if (patched === src) throw new Error('js/config.js has no SERVER.origin to set');
  await writeFile(config, patched);
  const zip = join(root, 'tmp', 'lights-out-web.zip');
  await mkdir(join(root, 'tmp'), { recursive: true });
  await rm(zip, { force: true });
  // Windows' own tar.exe writes a zip when the name ends in .zip (Git's GNU tar
  // can't); elsewhere use zip.
  // The items are named one by one so index.html sits at the top of the zip.
  if (process.platform === 'win32') execFileSync(join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe'), ['-a', '-c', '-f', zip, '-C', out, ...include]);
  else execFileSync('zip', ['-r', '-q', zip, ...include], { cwd: out });
  console.log(`Built the portal copy into dist-portal/ and ${zip}`);
} else {
  console.log(`Built ${include.join(', ')} into dist/`);
}
