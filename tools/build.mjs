// Copies just the files the website needs into dist/, so tests and tools stay
// out of the public deploy. Usage: node tools/build.mjs
import { cp, rm, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const out = join(root, 'dist');
const include = ['index.html', 'stats.html', 'manifest.webmanifest', 'css', 'js', 'assets'];

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const item of include) await cp(join(root, item), join(out, item), { recursive: true });
console.log(`Built ${include.join(', ')} into dist/`);
