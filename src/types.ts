export interface ActionInputs {
  /** Positional YAML files/dirs/globs. Empty when `config` is used. */
  yamlPatterns: string[];
  config?: string;
  setup?: string;
  workingDirectory: string;
  concurrent: number;
  retries: number;
  continueOnError: boolean;
  headed: boolean;
  shareBrowserContext: boolean;
  summaryName: string;
  runDir: string;
  extraArgs: string[];
  cliVersion: string;
  npmRegistry?: string;
  cache: boolean;
  installBrowserDeps: boolean;
  browserExecutable?: string;
  uploadArtifact: boolean;
  artifactName: string;
  artifactExtraPaths: string[];
  retentionDays: number;
  prComment: boolean;
  commentIdentifier: string;
  previewUrl?: string;
  previewEnv: string;
  maxCases?: number;
  timeoutMinutes?: number;
  failOnError: boolean;
  githubToken?: string;
}

export interface SummaryStats {
  total: number;
  successful: number;
  failed: number;
  partialFailed: number;
  notExecuted: number;
  totalDuration: number;
  generatedAt?: string;
}

export interface SummaryAttempt {
  report?: string;
  error?: string;
  duration?: number;
  [key: string]: unknown;
}

export interface SummaryResult {
  script: string;
  success: boolean;
  resultType: 'successful' | 'failed' | 'partialFailed' | 'notExecuted' | string;
  output?: string;
  report?: string;
  retryReport?: string;
  attempts?: SummaryAttempt[];
  error?: string;
  duration?: number;
}

export interface SummaryJson {
  summary: SummaryStats;
  results: SummaryResult[];
}
