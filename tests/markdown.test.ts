import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from '@rstest/core';
import { marker, renderCommentBody } from '../src/markdown.js';
import type { SummaryJson } from '../src/types.js';

const meta = {
  identifier: 'default',
  runUrl: 'https://github.com/owner/repo/actions/runs/123',
  actionVersion: '0.1.0',
  cliVersion: '1.13.0',
};

const summary = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures', 'summary.json'), 'utf8'),
) as SummaryJson;

describe('renderCommentBody', () => {
  it('renders a failure headline with failed and passed counts', () => {
    const body = renderCommentBody({ summary, meta });
    expect(body).toContain('2 failed, 1 passed');
    expect(body).toContain(marker('default'));
  });

  it('lists every unsuccessful script with status icons and truncates nothing short', () => {
    const body = renderCommentBody({ summary, meta });
    expect(body).toContain('02-interact.yaml');
    expect(body).toContain('❌ failed');
    expect(body).toContain('⚠️ partialFailed');
    expect(body).toContain('aiAssert: the button label never changed to Done');
  });

  it('shows retries from the attempts array', () => {
    const body = renderCommentBody({ summary, meta });
    const failedRow = body.split('\n').find((line) => line.includes('02-interact.yaml'));
    expect(failedRow).toContain('| 2 |');
  });

  it('links to the workflow run artifacts area and includes versions', () => {
    const body = renderCommentBody({ summary, meta });
    expect(body).toContain('https://github.com/owner/repo/actions/runs/123');
    expect(body).toContain('`midscene-report`');
    expect(body).toContain('`1.13.0`');
  });

  it('renders a success-only headline when every script passes', () => {
    const green: SummaryJson = {
      summary: {
        total: 1,
        successful: 1,
        failed: 0,
        partialFailed: 0,
        notExecuted: 0,
        totalDuration: 5000,
      },
      results: [{ script: 'a.yaml', success: true, resultType: 'successful', duration: 5000 }],
    };
    const body = renderCommentBody({ summary: green, meta });
    expect(body).toContain('1 passed');
    expect(body).not.toContain('| Status |');
  });

  it('explains a fatal setup failure and points to logs', () => {
    const body = renderCommentBody({
      fatalMessage: 'MIDSCENE_MODEL_NAME is not set.\nhttps://example.com/model',
      meta,
    });
    expect(body).toContain('did not run');
    expect(body).toContain('MIDSCENE_MODEL_NAME is not set.');
    expect(body).toContain('workflow run logs');
  });
});
