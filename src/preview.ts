import { readFileSync } from 'node:fs';
import * as core from '@actions/core';
import type { Context } from '@actions/github/lib/context.js';
import type { ActionInputs } from './types.js';
import { ActionError } from './util/errors.js';

/**
 * Resolve the preview URL:
 *   1. explicit `preview-url` input;
 *   2. environment_url of a successful deployment_status event;
 *   3. undefined.
 * Exported as an env var so YAML can reference ${MIDSCENE_PREVIEW_URL}.
 */
export function resolvePreviewUrl(inputs: ActionInputs, context: Context): string | undefined {
  if (inputs.previewUrl) return inputs.previewUrl;
  if (context.eventName === 'deployment_status') {
    const status = context.payload.deployment_status;
    if (status?.state === 'success' && status.environment_url) {
      return status.environment_url as string;
    }
  }
  return undefined;
}

export function applyPreview(inputs: ActionInputs, context: Context): string | undefined {
  const url = resolvePreviewUrl(inputs, context);
  if (url) {
    core.exportVariable(inputs.previewEnv, url);
    core.setOutput('preview-url', url);
    core.info(`Preview URL resolved and exported as ${inputs.previewEnv}: ${url}`);
  }
  return url;
}

/**
 * Fail early with an actionable message when the expanded YAML files reference
 * the preview env variable but no URL could be resolved (the CLI itself throws
 * on undefined ${VAR} interpolation, but only after browser setup).
 */
export function assertPreviewReferenceResolved(
  inputs: ActionInputs,
  yamlFiles: string[],
  url: string | undefined,
): void {
  if (url) return;
  const token = new RegExp(`\\$\\{\\s*${inputs.previewEnv}\\s*\\}`);
  for (const file of yamlFiles) {
    const content = readFileSync(file, 'utf8');
    if (token.test(content)) {
      throw new ActionError(
        `YAML file ${file} references \${${inputs.previewEnv}}, but no preview URL was resolved.`,
        'Set the "preview-url" input, run on a successful deployment_status event with environment_url, or provide the URL yourself.',
      );
    }
  }
}
