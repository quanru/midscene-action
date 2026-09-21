#!/usr/bin/env node
// Print (or, with --write, apply) the latest @midscene/cli version when it is
// newer than DEFAULT_CLI_VERSION in src/constants.ts.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const write = process.argv.includes('--write');

const latest = JSON.parse(
  execSync('npm view @midscene/cli version --json', { encoding: 'utf8' }),
).trim();

const constantsPath = path.join(root, 'src', 'constants.ts');
const source = readFileSync(constantsPath, 'utf8');
const current = /DEFAULT_CLI_VERSION = '([^']+)'/.exec(source)?.[1];

if (!current) {
  console.error('Could not locate DEFAULT_CLI_VERSION in src/constants.ts');
  process.exit(1);
}

console.log(`latest=${latest} current=${current}`);
if (latest === current) {
  console.log('Already up to date.');
  process.exit(0);
}

if (!write) {
  console.log(`Update available: ${current} -> ${latest}. Re-run with --write to apply.`);
  process.exit(0);
}

writeFileSync(constantsPath, source.replace(`'${current}'`, `'${latest}'`));
console.log(`Updated DEFAULT_CLI_VERSION to ${latest}. Run tests/build, then open a PR.`);
