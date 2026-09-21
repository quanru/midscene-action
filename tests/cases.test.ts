import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from '@rstest/core';
import { assertWithinBudget, expandYamlFiles } from '../src/cases.js';
import type { ActionInputs } from '../src/types.js';

async function makeTree(): Promise<string> {
  const dir = mkdtempSync(path.join(tmpdir(), 'midscene-cases-'));
  mkdirSync(path.join(dir, 'scripts', 'node_modules', 'pkg'), { recursive: true });
  mkdirSync(path.join(dir, 'scripts', 'sub'), { recursive: true });
  writeFileSync(path.join(dir, 'scripts', 'a.yaml'), 'web:\n  url: https://a\n');
  writeFileSync(path.join(dir, 'scripts', 'sub', 'b.yml'), 'web:\n  url: https://b\n');
  writeFileSync(path.join(dir, 'scripts', 'node_modules', 'pkg', 'c.yaml'), '');
  writeFileSync(path.join(dir, 'scripts', 'ignore.txt'), '');
  return path.join(dir, 'scripts');
}

async function filesFor(pattern: string): Promise<string[]> {
  const scriptsDir = await makeTree();
  const inputs: ActionInputs = {
    yamlPatterns: [pattern],
    workingDirectory: path.dirname(scriptsDir),
    concurrent: 1,
    retries: 0,
    continueOnError: false,
    headed: false,
    shareBrowserContext: false,
    summaryName: 'summary.json',
    runDir: path.join(path.dirname(scriptsDir), 'midscene_run'),
    extraArgs: [],
    cliVersion: '',
    cache: false,
    installBrowserDeps: false,
    uploadArtifact: false,
    artifactName: 'midscene-report',
    artifactExtraPaths: [],
    retentionDays: 7,
    prComment: false,
    commentIdentifier: 'default',
    previewEnv: 'MIDSCENE_PREVIEW_URL',
    failOnError: true,
  };
  return expandYamlFiles(inputs);
}

describe('expandYamlFiles', () => {
  it('expands a directory recursively while ignoring node_modules and non-yaml files', async () => {
    const files = await filesFor('scripts');
    expect(files).toHaveLength(2);
    expect(files.some((file) => file.endsWith('a.yaml'))).toBe(true);
    expect(files.some((file) => file.endsWith('b.yml'))).toBe(true);
  });

  it('passes explicit glob patterns through', async () => {
    const files = await filesFor('scripts/sub/*.yml');
    expect(files).toHaveLength(1);
    expect(files[0]).toContain('b.yml');
  });
});

describe('assertWithinBudget', () => {
  const base = {
    yamlPatterns: ['scripts'],
    config: undefined,
    workingDirectory: '.',
    runDir: '/tmp/x',
    summaryName: 's.json',
    maxCases: undefined,
  } as ActionInputs;

  it('passes within budget', () => {
    expect(() => assertWithinBudget(['a', 'b'], { ...base, maxCases: 2 })).not.toThrow();
  });

  it('fails before model usage when the count exceeds the budget', () => {
    expect(() => assertWithinBudget(['a', 'b', 'c'], { ...base, maxCases: 2 })).toThrow(
      /exceeds the max-cases budget/,
    );
  });

  it('fails on an empty match set', () => {
    expect(() => assertWithinBudget([], base)).toThrow(/No YAML scripts matched/);
  });

  it('does not apply the gate when a batch config owns file selection', () => {
    expect(() => assertWithinBudget([], { ...base, config: 'batch.yaml' })).not.toThrow();
  });
});
