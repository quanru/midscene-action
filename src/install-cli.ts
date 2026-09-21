import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import * as cache from '@actions/cache';
import * as core from '@actions/core';
import { exec, getExecOutput } from '@actions/exec';
import { DEFAULT_CLI_VERSION } from './constants.js';
import type { ActionInputs } from './types.js';

export interface InstalledCli {
  /** Absolute path of the midscene executable (without .cmd suffix). */
  binPath: string;
  installDir: string;
  /** Resolved exact @midscene/cli version. */
  version: string;
  /** Puppeteer version bundled by the installed CLI. */
  puppeteerVersion: string;
}

async function getNpmCacheDir(): Promise<string> {
  const { stdout } = await getExecOutput('npm', ['config', 'get', 'cache'], { silent: true });
  return stdout.trim();
}

function puppeteerCacheDir(): string {
  return (
    process.env.PUPPETEER_CACHE_DIR ||
    path.join(process.env.HOME || tmpdir(), '.cache', 'puppeteer')
  );
}

async function restoreCaches(
  versionKey: string,
): Promise<{ npmHit: boolean; puppeteerHit: boolean }> {
  const npmCacheDir = await getNpmCacheDir();
  const puppeteerDir = puppeteerCacheDir();
  const npmKey = `midscene-action-npm-${process.platform}-${process.arch}-${versionKey}`;
  const puppeteerKey = `midscene-action-puppeteer-${process.platform}-${process.arch}-${versionKey}`;
  const npmHit = (await cache.restoreCache([npmCacheDir], npmKey)) !== undefined;
  const puppeteerHit = (await cache.restoreCache([puppeteerDir], puppeteerKey)) !== undefined;
  return { npmHit, puppeteerHit };
}

async function saveCaches(
  versionKey: string,
  hadNpmHit: boolean,
  hadPuppeteerHit: boolean,
): Promise<void> {
  const npmCacheDir = await getNpmCacheDir();
  const puppeteerDir = puppeteerCacheDir();
  const npmKey = `midscene-action-npm-${process.platform}-${process.arch}-${versionKey}`;
  const puppeteerKey = `midscene-action-puppeteer-${process.platform}-${process.arch}-${versionKey}`;
  if (!hadNpmHit) {
    await cache.saveCache([npmCacheDir], npmKey).catch((error: unknown) => {
      core.warning(`Failed to save npm cache: ${(error as Error).message}`);
    });
  }
  if (!hadPuppeteerHit) {
    await cache.saveCache([puppeteerDir], puppeteerKey).catch((error: unknown) => {
      core.warning(`Failed to save Puppeteer cache: ${(error as Error).message}`);
    });
  }
}

/**
 * Install @midscene/cli into an isolated RUNNER_TEMP prefix.
 * - never use `npm i -g` (global pollution, sudo on some runners);
 * - never use bare `npx` (non-deterministic version resolution);
 * - the Puppeteer postinstall of the CLI downloads Chrome for Testing, which
 *   is why the Puppeteer cache directory is restored first.
 */
export async function installCli(inputs: ActionInputs): Promise<InstalledCli> {
  const version = inputs.cliVersion || DEFAULT_CLI_VERSION;
  const spec =
    /^https?:\/\//.test(version) || /^[./]|\.tgz$/.test(version)
      ? version
      : `@midscene/cli@${version}`;
  core.info(`Installing ${spec} ...`);

  let hadNpmHit = false;
  let hadPuppeteerHit = false;
  if (inputs.cache) {
    try {
      ({ npmHit: hadNpmHit, puppeteerHit: hadPuppeteerHit } = await restoreCaches(
        inputs.cliVersion || DEFAULT_CLI_VERSION,
      ));
    } catch (error) {
      core.warning(`Cache restore failed, continuing without cache: ${(error as Error).message}`);
    }
  }

  const installDir = process.env.RUNNER_TEMP
    ? path.join(process.env.RUNNER_TEMP, 'midscene-cli')
    : mkdtempSync(path.join(tmpdir(), 'midscene-cli-'));
  const npmArgs = ['install', '--prefix', installDir, '--no-audit', '--no-fund', spec];
  const npmEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) npmEnv[key] = value;
  }
  if (inputs.npmRegistry) {
    npmEnv.npm_config_registry = inputs.npmRegistry;
  }
  await exec('npm', npmArgs, { env: npmEnv });

  if (inputs.cache) {
    await saveCaches(inputs.cliVersion || DEFAULT_CLI_VERSION, hadNpmHit, hadPuppeteerHit);
  }

  const cliPackageJsonPath = path.join(
    installDir,
    'node_modules',
    '@midscene',
    'cli',
    'package.json',
  );
  const cliPackageJson = JSON.parse(readFileSync(cliPackageJsonPath, 'utf8')) as {
    version: string;
  };
  const puppeteerPackageJsonPath = path.join(
    installDir,
    'node_modules',
    'puppeteer',
    'package.json',
  );
  let puppeteerVersion = 'unknown';
  try {
    puppeteerVersion = (
      JSON.parse(readFileSync(puppeteerPackageJsonPath, 'utf8')) as { version: string }
    ).version;
  } catch {
    core.warning('Could not read the Puppeteer version bundled by the CLI.');
  }

  const binPath = path.join(installDir, 'node_modules', '.bin', 'midscene');
  return { binPath, installDir, version: cliPackageJson.version, puppeteerVersion };
}
