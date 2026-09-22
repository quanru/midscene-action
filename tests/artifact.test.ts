import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from '@rstest/core';
import { artifactFilesFor } from '../src/artifact.js';

describe('artifactFilesFor', () => {
  it('returns nested files without directory entries', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'midscene-artifact-'));
    const screenshots = path.join(root, 'screenshots');
    mkdirSync(screenshots);
    const report = path.join(root, 'report.html');
    const screenshot = path.join(screenshots, 'page.jpeg');
    writeFileSync(report, '<html></html>');
    writeFileSync(screenshot, 'image');

    const files = await artifactFilesFor(root);

    expect(files.sort()).toEqual([report, screenshot].sort());
    expect(files).not.toContain(screenshots);
  });

  it('keeps a single file root', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'midscene-artifact-file-'));
    const file = path.join(root, 'summary.json');
    writeFileSync(file, '{}');

    expect(await artifactFilesFor(file)).toEqual([file]);
  });
});
