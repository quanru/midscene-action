import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Context } from '@actions/github/lib/context.js';
import { describe, expect, it } from '@rstest/core';
import { assertPreviewReferenceResolved, resolvePreviewUrl } from '../src/preview.js';
import type { ActionInputs } from '../src/types.js';

function inputs(overrides: Partial<ActionInputs> = {}): ActionInputs {
  return {
    yamlPatterns: [],
    workingDirectory: '.',
    concurrent: 1,
    retries: 0,
    continueOnError: false,
    headed: false,
    shareBrowserContext: false,
    summaryName: 'summary.json',
    runDir: '/tmp/midscene_run',
    extraArgs: [],
    cliVersion: '',
    cache: true,
    installBrowserDeps: false,
    uploadArtifact: false,
    artifactName: 'midscene-report',
    artifactExtraPaths: [],
    retentionDays: 7,
    prComment: false,
    commentIdentifier: 'default',
    previewEnv: 'MIDSCENE_PREVIEW_URL',
    failOnError: true,
    ...overrides,
  };
}

describe('resolvePreviewUrl', () => {
  it('prefers the explicit input', () => {
    const context = {
      eventName: 'deployment_status',
      payload: {
        deployment_status: { state: 'success', environment_url: 'https://deploy.example' },
      },
    } as unknown as Context;
    expect(resolvePreviewUrl(inputs({ previewUrl: 'https://input.example' }), context)).toBe(
      'https://input.example',
    );
  });

  it('reads environment_url from a successful deployment_status event', () => {
    const context = {
      eventName: 'deployment_status',
      payload: {
        deployment_status: { state: 'success', environment_url: 'https://deploy.example' },
      },
    } as unknown as Context;
    expect(resolvePreviewUrl(inputs(), context)).toBe('https://deploy.example');
  });

  it('ignores non-success deployment states', () => {
    const context = {
      eventName: 'deployment_status',
      payload: {
        deployment_status: { state: 'failure', environment_url: 'https://deploy.example' },
      },
    } as unknown as Context;
    expect(resolvePreviewUrl(inputs(), context)).toBeUndefined();
  });

  it('returns undefined for unrelated events without an input URL', () => {
    const context = { eventName: 'pull_request', payload: {} } as unknown as Context;
    expect(resolvePreviewUrl(inputs(), context)).toBeUndefined();
  });
});

describe('assertPreviewReferenceResolved', () => {
  it('throws with an actionable message when YAML references an unresolved preview var', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'midscene-preview-'));
    const file = path.join(dir, 'case.yaml');
    writeFileSync(file, 'web:\n  url: ${MIDSCENE_PREVIEW_URL}\n');
    expect(() => assertPreviewReferenceResolved(inputs(), [file], undefined)).toThrow(
      /no preview URL was resolved/,
    );
  });

  it('does nothing when the URL is resolved or the variable is unused', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'midscene-preview-'));
    const file = path.join(dir, 'case.yaml');
    writeFileSync(file, 'web:\n  url: https://example.com\n');
    expect(() => assertPreviewReferenceResolved(inputs(), [file], undefined)).not.toThrow();
    writeFileSync(file, 'web:\n  url: ${MIDSCENE_PREVIEW_URL}\n');
    expect(() =>
      assertPreviewReferenceResolved(inputs(), [file], 'https://deploy.example'),
    ).not.toThrow();
  });
});
