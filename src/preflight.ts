import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as core from '@actions/core';
import type { Context } from '@actions/github/lib/context.js';
import { DOCS_MODEL_CONFIG_URL } from './constants.js';
import type { ActionInputs } from './types.js';
import { parseDotenv } from './util/env.js';
import { ActionError } from './util/errors.js';

/**
 * The action runtime (node20) and the Node version required by the Midscene
 * CLI are different things: the CLI is spawned as a child process and uses the
 * Node on PATH, so consumers must run actions/setup-node first.
 */
export function assertNodeVersion(current: string = process.version): void {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(current);
  if (!match) {
    throw new ActionError(
      `Cannot parse the current Node version "${current}". The Midscene CLI requires Node ^20.19.0, ^22.12.0 or >=24.0.0.`,
      'Add actions/setup-node before this action.',
    );
  }
  const [, majorStr, minorStr, patchStr] = match;
  const major = Number(majorStr);
  const minor = Number(minorStr);
  const patch = Number(patchStr);
  const supported =
    major === 24 ||
    major > 24 ||
    (major === 20 && (minor > 19 || (minor === 19 && patch >= 0))) ||
    (major === 22 && (minor > 12 || (minor === 12 && patch >= 0)));
  if (!supported) {
    throw new ActionError(
      `The Midscene CLI requires Node ^20.19.0, ^22.12.0 or >=24.0.0, but the runner is using ${current}.`,
      'Add actions/setup-node with node-version 20/22/24 before this action.',
    );
  }
}

/** Read cwd/.env (if any), merging over the real environment without overriding it. */
export function readDotEnv(workingDirectory: string): Record<string, string> {
  const envPath = path.join(workingDirectory, '.env');
  try {
    return parseDotenv(readFileSync(envPath, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }
}

const MODEL_ENV_KEYS = [
  'MIDSCENE_MODEL_NAME',
  'MIDSCENE_MODEL_BASE_URL',
  'MIDSCENE_MODEL_API_KEY',
  'MIDSCENE_MODEL_FAMILY',
];

/**
 * Validate model configuration and mask secrets.
 * The CLI fails on a missing model name; we check up front, before installing
 * the CLI or downloading the browser, because the most common CI cause is an
 * empty secret on fork PRs — the raw CLI error would otherwise surface only
 * after several minutes of setup.
 */
export function preflightModel(dotEnv: Record<string, string>, context: Context): void {
  const modelName = process.env.MIDSCENE_MODEL_NAME || dotEnv.MIDSCENE_MODEL_NAME;
  if (!modelName) {
    const forkPr =
      context.eventName === 'pull_request' &&
      context.payload.pull_request?.head?.repo?.fork === true;
    throw new ActionError(
      forkPr
        ? 'MIDSCENE_MODEL_NAME is not available. Secrets are not passed to pull requests from forks, so this action cannot run model calls on this event.'
        : 'MIDSCENE_MODEL_NAME is not set. Configure it via the env: block of the workflow or a .env file in the working directory.',
      forkPr
        ? 'Run this job only for non-fork pull requests, or trigger it after manual approval. Never use pull_request_target with an untrusted pull request head.'
        : `See ${DOCS_MODEL_CONFIG_URL} for the supported models and configuration.`,
    );
  }

  // Register every secret-ish value with the runner so child-process logs are masked.
  const maskCandidates = [...MODEL_ENV_KEYS, 'OPENAI_API_KEY', 'OPENAI_BASE_URL'];
  for (const key of maskCandidates) {
    const value = process.env[key] ?? dotEnv[key];
    if (value && /(API_KEY|TOKEN|KEY)/.test(key)) {
      core.setSecret(value);
    }
  }
}

export function isForkPullRequest(context: Context): boolean {
  return (
    context.eventName === 'pull_request' && context.payload.pull_request?.head?.repo?.fork === true
  );
}

export function runPreflight(inputs: ActionInputs, context: Context): Record<string, string> {
  assertNodeVersion();
  const dotEnv = readDotEnv(inputs.workingDirectory);
  preflightModel(dotEnv, context);
  return dotEnv;
}
