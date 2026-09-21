import { execFileSync } from 'node:child_process';
import * as core from '@actions/core';
import { exec } from '@actions/exec';
import { LINUX_CHROME_DEPS } from './constants.js';
import type { InstalledCli } from './install-cli.js';
import type { ActionInputs } from './types.js';
import { ActionError } from './util/errors.js';

/**
 * Resolve the Chrome executable installed by the CLI's Puppeteer dependency.
 * Run in a child Node process rooted at the install directory so the action
 * bundle never needs to include Puppeteer.
 */
export function resolvePuppeteerExecutable(installDir: string): string {
  const script = "process.stdout.write(require('puppeteer').executablePath())";
  const output = execFileSync(process.execPath, ['-e', script], {
    cwd: installDir,
    encoding: 'utf8',
  }).trim();
  if (!output) {
    throw new ActionError(
      'Puppeteer reported an empty Chrome executable path. Browser installation may have failed during npm install.',
    );
  }
  return output;
}

/** Return the subset of LINUX_CHROME_DEPS that is not installed (dpkg-based distros). */
async function missingDeps(): Promise<string[]> {
  let output = '';
  // Emit one "name<TAB>status" row per package. Missing packages produce no
  // stdout row (plus a stderr notice), so a non-zero exit code is expected
  // whenever something is missing: collect rows and diff by package name.
  await exec('dpkg-query', ['-W', '-f=${binary:Package}\t${Status}\n', ...LINUX_CHROME_DEPS], {
    silent: true,
    ignoreReturnCode: true,
    listeners: {
      stdout: (data) => {
        output += data.toString();
      },
    },
  }).catch(() => {
    // Fall through: an empty output marks every package as missing.
  });
  const installed = new Set<string>();
  for (const line of output.trim().split(/\r?\n/)) {
    const [name, status] = line.split('\t');
    if (name && status === 'install ok installed') installed.add(name);
  }
  return LINUX_CHROME_DEPS.filter((dep) => !installed.has(dep));
}

async function installLinuxDeps(): Promise<void> {
  const missing = await missingDeps();
  if (missing.length === 0) {
    core.info('All Chrome system dependencies are already installed.');
    return;
  }
  core.info(`Installing missing Chrome system dependencies: ${missing.join(', ')}`);
  // GitHub-hosted runners run passwordless sudo; skip sudo when root.
  const sudoArgs = process.getuid && process.getuid() === 0 ? [] : ['sudo'];
  await exec(sudoArgs[0] ?? 'apt-get', [...sudoArgs.slice(1), 'apt-get', 'update', '-y'], {
    silent: true,
  }).catch(() => {
    core.warning('apt-get update failed; trying install anyway.');
  });
  await exec(
    sudoArgs[0] ?? 'apt-get',
    [...sudoArgs.slice(1), 'apt-get', 'install', '-y', '--no-install-recommends', ...missing],
    { silent: true },
  );
}

/**
 * Make sure a Chrome binary is available to the child CLI.
 * The CLI bundles Puppeteer (not puppeteer-core), so Chrome for Testing is
 * downloaded during npm install; this step only validates it and fills Linux
 * system package gaps on bare runners.
 */
export async function ensureBrowser(
  inputs: ActionInputs,
  installed: InstalledCli,
): Promise<string> {
  if (inputs.browserExecutable) {
    core.exportVariable('PUPPETEER_EXECUTABLE_PATH', inputs.browserExecutable);
    return inputs.browserExecutable;
  }
  if (process.platform === 'linux' && inputs.installBrowserDeps) {
    await installLinuxDeps().catch((error: unknown) => {
      core.warning(
        `Could not install Chrome system dependencies automatically: ${(error as Error).message}. If Chrome fails to start, install them manually or set "install-browser-deps: false".`,
      );
    });
  }
  const executablePath = resolvePuppeteerExecutable(installed.installDir);
  core.info(`Using Chrome executable: ${executablePath} (Puppeteer ${installed.puppeteerVersion})`);
  return executablePath;
}
