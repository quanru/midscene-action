import { describe, expect, it, rs } from '@rstest/core';

// Minimal Octokit stub shaped like the parts of rest.issues used by upsertComment.
function createOctokit(
  comments: Array<{ id: number; body: string }>,
  options?: { status?: number },
) {
  const listComments = rs.fn(async () => ({ data: comments }));
  const updateComment = rs.fn(async () => ({ data: {} }));
  const createComment = rs.fn(async () => {
    if (options?.status) {
      const error = new Error('forbidden') as Error & { status?: number };
      error.status = options.status;
      throw error;
    }
    return { data: {} };
  });
  const octokit = {
    rest: {
      issues: { listComments, updateComment, createComment },
    },
  };
  return {
    octokit: octokit as unknown as Parameters<typeof import('../src/comment.js').upsertComment>[0],
    listComments,
    updateComment,
    createComment,
  };
}

const target = { owner: 'owner', repo: 'repo', pullRequestNumber: 7 };

describe('upsertComment', () => {
  it('creates a comment when no marker comment exists', async () => {
    const { upsertComment } = await import('../src/comment.js');
    const { octokit, listComments, createComment, updateComment } = createOctokit([]);
    const result = await upsertComment(octokit, target, 'default', 'body');
    expect(result).toBe('created');
    expect(listComments).toHaveBeenCalledTimes(1);
    expect(createComment).toHaveBeenCalledTimes(1);
    expect(updateComment).not.toHaveBeenCalled();
  });

  it('updates the existing marker comment instead of creating a new one', async () => {
    const { upsertComment } = await import('../src/comment.js');
    const { octokit, updateComment, createComment } = createOctokit([
      { id: 99, body: 'before <!-- midscene-action:v1:default --> after' },
    ]);
    const result = await upsertComment(octokit, target, 'default', 'new body');
    expect(result).toBe('updated');
    expect(updateComment).toHaveBeenCalledTimes(1);
    expect(createComment).not.toHaveBeenCalled();
  });

  it('only matches the marker of its own identifier', async () => {
    const { upsertComment } = await import('../src/comment.js');
    const { octokit, createComment } = createOctokit([
      { id: 99, body: '<!-- midscene-action:v1:other -->' },
    ]);
    const result = await upsertComment(octokit, target, 'default', 'body');
    expect(result).toBe('created');
    expect(createComment).toHaveBeenCalledTimes(1);
  });

  it('skips (and does not throw) on a 403 permission error', async () => {
    const { upsertComment } = await import('../src/comment.js');
    const { octokit, createComment } = createOctokit([], { status: 403 });
    const result = await upsertComment(octokit, target, 'default', 'body');
    expect(result).toBe('skipped');
    expect(createComment).toHaveBeenCalledTimes(1);
  });
});
