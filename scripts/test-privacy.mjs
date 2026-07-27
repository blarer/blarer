#!/usr/bin/env node
/**
 * Guards the invariant the leak check depends on.
 *
 * check-no-private-names.mjs skips when the token cannot list private repos.
 * That is only safe while generate-treemap.mjs also refuses to run in that
 * case, so a scope-less token can never draw a private repo in the first
 * place. If someone later "fixes" the generator to fall back to public-only,
 * the skip would start hiding a real check.
 *
 * This asserts both halves still hold. Run with `npm test`.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const check = (name, ok, detail) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ''}`);
};

// 1. Without a token the generator must refuse rather than redraw.
const before = await readFile(join(ROOT, 'assets', 'work-dark.svg'), 'utf8');
const env = { ...process.env, PATH: process.env.PATH };
delete env.GITHUB_TOKEN;
const proc = spawnSync('node', [join(ROOT, 'scripts', 'generate-treemap.mjs')], { env, encoding: 'utf8' });
const out = `${proc.stdout}${proc.stderr}`;
const after = await readFile(join(ROOT, 'assets', 'work-dark.svg'), 'utf8');

check('generator exits cleanly when it cannot see private repos', proc.status === 0, `exit ${proc.status}`);
check('generator leaves the SVG untouched', before === after);
check('generator explains why it skipped', /Refusing to redraw/i.test(out));

// 2. The leak check must actually detect a name in the rendered bytes.
const svgPath = join(ROOT, 'assets', 'work-dark.svg');
const original = await readFile(svgPath, 'utf8');
let detected = false;
try {
  const token = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
  const names = JSON.parse(
    execFileSync('gh', ['api', 'user/repos?per_page=100&affiliation=owner&visibility=private', '--jq', '[.[].name]'], {
      encoding: 'utf8',
    }),
  );
  if (names.length > 0) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(svgPath, original.replace('</svg>', `<desc>${names[0]}</desc></svg>`));
    try {
      execFileSync('node', [join(ROOT, 'scripts', 'check-no-private-names.mjs')], {
        env: { ...process.env, GITHUB_TOKEN: token },
        stdio: 'pipe',
      });
    } catch {
      detected = true;
    }
    writeFileSync(svgPath, original);
    check('leak check fails when a private name is present', detected);
  } else {
    console.log('skip  no private repos to test against');
  }
} catch (err) {
  console.log(`skip  leak-detection test needs an authenticated gh (${err.message.split('\n')[0]})`);
}

if (failures.length > 0) {
  console.error(`\n${failures.length} failure(s):`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log('\nAll invariants hold.');
