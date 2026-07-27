#!/usr/bin/env node
/**
 * Generates assets/work-{light,dark}.svg: a squarified treemap of every public
 * repository, each tile sized by real source bytes and split by language.
 *
 * The same layout the site uses, rendered to a static SVG so GitHub can serve
 * it. GitHub's camo proxy strips <style> and external CSS from embedded SVGs,
 * so every fill here is an inline attribute and the light/dark pair is chosen
 * by <picture> + prefers-color-scheme in the README rather than by media
 * queries inside the file.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { squarify } from './treemap.mjs';

const USER = process.env.GITHUB_USER ?? 'blarer';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'assets');

const WIDTH = 880;
const HEIGHT = 340;
const GAP = 4;

const LANGUAGE_COLORS = {
  Rust: '#dea584',
  Swift: '#f05138',
  Python: '#3572a5',
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  CSS: '#663399',
  Nix: '#7e7eff',
  Lua: '#000080',
  PowerShell: '#012456',
  Shell: '#89e051',
  Just: '#384d54',
  C: '#555555',
  HTML: '#e34c26',
  Go: '#00add8',
};
const languageColor = (name) => LANGUAGE_COLORS[name] ?? '#8b949e';

const THEMES = {
  light: { fg: '#1f2328', muted: '#59636e', line: '#d1d9e0', bg: 'none' },
  dark: { fg: '#f0f6fc', muted: '#9198a1', line: '#3d444d', bg: 'none' },
};

const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': `${USER}-profile-treemap`,
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
};

async function api(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`GitHub ${res.status} on ${path}`);
  return res.json();
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => `&${{ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot', "'": 'apos' }[c]};`);

const bytes = (n) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MB`;
  if (n >= 1000) return `${Math.round(n / 1000)} KB`;
  return `${n} B`;
};

function totalBytes(languages) {
  return Object.values(languages).reduce((sum, n) => sum + n, 0);
}

/** Splits one repo tile into horizontal language bands, largest first. */
function languageBands(tile) {
  const entries = Object.entries(tile.languages).sort((a, b) => b[1] - a[1]);
  const total = totalBytes(tile.languages);
  if (total === 0) return [];
  let offset = 0;
  return entries.map(([name, size], i) => {
    const share = size / total;
    // Absorb rounding into the last band so bands always fill the tile exactly.
    const height = i === entries.length - 1 ? tile.height - offset : tile.height * share;
    const band = { name, x: tile.x, y: tile.y + offset, width: tile.width, height, share };
    offset += height;
    return band;
  });
}

function render(tiles, theme, meta) {
  const t = THEMES[theme];
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT + 34}" viewBox="0 0 ${WIDTH} ${HEIGHT + 34}" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" role="img" aria-label="${esc(meta.alt)}">`,
    `<title>${esc(meta.alt)}</title>`,
  ];

  for (const tile of tiles) {
    const id = `clip-${tile.key.replace(/[^a-zA-Z0-9]/g, '-')}`;
    parts.push(
      `<clipPath id="${id}"><rect x="${tile.x.toFixed(2)}" y="${tile.y.toFixed(2)}" width="${tile.width.toFixed(2)}" height="${tile.height.toFixed(2)}" rx="5"/></clipPath>`,
      `<g clip-path="url(#${id})">`,
    );

    for (const band of languageBands(tile)) {
      parts.push(
        `<rect x="${band.x.toFixed(2)}" y="${band.y.toFixed(2)}" width="${band.width.toFixed(2)}" height="${band.height.toFixed(2)}" fill="${languageColor(band.name)}" fill-opacity="0.85"/>`,
      );
    }
    parts.push('</g>');

    parts.push(
      `<rect x="${tile.x.toFixed(2)}" y="${tile.y.toFixed(2)}" width="${tile.width.toFixed(2)}" height="${tile.height.toFixed(2)}" rx="5" fill="none" stroke="${t.line}" stroke-width="1"/>`,
    );

    // Only label tiles with room for the text; anything smaller reads as noise.
    if (tile.width > 92 && tile.height > 40) {
      const tx = (tile.x + 10).toFixed(2);
      parts.push(
        `<text x="${tx}" y="${(tile.y + 22).toFixed(2)}" font-size="13" font-weight="600" fill="${t.fg}">${esc(tile.name)}</text>`,
        `<text x="${tx}" y="${(tile.y + 38).toFixed(2)}" font-size="11" fill="${t.muted}">${esc(bytes(tile.value))}</text>`,
      );
    }
  }

  parts.push(
    `<text x="0" y="${HEIGHT + 24}" font-size="11" fill="${t.muted}">${esc(meta.caption)}</text>`,
    '</svg>',
  );
  return `${parts.join('\n')}\n`;
}

const list = await api(`/users/${USER}/repos?per_page=100&sort=pushed`);
const repos = await Promise.all(
  list
    .filter((r) => !r.fork && !r.archived && !r.private)
    .map(async (r) => ({
      key: r.name,
      name: r.name,
      languages: await api(`/repos/${USER}/${r.name}/languages`),
    })),
);

const sized = repos
  .map((r) => ({ ...r, value: totalBytes(r.languages) }))
  .filter((r) => r.value > 0)
  .sort((a, b) => b.value - a.value);

if (sized.length === 0) throw new Error('No repositories with measurable source bytes');

const tiles = squarify(sized, { x: 0, y: 0, width: WIDTH, height: HEIGHT }).map((tile) => ({
  ...tile,
  // Inset every tile by half a gap so adjacent tiles read as separate.
  x: tile.x + GAP / 2,
  y: tile.y + GAP / 2,
  width: Math.max(0, tile.width - GAP),
  height: Math.max(0, tile.height - GAP),
}));

const total = sized.reduce((sum, r) => sum + r.value, 0);
const synced = new Date().toISOString().slice(0, 10);
const meta = {
  alt: `Treemap of ${sized.length} public repositories, sized by source bytes and split by language.`,
  caption: `${sized.length} repositories · ${bytes(total)} of source · sized by bytes, split by language · GitHub API, ${synced}`,
};

await mkdir(OUT_DIR, { recursive: true });
for (const theme of Object.keys(THEMES)) {
  await writeFile(join(OUT_DIR, `work-${theme}.svg`), render(tiles, theme, meta));
}
console.log(`Wrote ${sized.length} repos, ${bytes(total)} of source, to assets/work-{light,dark}.svg`);
