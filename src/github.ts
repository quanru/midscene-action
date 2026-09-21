import { getOctokit as getActionsOctokit } from '@actions/github';
import type { Context } from '@actions/github/lib/context.js';

export function getGitHub(
  token: string | undefined,
): ReturnType<typeof getActionsOctokit> | undefined {
  if (!token) return undefined;
  return getActionsOctokit(token);
}

/** Link to the workflow run page; report artifacts are downloaded from its Artifacts area. */
export function workflowRunUrl(context: Context): string {
  return `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;
}

export function pullRequestNumber(context: Context): number | undefined {
  return context.payload.pull_request?.number;
}
