#!/usr/bin/env node
// Cut a release:
//   1. validate the working tree and the version argument;
//   2. sync package.json version, rebuild dist/ and commit;
//   3. create the exact tag vX.Y.Z and force-move the rolling major tag
//      (v0 for 0.x, v1 after GA).
// Push both tags afterwards (the release workflow pushes them).
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const version = process.argv[2];

function run(command, options = {}) {
  return execSync(command, {
    cwd: root,
    stdio: 'inherit',
    encoding: 'utf8',
    ...options,
  }).toString();
}
function runQuiet(command) {
  return execSync(command, { cwd: root, encoding: 'utf8' }).toString().trim();
}

if (!version || !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error('Usage: node scripts/release.mjs <x.y.z>');
  process.exit(1);
}

const dirty = runQuiet('git status --porcelain');
if (dirty) {
  console.error('Working tree is not clean. Commit or stash before releasing.');
  process.exit(1);
}

const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
if (pkg.version !== version) {
  pkg.version = version;
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

run('npm run build');

const buildDirty = runQuiet('git status --porcelain');
if (buildDirty) {
  run('git add package.json dist');
  run(`git commit -m "release: v${version}"`);
}

const exactTag = `v${version}`;
const major = Number(version.split('.')[0]);
const rollingTag = `v${major}`;

const tags = runQuiet('git tag --list').split('\n');
if (!tags.includes(exactTag)) {
  run(`git tag -a ${exactTag} -m ${JSON.stringify(exactTag)}`);
}
// Moving the rolling tag is standard practice for GitHub Actions consumers;
// CI is the only place this force-move happens.
run(`git tag -f ${rollingTag} ${exactTag}`);

console.log(`Created ${exactTag} and moved ${rollingTag}.`);
console.log('Next: git push origin <exactTag> && git push origin <rollingTag> --force');
