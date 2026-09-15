// Projeyi telefondan elle kurulabilecek 3 dosyaya indirger.
// Çıktı: dist-tek/package.json, dist-tek/server.js, dist-tek/public/index.html
import fs from 'node:fs';
import path from 'node:path';

const root = path.dirname(new URL(import.meta.url).pathname);
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

// import satırlarını (çok satırlılar dahil) at, export anahtar kelimesini sök.
const strip = (src) =>
  src
    .replace(/^import[\s\S]*?from\s+'[^']+';[ \t]*$/gm, '')
    .replace(/^import\s+'[^']+';[ \t]*$/gm, '')
    .replace(/^export\s+(const|function|class|async)\s/gm, '$1 ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

// ── server.js ────────────────────────────────────────────────
const serverHeader = `// EZ Vampir Köylü — tek dosya sürümü.
// Kaynak proje src/ altında modüllere bölünmüştür; bu dosya build-tek.js ile üretildi.
import 'dotenv/config';
import http from 'node:http';
import path from 'node:path';
import crypto, { randomInt, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
`;

const serverOut = [
  serverHeader,
  '// ═══════════ ROLLER ═══════════',
  strip(read('src/roles.js')),
  '// ═══════════ GÖREVLER ═══════════',
  strip(read('src/tasks.js')),
  '// ═══════════ OYUN MOTORU ═══════════',
  strip(read('src/game.js')),
  '// ═══════════ KICK ═══════════',
  strip(read('src/kick.js')),
  '// ═══════════ SUNUCU ═══════════',
  strip(read('server.js')),
].join('\n\n');

// ── index.html ───────────────────────────────────────────────
const html = read('public/index.html');
const css = read('public/css/style.css');
const clientJs = [
  strip(read('public/js/village.js')),
  strip(read('public/js/voice.js')),
  strip(read('public/js/client.js')),
].join('\n\n');

const htmlOut = html
  .replace('<link rel="stylesheet" href="/css/style.css" />', `<style>\n${css}\n</style>`)
  .replace('<script type="module" src="/js/client.js"></script>', `<script type="module">\n${clientJs}\n</script>`);

// ── package.json ─────────────────────────────────────────────
const pkg = {
  name: 'ez-vampir-koylu',
  version: '1.0.0',
  type: 'module',
  main: 'server.js',
  scripts: { start: 'node server.js' },
  engines: { node: '>=20' },
  dependencies: { dotenv: '^16.4.5', express: '^4.19.2', 'socket.io': '^4.7.5' },
};

const out = path.join(root, 'dist-tek');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'public'), { recursive: true });
fs.writeFileSync(path.join(out, 'server.js'), serverOut);
fs.writeFileSync(path.join(out, 'public', 'index.html'), htmlOut);
fs.writeFileSync(path.join(out, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
fs.copyFileSync(path.join(root, 'render.yaml'), path.join(out, 'render.yaml'));

const kb = (p) => (fs.statSync(path.join(out, p)).size / 1024).toFixed(1) + ' KB';
console.log('server.js        ', kb('server.js'));
console.log('public/index.html', kb('public/index.html'));
console.log('package.json     ', kb('package.json'));
