/** Action version, kept in sync with package.json at release time. */
export const ACTION_VERSION = '0.1.0';

/**
 * Default pinned @midscene/cli version. Bumped via scripts/bump-cli-version.mjs.
 * Pinning (instead of "latest") keeps runs reproducible and lets the Puppeteer
 * browser cache key stay stable.
 */
export const DEFAULT_CLI_VERSION = '1.13.0';

export const DOCS_MODEL_CONFIG_URL = 'https://midscenejs.com/model-common-config';
export const DOCS_ACTION_URL = 'https://midscenejs.com/integrate-with-github-actions';

export const MARKER_PREFIX = 'midscene-action:v1';

/** CLI result types that count as failure for the action conclusion. */
export const FAILURE_RESULT_TYPES = new Set(['failed', 'partialFailed', 'notExecuted']);

/** Chrome system packages installed on Linux when missing. Aligned with the
 * headless browser setup in the midscene monorepo (minus xvfb). */
export const LINUX_CHROME_DEPS = [
  'libasound2',
  'libatk-bridge2.0-0',
  'libatk1.0-0',
  'libatspi2.0-0',
  'libcairo2',
  'libcups2',
  'libdbus-1-3',
  'libdrm2',
  'libexpat1',
  'libgbm1',
  'libglib2.0-0',
  'libgtk-3-0',
  'libnspr4',
  'libnss3',
  'libpango-1.0-0',
  'libx11-6',
  'libxcb1',
  'libxcomposite1',
  'libxdamage1',
  'libxext6',
  'libxfixes3',
  'libxkbcommon0',
  'libxrandr2',
];

/** Maximum characters of a single error cell in the PR comment. */
export const COMMENT_ERROR_LIMIT = 300;
