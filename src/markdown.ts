import { COMMENT_ERROR_LIMIT, FAILURE_RESULT_TYPES, MARKER_PREFIX } from './constants.js';
import type { SummaryJson, SummaryResult } from './types.js';

export interface CommentMeta {
  identifier: string;
  runUrl: string;
  actionVersion: string;
  cliVersion: string;
}

export interface CommentInput {
  summary?: SummaryJson;
  /** Set when the run never produced a summary (setup/configuration failure or timeout). */
  fatalMessage?: string;
  meta: CommentMeta;
}

export function marker(identifier: string): string {
  return `<!-- ${MARKER_PREFIX}:${identifier} -->`;
}

function truncate(text: string | undefined, limit = COMMENT_ERROR_LIMIT): string {
  if (!text) return '';
  const singleLine = text.replace(/\s*\n\s*/g, ' ').trim();
  return singleLine.length > limit ? `${singleLine.slice(0, limit - 1)}…` : singleLine;
}

function statusIcon(resultType: string, success: boolean): string {
  if (success) return '✅';
  if (resultType === 'partialFailed') return '⚠️';
  if (resultType === 'notExecuted') return '⏭️';
  return '❌';
}

function retryCount(result: SummaryResult): string {
  const attempts = result.attempts?.length ?? 0;
  return attempts > 0 ? String(attempts) : '0';
}

function formatDuration(ms: number | undefined): string {
  if (!ms && ms !== 0) return '—';
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function resultTable(results: SummaryResult[]): string {
  const rows = [
    '| Status | Script | Error | Retries | Duration |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const result of results) {
    const status = `${statusIcon(result.resultType, result.success)} ${result.resultType}`;
    const script = `\`${result.script.replace(/\|/g, '\\|')}\``;
    const error = truncate(result.error).replace(/\|/g, '\\|');
    rows.push(
      `| ${status} | ${script} | ${error} | ${retryCount(result)} | ${formatDuration(result.duration)} |`,
    );
  }
  return rows.join('\n');
}

export function renderCommentBody({ summary, fatalMessage, meta }: CommentInput): string {
  const lines: string[] = [marker(meta.identifier), ''];

  if (!summary) {
    lines.push('## 🤖 Midscene Test — did not run');
    lines.push('');
    lines.push('The Midscene run ended before producing a result summary:');
    lines.push('');
    lines.push(`> ${truncate(fatalMessage, 600)}`);
    lines.push('');
    lines.push(`Check the [workflow run logs](${meta.runUrl}) for details.`);
    lines.push('');
    lines.push(footer(meta));
    return lines.join('\n');
  }

  const { total, successful, failed, partialFailed, notExecuted, totalDuration } = summary.summary;
  const problems = failed + partialFailed + notExecuted;
  const title =
    problems === 0
      ? `## 🤖 Midscene Test — ${successful} passed`
      : `## 🤖 Midscene Test — ${problems} failed, ${successful} passed`;
  lines.push(title, '');

  const failedResults = summary.results.filter(
    (result) => !result.success || FAILURE_RESULT_TYPES.has(result.resultType),
  );
  if (failedResults.length > 0) {
    lines.push(resultTable(failedResults));
    lines.push('');
  }

  lines.push(
    `Total: ${total} · Duration: ${formatDuration(totalDuration)} · ` +
      `HTML reports: download the \`midscene-report\` artifact from the [workflow run](${meta.runUrl}) (Artifacts area).`,
  );
  lines.push('');
  lines.push(footer(meta));
  return lines.join('\n');
}

function footer(meta: CommentMeta): string {
  return `🔁 [Re-run](${meta.runUrl}) · Action \`${meta.actionVersion}\` · CLI \`${meta.cliVersion}\``;
}
