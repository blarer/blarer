#!/usr/bin/env node
/**
 * Fails if any private repository name appears in the generated SVGs.
 *
 * The treemap includes private repos as shape only. A name can leak through
 * more than the visible label — element ids, the title, the alt text — so this
 * checks the rendered bytes rather than trusting the drawing code. It has
 * already caught one real leak (clipPath ids were derived from repo names).
 *
 * Runs in CI on every generation. Skips silently when PRIVATE_NAMES=1, which
 * is an explicit opt-in to publishing the names.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

if (process.env.PRIVATE_NAMES === '1') {
  console.log('PRIVATE_NAMES=1: names are published deliberately, skipping leak check.');
  process.exit(0);
}

const USER = process.env.GITHUB_USER ?? 'blarer';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.log('No GITHUB_TOKEN: cannot list private repos, skipping leak check.');
  process.exit(0);
}

const res = await fetch('https://api.github.com/user/repos?per_page=100&affiliation=owner&visibility=private', {
  headers: {
    Accept: 'application/vnd.github+json',
    'User-Agent': `${USER}-leak-check`,
    Authorization: `Bearer ${token}`,
  },
});
if (!res.ok) throw new Error(`GitHub ${res.status} listing private repos`);

const names = (await res.json()).map((r) => r.name);
if (names.length === 0) {
  console.log('No private repositories; nothing to leak.');
  process.exit(0);
}

const leaks = [];
for (const file of ['work-light.svg', 'work-dark.svg']) {
  const svg = (await readFile(join(ROOT, 'assets', file), 'utf8')).toLowerCase();
  for (const name of names) {
    if (svg.includes(name.toLowerCase())) leaks.push(`${file}: ${name}`);
  }
}

if (leaks.length > 0) {
  console.error('Private repository names found in generated SVGs:');
  for (const leak of leaks) console.error(`  ${leak}`);
  process.exit(1);
}

console.log(`No private names in the SVGs (checked ${names.length} against 2 files).`);
