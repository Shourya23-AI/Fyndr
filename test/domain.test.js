// The live address must be the same everywhere, the old address must redirect, and the deploy stamp must work.  Run:  node test/domain.test.js
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : (fail++, console.log('  FAIL', n)); };
const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const ORIGIN = 'https://fyndr-bmsit.vercel.app';
const OLD = 'fyndr-2rjv.vercel.app';

const site = await import(pathToFileURL(path.join(root, 'public/js/core/site.js')).href);
ok(site.SITE_ORIGIN === ORIGIN, 'site.js has the real address');
ok(site.RETIRED_HOSTS.includes(OLD), 'site.js lists the old address as retired');

const boot = read('public/boot.js');
ok(boot.includes(`origin: "${ORIGIN}"`) && boot.includes(`"${OLD}"`), 'boot.js redirects the old address to the real one');

const v = JSON.parse(read('vercel.json'));
const red = (v.redirects || []).find(r => r.has?.some(h => h.type === 'host' && h.value === OLD));
ok(red && red.destination === ORIGIN + '/$1' && red.permanent === true, 'vercel.json redirects the old address (permanent)');
ok(v.buildCommand === 'node scripts/stamp-build.js', 'vercel.json stamps every build');
ok(!JSON.stringify(v).includes('fyndr-2rjv') || JSON.stringify(v.redirects).includes('fyndr-2rjv'), 'the old address is only mentioned inside the redirect');

ok(site.onWrongHost({ hostname: OLD }) === true, 'old address counts as wrong');
ok(site.onWrongHost({ hostname: 'fyndr-git-feature-x.vercel.app' }) === true, 'a preview build counts as wrong');
ok(site.onWrongHost({ hostname: 'fyndr-bmsit.vercel.app' }) === false, 'the real address is fine');
ok(site.onWrongHost({ hostname: 'localhost' }) === false, 'localhost is fine');
ok(site.onWrongHost({ hostname: 'fyndr.example.com' }) === false, 'a self-hosted address is not blocked');

// The deploy stamp: replaces the token once, never touches a stamped file, and does nothing locally without --force.
const tmp = path.join(os.tmpdir(), 'sw-' + Date.now() + '.js');
const orig = "const BUILD = '__BUILD__';\nconst CACHE = 'fyndr-' + BUILD;\n";
const run = (args, env) => spawnSync(process.execPath, [path.join(root, 'scripts/stamp-build.js'), ...args], { env: { PATH: process.env.PATH, SW_PATH: tmp, ...env } });
fs.writeFileSync(tmp, orig);
run([], {});
ok(fs.readFileSync(tmp, 'utf8') === orig, 'locally, without --force, sw.js is left alone');
run([], { VERCEL: '1', VERCEL_GIT_COMMIT_SHA: 'abcdef1234567890' });
ok(fs.readFileSync(tmp, 'utf8').includes("const BUILD = 'abcdef1234';"), 'on Vercel the commit id is stamped in');
run([], { VERCEL: '1', VERCEL_GIT_COMMIT_SHA: 'zzzzzzzzzz' });
ok(fs.readFileSync(tmp, 'utf8').includes("'abcdef1234'"), 'an already stamped file is not changed again');
fs.unlinkSync(tmp);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
