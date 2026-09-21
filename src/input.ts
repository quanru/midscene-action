import { existsSync } from 'node:fs';
import path from 'node:path';
import * as core from '@actions/core';
import type { ActionInputs } from './types.js';
import { ActionError } from './util/errors.js';

const FORBIDDEN_EXTRA_ARGS = new Set(['--keep-window']);

function getBoolean(name: string): boolean {
  return core.getBooleanInput(name);
}

function getInteger(name: string): number | undefined {
  const raw = core.getInput(name).trim();
  if (!raw) return undefined;
  if (!/^\d+$/.test(raw)) {
    throw new ActionError(`Input "${name}" must be a non-negative integer, got "${raw}".`);
  }
  return Number.parseInt(raw, 10);
}

function getMultiLine(name: string): string[] {
  return core
    .getMultilineInput(name)
    .flatMap((line) => line.trim().split(/\s+/))
    .filter(Boolean);
}

/**
 * extra-args is an escape hatch. Reject anything that can hang CI
 * (--keep-window) or inject shell constructs (arguments are passed without a
 * shell, but stay strict anyway).
 */
function parseExtraArgs(raw: string): string[] {
  const args = raw
    .split(/\s+/)
    .map((arg) => arg.trim())
    .filter(Boolean);
  for (const arg of args) {
    if (FORBIDDEN_EXTRA_ARGS.has(arg)) {
      throw new ActionError(`Input "extra-args" must not contain "${arg}".`);
    }
    if (/[;&|`$<>]/.test(arg)) {
      throw new ActionError(`Input "extra-args" contains an unsupported character: "${arg}".`);
    }
  }
  return args;
}

export function parseInputs(): ActionInputs {
  const config = core.getInput('config').trim() || undefined;
  const yamlPatterns = getMultiLine('yaml-files');
  if (
    config &&
    yamlPatterns.length > 0 &&
    core.getInput('yaml-files').trim() !== 'midscene-scripts'
  ) {
    throw new ActionError(
      'Inputs "yaml-files" and "config" are mutually exclusive; specify only one.',
    );
  }
  // Default yaml-files applies when config is not given.
  const patterns = config ? [] : yamlPatterns.length > 0 ? yamlPatterns : ['midscene-scripts'];

  const workingDirectory = path.resolve(core.getInput('working-directory') || '.');
  if (!existsSync(workingDirectory)) {
    throw new ActionError(`Working directory does not exist: ${workingDirectory}`);
  }

  const runDirInput = core.getInput('run-dir').trim() || 'midscene_run';
  const runDir = path.resolve(workingDirectory, runDirInput);

  const concurrent = getInteger('concurrent') ?? 1;
  const retries = getInteger('retries') ?? 0;
  const maxCases = getInteger('max-cases');
  const timeoutMinutes = getInteger('timeout-minutes');
  const retentionDays = getInteger('retention-days') ?? 7;

  const summaryName = core.getInput('summary-name').trim() || 'midscene-summary.json';
  if (path.isAbsolute(summaryName) || summaryName.includes('..')) {
    throw new ActionError('Input "summary-name" must be a plain file name without path segments.');
  }

  return {
    yamlPatterns: patterns,
    config,
    setup: core.getInput('setup').trim() || undefined,
    workingDirectory,
    concurrent,
    retries,
    continueOnError: getBoolean('continue-on-error'),
    headed: getBoolean('headed'),
    shareBrowserContext: getBoolean('share-browser-context'),
    summaryName,
    runDir,
    extraArgs: parseExtraArgs(core.getInput('extra-args')),
    cliVersion: core.getInput('cli-version').trim(),
    npmRegistry: core.getInput('npm-registry').trim() || undefined,
    cache: getBoolean('cache'),
    installBrowserDeps: getBoolean('install-browser-deps'),
    browserExecutable: core.getInput('browser-executable').trim() || undefined,
    uploadArtifact: getBoolean('upload-artifact'),
    artifactName: core.getInput('artifact-name').trim() || 'midscene-report',
    artifactExtraPaths: getMultiLine('artifact-extra-paths'),
    retentionDays,
    prComment: getBoolean('pr-comment'),
    commentIdentifier: core.getInput('comment-identifier').trim() || 'default',
    previewUrl: core.getInput('preview-url').trim() || undefined,
    previewEnv: core.getInput('preview-env').trim() || 'MIDSCENE_PREVIEW_URL',
    maxCases,
    timeoutMinutes,
    failOnError: getBoolean('fail-on-error'),
    githubToken: core.getInput('github-token').trim() || undefined,
  };
}
