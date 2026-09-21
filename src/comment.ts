import * as core from '@actions/core';
import type { getOctokit } from '@actions/github';
import { marker } from './markdown.js';

type Octokit = ReturnType<typeof getOctokit>;

export interface CommentTarget {
  owner: string;
  repo: string;
  pullRequestNumber: number;
}

/**
 * Create or update the single Midscene comment on a pull request.
 * Existing comments are located by a hidden HTML marker so repeated runs edit
 * one thread instead of spamming. Permission errors (fork PR tokens are
 * read-only) degrade to a warning and never fail the action.
 */
export async function upsertComment(
  octokit: Octokit,
  target: CommentTarget,
  identifier: string,
  body: string,
): Promise<'created' | 'updated' | 'skipped'> {
  const { owner, repo, pullRequestNumber } = target;
  const markerText = marker(identifier);

  try {
    const { data: comments } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: pullRequestNumber,
      per_page: 100,
    });
    const existing = comments.find((comment) => comment.body?.includes(markerText));

    if (existing) {
      await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: existing.id,
        body,
      });
      core.info(`Updated existing result comment (id ${existing.id}) on PR #${pullRequestNumber}.`);
      return 'updated';
    }

    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: pullRequestNumber,
      body,
    });
    core.info(`Created result comment on PR #${pullRequestNumber}.`);
    return 'created';
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 403 || status === 401) {
      core.warning(
        `No permission to comment on PR #${pullRequestNumber} (HTTP ${status}). This is expected for pull requests from forks. The report artifact is still available on the workflow run.`,
      );
      return 'skipped';
    }
    core.warning(`Failed to post the result comment: ${(error as Error).message}`);
    return 'skipped';
  }
}
