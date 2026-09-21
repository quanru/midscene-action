# midscene-action

Run [Midscene](https://midscenejs.com) YAML scripts on **your own GitHub Actions runner** — the model, the browser and the tested page all stay in your infrastructure. The action installs [`@midscene/cli`](https://www.npmjs.com/package/@midscene/cli), runs your YAML cases, uploads the self-contained HTML reports as artifacts and upserts a result comment on the pull request.

> [!NOTE]
> This action runs Midscene itself. It is **not** a thin trigger for a vendor cloud: everything executes on your runner with your own model API Key.

## Why use it

- One step from YAML scripts in your repository to PR test results.
- Results come through the standard GitHub job conclusion (a merge gate without a third-party service).
- Self-contained HTML reports (screenshots inline) are kept as workflow artifacts, never sent to an external report host.
- Preview deployments are covered: pass a URL explicitly or let the action read `environment_url` from a `deployment_status` event.
- Budget controls (`max-cases`, `timeout-minutes`) fail before spending model tokens when something is misconfigured.

## Requirements

1. YAML scripts in your repository — see the [Midscene YAML documentation](https://midscenejs.com/automate-with-scripts-in-yaml).
2. A model configured via environment variables (`MIDSCENE_MODEL_NAME`, `MIDSCENE_MODEL_BASE_URL`, `MIDSCENE_MODEL_API_KEY`, `MIDSCENE_MODEL_FAMILY`) or a `.env` file — see [model configuration](https://midscenejs.com/model-common-config).
3. A Node.js version supported by `@midscene/cli` (`^20.19.0`, `^22.12.0` or `>=24.0.0`) — set it up with `actions/setup-node` before this action.

## Usage

The complete starter workflows live in [`examples/`](./examples). Minimal example:

```yaml
name: Midscene
on:
  pull_request:
permissions:
  contents: read
  pull-requests: write
env:
  MIDSCENE_MODEL_API_KEY: ${{ secrets.MIDSCENE_MODEL_API_KEY }}
  MIDSCENE_MODEL_BASE_URL: ${{ vars.MIDSCENE_MODEL_BASE_URL }}
  MIDSCENE_MODEL_NAME: ${{ vars.MIDSCENE_MODEL_NAME }}
  MIDSCENE_MODEL_FAMILY: ${{ vars.MIDSCENE_MODEL_FAMILY }}
jobs:
  midscene:
    if: github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - name: Start preview server
        run: |
          npx --yes serve . -l 4173 &
          for i in $(seq 1 60); do curl -sf http://127.0.0.1:4173 && break; sleep 1; done
      - uses: web-infra-dev/midscene-action@v0
        with:
          yaml-files: midscene-scripts
          preview-url: http://127.0.0.1:4173
```

Reference the preview URL inside YAML with the built-in interpolation:

```yaml
web:
  url: ${MIDSCENE_PREVIEW_URL}
tasks:
  - name: home page
    flow:
      - aiAssert: the main heading is visible
```

## Inputs

| Name | Default | Description |
| --- | --- | --- |
| `yaml-files` | `midscene-scripts` | YAML file, directory or glob patterns. Mutually exclusive with `config`. |
| `config` | — | Path to a Midscene batch config YAML (`--config`). |
| `setup` | — | Setup script passed via `--setup`. |
| `working-directory` | `.` | Directory for `.env`, YAML patterns and `midscene_run/`. |
| `concurrent` | `1` | Concurrent scripts (`--concurrent`). |
| `retries` | `0` | Extra attempts for failed scripts (`--retry`); attempts are shown in the comment. |
| `continue-on-error` | `false` | Continue after a failure; the overall conclusion still fails. |
| `headed` | `false` | Headed browser; provide your own Xvfb on Linux. |
| `share-browser-context` | `false` | Pass `--share-browser-context`. |
| `summary-name` | `midscene-summary.json` | Summary JSON file name under `<run-dir>/output/`. |
| `run-dir` | `midscene_run` | Artifact root (exported as `MIDSCENE_RUN_DIR`). |
| `extra-args` | — | Raw extra CLI args. `--keep-window` and shell metacharacters are rejected. |
| `cli-version` | pinned by the action | Exact `@midscene/cli` version (recommended), `latest`, `beta` or a tarball URL. |
| `npm-registry` | — | npm registry for installing the CLI. |
| `cache` | `true` | Cache npm cache and the Puppeteer browser download. |
| `install-browser-deps` | `true` | Install missing Chrome system packages on Linux automatically. |
| `browser-executable` | — | Custom Chrome path (`PUPPETEER_EXECUTABLE_PATH`). |
| `upload-artifact` | `true` | Upload the report directory as a workflow artifact. |
| `artifact-name` | `midscene-report` | Artifact name; add a matrix suffix for matrix jobs. |
| `artifact-extra-paths` | — | Extra paths to upload, one per line. |
| `retention-days` | `7` | Artifact retention days. |
| `pr-comment` | `true` | Create or update the result comment; silently skips on fork PRs. |
| `comment-identifier` | `default` | Marker identifier, useful for separate comment threads per matrix job. |
| `preview-url` | — | Explicit preview URL; otherwise read from a successful `deployment_status` event. |
| `preview-env` | `MIDSCENE_PREVIEW_URL` | Env var name receiving the preview URL. |
| `max-cases` | — | Fail before any model call when the expanded YAML count exceeds this number. |
| `timeout-minutes` | — | Wall-clock timeout for the whole run; existing reports are still uploaded. |
| `fail-on-error` | `true` | Set to `false` for observational jobs that should not block merging. |
| `github-token` | `${{ github.token }}` | Token for PR comments. Never passed to the Midscene child process. |

## Outputs

`success`, `total`, `successful`, `failed`, `partial-failed`, `not-executed`,
`total-duration`, `summary-path`, `report-dir`, `run-url`, `preview-url`.

## Permissions

```yaml
permissions:
  contents: read
  pull-requests: write
```

## Reports

HTML reports are self-contained single files (screenshots embedded as data
URIs). The action uploads them as the `midscene-report` workflow artifact and
the PR comment links to the workflow run's Artifacts area — artifacts do not
have anonymous permanent URLs, so repository read access is required to
download them.

## Security model

- **Fork pull requests**: GitHub does not expose secrets to `pull_request`
  events from forks, so the action detects the missing model configuration up
  front and exits with an actionable message. The job-level `if` in the
  examples skips the run entirely. Do **not** work around this with
  `pull_request_target` plus an untrusted checkout — it executes unreviewed
  code with your secrets.
- **Prompt injection**: tested pages are untrusted input; page content is sent
  to the model. Prefer `aiAssert`-heavy cases, avoid side-effecting actions
  against shared environments, and use a CI-specific model key with spend
  limits.
- **Pinning**: use the rolling tag (`@v0` / `@v1` after GA) for convenience or
  pin a full commit SHA for strict supply-chain control. The bundled
  `@midscene/cli` version is pinned by default and updated via a version bump
  PR.

## Self-hosted, Windows and macOS runners

Chrome for Testing is installed by the CLI's Puppeteer dependency and cached
between runs. On bare Linux runners the action installs the required system
packages automatically (set `install-browser-deps: false` to manage them
yourself). Headed mode on Linux requires a virtual display such as Xvfb.

## Versioning

0.x releases track the exact tag `v0.x.y` and the moving `v0` tag; breaking
changes are possible before v1. After GA the moving tag becomes `v1`.

## License

MIT
