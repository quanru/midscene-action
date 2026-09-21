import { spawn } from 'node:child_process';
import * as core from '@actions/core';
import type { InstalledCli } from './install-cli.js';
import type { ActionInputs } from './types.js';
import { ActionError } from './util/errors.js';

export function buildArgv(inputs: ActionInputs, expandedFiles: string[]): string[] {
  const argv: string[] = [];
  if (inputs.config) {
    argv.push('--config', inputs.config);
  } else {
    argv.push(...expandedFiles);
  }
  if (inputs.setup) argv.push('--setup', inputs.setup);
  argv.push('--summary', inputs.summaryName);
  argv.push('--concurrent', String(inputs.concurrent));
  argv.push('--retry', String(inputs.retries));
  if (inputs.continueOnError) argv.push('--continue-on-error');
  if (inputs.headed) argv.push('--headed');
  if (inputs.shareBrowserContext) argv.push('--share-browser-context');
  argv.push(...inputs.extraArgs);
  return argv;
}

export interface RunResult {
  exitCode: number | null;
  timedOut: boolean;
  signal: NodeJS.Signals | null;
}

function executableForPlatform(binPath: string): { command: string; prefixArgs: string[] } {
  if (process.platform === 'win32') {
    // .bin/midscene is a shell shim on Windows; invoke through cmd.
    return { command: 'cmd', prefixArgs: ['/c', `${binPath}.cmd`] };
  }
  return { command: binPath, prefixArgs: [] };
}

/**
 * Spawn the Midscene CLI. The exit code is captured but never thrown: case
 * failures exit 1 and must still flow into summary parsing, artifact upload
 * and PR commenting. A wall-clock timeout kills the whole process group;
 * reports produced before the timeout are still uploaded afterwards.
 */
export function runMidscene(
  inputs: ActionInputs,
  installed: InstalledCli,
  expandedFiles: string[],
): Promise<RunResult> {
  const { command, prefixArgs } = executableForPlatform(installed.binPath);
  const args = [...prefixArgs, ...buildArgv(inputs, expandedFiles)];
  const timeoutMs = inputs.timeoutMinutes ? inputs.timeoutMinutes * 60_000 : undefined;

  return new Promise((resolve, reject) => {
    core.info(`Running: midscene ${args.slice(prefixArgs.length).join(' ')}`);
    // The GITHUB_TOKEN is deliberately not forwarded; MIDSCENE_RUN_DIR pins the
    // artifact root so summary/report parsing has deterministic paths.
    const child = spawn(command, args, {
      cwd: inputs.workingDirectory,
      env: {
        ...process.env,
        CI: '1',
        MIDSCENE_RUN_DIR: inputs.runDir,
        ...(inputs.browserExecutable
          ? { PUPPETEER_EXECUTABLE_PATH: inputs.browserExecutable }
          : {}),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });

    child.stdout?.on('data', (chunk) => process.stdout.write(chunk));
    child.stderr?.on('data', (chunk) => process.stderr.write(chunk));

    let timedOut = false;
    const timer = timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          core.warning(
            `Midscene CLI exceeded the ${inputs.timeoutMinutes} minute timeout; stopping.`,
          );
          if (process.platform === 'win32') {
            spawn('taskkill', ['/pid', String(child.pid), '/T', '/F']);
          } else if (child.pid) {
            try {
              process.kill(-child.pid, 'SIGKILL');
            } catch {
              child.kill('SIGKILL');
            }
          }
        }, timeoutMs)
      : undefined;

    child.on('error', (error) => {
      if (timer) clearTimeout(timer);
      reject(new ActionError(`Failed to start the Midscene CLI: ${error.message}`));
    });

    child.on('close', (exitCode, signal) => {
      if (timer) clearTimeout(timer);
      resolve({ exitCode, timedOut, signal });
    });
  });
}
