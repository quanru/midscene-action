import { statSync } from 'node:fs';
import path from 'node:path';
import * as glob from '@actions/glob';
import type { ActionInputs } from './types.js';
import { ActionError } from './util/errors.js';

/**
 * Expand the yaml-files input into a sorted, deduplicated list of absolute
 * YAML file paths, mirroring the CLI behavior:
 *  - a directory expands to **\/*.{yml,yaml};
 *  - glob patterns and explicit files pass through;
 *  - node_modules is always ignored.
 */
export async function expandYamlFiles(inputs: ActionInputs): Promise<string[]> {
  const patterns: string[] = [];
  for (const rawPattern of inputs.yamlPatterns) {
    const absolute = path.resolve(inputs.workingDirectory, rawPattern);
    let isDirectory = false;
    try {
      isDirectory = statSync(absolute).isDirectory();
    } catch {
      // Treat as a glob pattern when the path does not exist as-is.
    }
    if (isDirectory) {
      // @actions/glob does not expand brace expressions, so emit one pattern per extension.
      patterns.push(path.join(absolute, '**', '*.yml').replace(/\\/g, '/'));
      patterns.push(path.join(absolute, '**', '*.yaml').replace(/\\/g, '/'));
    } else {
      patterns.push(absolute.replace(/\\/g, '/'));
    }
  }
  // Always exclude node_modules, regardless of where the directory sits.
  // node_modules is filtered programmatically below: include patterns are
  // absolute paths, while @actions/glob negation patterns are workspace-rooted.
  const globber = await glob.create(patterns.join('\n'), {
    followSymbolicLinks: false,
  });
  const files = (await globber.glob()).filter(
    (file) => !file.includes(`${path.sep}node_modules${path.sep}`),
  );
  return [...new Set(files)].sort((a, b) => a.localeCompare(b));
}

/** Budget gate: fail before spending any model token. */
export function assertWithinBudget(files: string[], inputs: ActionInputs): void {
  if (inputs.config) return; // batch config owns file selection; max-cases applies to yaml-files
  if (inputs.maxCases !== undefined && files.length > inputs.maxCases) {
    throw new ActionError(
      `Found ${files.length} YAML scripts, which exceeds the max-cases budget of ${inputs.maxCases}.`,
      'Raise "max-cases" intentionally or narrow the "yaml-files" patterns. No model calls were made.',
    );
  }
  if (files.length === 0) {
    throw new ActionError(
      `No YAML scripts matched ${inputs.yamlPatterns.join(', ')} under ${inputs.workingDirectory}.`,
    );
  }
}
