import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from '@rstest/core';
import { overallSuccess, readSummary } from '../src/summary.js';

describe('readSummary', () => {
  it('resolves report/output paths relative to the summary file directory', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'midscene-summary-'));
    const outputDir = path.join(dir, 'output');
    mkdirSync(outputDir, { recursive: true });
    const summaryPath = path.join(outputDir, 'midscene-summary.json');
    writeFileSync(
      summaryPath,
      JSON.stringify({
        summary: {
          total: 1,
          successful: 1,
          failed: 0,
          partialFailed: 0,
          notExecuted: 0,
          totalDuration: 100,
        },
        results: [
          {
            script: 'a.yaml',
            success: true,
            resultType: 'successful',
            report: '../report/a.html',
            output: 'a-output.json',
          },
        ],
      }),
    );

    const summary = readSummary(summaryPath);
    expect(summary.results[0].report).toBe(path.join(dir, 'report', 'a.html'));
    expect(summary.results[0].output).toBe(path.join(outputDir, 'a-output.json'));
    expect(overallSuccess(summary)).toBe(true);
  });

  it('treats partialFailed and notExecuted as failure', () => {
    const failing = {
      summary: {
        total: 2,
        successful: 1,
        failed: 0,
        partialFailed: 1,
        notExecuted: 0,
        totalDuration: 1,
      },
      results: [],
    };
    expect(overallSuccess(failing)).toBe(false);
    const skipped = {
      summary: {
        total: 2,
        successful: 1,
        failed: 0,
        partialFailed: 0,
        notExecuted: 1,
        totalDuration: 1,
      },
      results: [],
    };
    expect(overallSuccess(skipped)).toBe(false);
  });
});
