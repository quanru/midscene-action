import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import * as core from '@actions/core';
import type { ActionInputs, SummaryJson, SummaryResult } from './types.js';

export function summaryPathFor(inputs: ActionInputs): string {
  return path.join(inputs.runDir, 'output', inputs.summaryName);
}

export function reportDirFor(inputs: ActionInputs): string {
  return path.join(inputs.runDir, 'report');
}

/**
 * Read the batch summary JSON produced by `midscene --summary`.
 * All paths inside the JSON are relative to the directory holding the summary
 * file, so resolve them to absolute paths before consumers use them.
 */
export function readSummary(summaryPath: string): SummaryJson {
  const content = readFileSync(summaryPath, 'utf8');
  const parsed = JSON.parse(content) as SummaryJson;
  if (!parsed.summary || !Array.isArray(parsed.results)) {
    throw new Error(`Summary JSON at ${summaryPath} has an unexpected shape.`);
  }
  const baseDir = path.dirname(summaryPath);
  parsed.results = parsed.results.map((result) => resolveResultPaths(baseDir, result));
  return parsed;
}

function resolveRelative(baseDir: string, value?: string): string | undefined {
  if (!value) return undefined;
  if (path.isAbsolute(value)) return value;
  return path.resolve(baseDir, value);
}

function resolveResultPaths(baseDir: string, result: SummaryResult): SummaryResult {
  return {
    ...result,
    output: resolveRelative(baseDir, result.output),
    report: resolveRelative(baseDir, result.report),
    retryReport: resolveRelative(baseDir, result.retryReport),
    attempts: result.attempts?.map((attempt) => ({
      ...attempt,
      report:
        typeof attempt.report === 'string'
          ? resolveRelative(baseDir, attempt.report)
          : attempt.report,
    })),
  };
}

export function overallSuccess(summary: SummaryJson): boolean {
  const { failed, partialFailed, notExecuted } = summary.summary;
  return failed === 0 && partialFailed === 0 && notExecuted === 0;
}

export function publishSummaryOutputs(inputs: ActionInputs, summary: SummaryJson): void {
  const stats = summary.summary;
  core.setOutput('success', overallSuccess(summary));
  core.setOutput('total', stats.total);
  core.setOutput('successful', stats.successful);
  core.setOutput('failed', stats.failed);
  core.setOutput('partial-failed', stats.partialFailed);
  core.setOutput('not-executed', stats.notExecuted);
  core.setOutput('total-duration', stats.totalDuration);
  core.setOutput('summary-path', summaryPathFor(inputs));
  core.setOutput('report-dir', reportDirFor(inputs));
}

export function summaryExists(inputs: ActionInputs): boolean {
  return existsSync(summaryPathFor(inputs));
}
