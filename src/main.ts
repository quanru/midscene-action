import { existsSync } from 'node:fs';
import * as core from '@actions/core';
import { context } from '@actions/github';
import { resolveExtraPaths, uploadReports } from './artifact.js';
import { ensureBrowser } from './browser.js';
import { assertWithinBudget, expandYamlFiles } from './cases.js';
import { upsertComment } from './comment.js';
import { ACTION_VERSION, DEFAULT_CLI_VERSION, DOCS_ACTION_URL } from './constants.js';
import { getGitHub, pullRequestNumber, workflowRunUrl } from './github.js';
import { parseInputs } from './input.js';
import { installCli } from './install-cli.js';
import { renderCommentBody } from './markdown.js';
import { isForkPullRequest, runPreflight } from './preflight.js';
import { applyPreview, assertPreviewReferenceResolved } from './preview.js';
import { runMidscene } from './run-midscene.js';
import { overallSuccess, publishSummaryOutputs, readSummary, summaryPathFor } from './summary.js';
import type { ActionInputs } from './types.js';
import type { SummaryJson } from './types.js';
import { ActionError } from './util/errors.js';

function formatError(error: unknown): string {
  if (error instanceof ActionError) {
    return error.hint ? `${error.message}\n${error.hint}` : error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

async function execute(inputs: ActionInputs): Promise<{
  summary?: SummaryJson;
  fatalMessage?: string;
  cliVersion: string;
}> {
  let cliVersion = inputs.cliVersion || DEFAULT_CLI_VERSION;
  let summary: SummaryJson | undefined;

  const expandedFiles: string[] = await core.group('Preflight checks', async () => {
    runPreflight(inputs, context);
    const previewUrl = applyPreview(inputs, context);
    if (inputs.config) return [];
    const files = await expandYamlFiles(inputs);
    assertWithinBudget(files, inputs);
    assertPreviewReferenceResolved(inputs, files, previewUrl);
    return files;
  });

  const installed = await core.group('Install @midscene/cli', () => installCli(inputs));
  cliVersion = installed.version;

  await core.group('Prepare browser', () => ensureBrowser(inputs, installed));

  const runResult = await core.group('Run Midscene scripts', () =>
    runMidscene(inputs, installed, expandedFiles),
  );

  const summaryPath = summaryPathFor(inputs);
  if (existsSync(summaryPath)) {
    summary = readSummary(summaryPath);
    publishSummaryOutputs(inputs, summary);
    if (!overallSuccess(summary)) {
      for (const result of summary.results.filter((item) => !item.success)) {
        core.error(
          `[${result.resultType}] ${result.script}: ${result.error ?? 'no error message'}`,
        );
      }
    }
  } else {
    let fatalMessage: string;
    if (runResult.timedOut) {
      fatalMessage = `Midscene CLI timed out after ${inputs.timeoutMinutes} minute(s) and produced no summary JSON. Reports generated before the timeout were still uploaded.`;
    } else if (runResult.exitCode !== 0) {
      fatalMessage = `Midscene CLI exited with code ${runResult.exitCode ?? runResult.signal} before producing a result summary. This usually indicates an environment or configuration problem rather than a failed assertion.`;
    } else {
      fatalMessage = `Midscene CLI reported success but the summary file is missing: ${summaryPath}`;
    }
    return { fatalMessage, cliVersion };
  }

  return { summary, cliVersion };
}

async function run(): Promise<void> {
  let inputs: ActionInputs | undefined;
  let summary: SummaryJson | undefined;
  let fatalMessage: string | undefined;
  let cliVersion = DEFAULT_CLI_VERSION;

  try {
    inputs = parseInputs();
    const result = await execute(inputs);
    summary = result.summary;
    fatalMessage = result.fatalMessage;
    cliVersion = result.cliVersion;
  } catch (error) {
    fatalMessage = formatError(error);
  }

  const runUrl = workflowRunUrl(context);
  core.setOutput('run-url', runUrl);

  if (inputs) {
    await core
      .group('Upload report artifacts', () =>
        uploadReports(inputs as ActionInputs, resolveExtraPaths(inputs as ActionInputs)),
      )
      .catch((error: unknown) => core.warning(`Artifact upload failed: ${formatError(error)}`));

    if (inputs.prComment) {
      const prNumber = pullRequestNumber(context);
      const octokit = getGitHub(inputs.githubToken);
      if (!prNumber) {
        core.info(
          'Not a pull request event; skipping the result comment (v0.1 comments on pull_request events only).',
        );
      } else if (isForkPullRequest(context)) {
        core.info('Pull request comes from a fork; skipping the result comment (read-only token).');
      } else if (!octokit) {
        core.warning('No GitHub token available; skipping the result comment.');
      } else {
        await core.group('Post pull request comment', () =>
          upsertComment(
            octokit,
            {
              owner: context.repo.owner,
              repo: context.repo.repo,
              pullRequestNumber: prNumber as number,
            },
            inputs.commentIdentifier,
            renderCommentBody({
              summary,
              fatalMessage,
              meta: {
                identifier: inputs.commentIdentifier,
                runUrl,
                actionVersion: ACTION_VERSION,
                cliVersion,
              },
            }),
          ),
        );
      }
    }
  }

  if (fatalMessage) {
    if (inputs?.failOnError ?? true) {
      core.setFailed(`${fatalMessage}\nSee ${DOCS_ACTION_URL} for setup guidance.`);
    } else {
      core.warning(fatalMessage);
    }
    return;
  }

  if (summary && !overallSuccess(summary) && inputs?.failOnError) {
    const { failed, partialFailed, notExecuted } = summary.summary;
    core.setFailed(
      `Midscene finished with ${failed} failed, ${partialFailed} partially failed and ${notExecuted} not executed script(s). ` +
        `Download the ${inputs.artifactName} artifact from the workflow run for HTML reports.`,
    );
  }
}

run().catch((error: unknown) => {
  core.setFailed(formatError(error));
});
