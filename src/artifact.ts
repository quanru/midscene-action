import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { DefaultArtifactClient } from '@actions/artifact';
import * as core from '@actions/core';
import * as glob from '@actions/glob';
import { reportDirFor } from './summary.js';
import type { ActionInputs } from './types.js';

/** Expand an artifact root to files only; directory entries break ZIP extraction. */
export async function artifactFilesFor(root: string): Promise<string[]> {
  const isDirectory = statSync(root).isDirectory();
  if (!isDirectory) return [root.replace(/\\/g, '/')];

  const pattern = path.join(root, '**', '*').replace(/\\/g, '/');
  const globber = await glob.create(pattern, {
    followSymbolicLinks: false,
    matchDirectories: false,
  });
  return globber.glob();
}

/**
 * Upload the self-contained HTML report directory (and any extra paths) as a
 * workflow artifact. Always attempted, even when the run failed: the whole
 * point of uploading is to inspect failures.
 */
export async function uploadReports(
  inputs: ActionInputs,
  extraReportFiles: string[] = [],
): Promise<void> {
  if (!inputs.uploadArtifact) return;
  const reportDir = reportDirFor(inputs);
  const roots = [reportDir, ...extraReportFiles];

  for (const root of roots) {
    if (!existsSync(root)) {
      core.warning(`Artifact path does not exist, skipping: ${root}`);
      continue;
    }
    try {
      const isDirectory = statSync(root).isDirectory();
      const files = await artifactFilesFor(root);
      if (files.length === 0) {
        core.info(`No files found under ${root}, skipping artifact upload.`);
        continue;
      }
      const artifact = new DefaultArtifactClient();
      const suffix = root === reportDir ? '' : `-${path.basename(root)}`;
      const { id } = await artifact.uploadArtifact(
        `${inputs.artifactName}${suffix}`,
        files,
        isDirectory ? root : path.dirname(root),
        { retentionDays: inputs.retentionDays },
      );
      core.info(`Uploaded artifact "${inputs.artifactName}${suffix}" (id ${id}) from ${root}`);
    } catch (error) {
      // Artifact problems must never mask the test conclusion.
      core.warning(`Failed to upload artifact from ${root}: ${(error as Error).message}`);
    }
  }
}

/** Resolve artifact-extra-paths (relative to working dir) plus output/log dirs on demand. */
export function resolveExtraPaths(inputs: ActionInputs): string[] {
  return inputs.artifactExtraPaths.map((p) => path.resolve(inputs.workingDirectory, p));
}
