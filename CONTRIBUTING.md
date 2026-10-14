# Contributing

## Setup

Use Node 24 (`nvm use`), or Node >= 22.13:

```bash
pnpm install --frozen-lockfile
pnpm check
```

The project uses ECMAScript modules, Rslint for
JavaScript, and Prettier for formatting all supported files including YAML. Runtime code uses Node built-ins
only. `pnpm install --frozen-lockfile` enables the Husky pre-commit hook in a Git checkout; it checks lint
and formatting without modifying or staging files.

## Layout

```text
action.yml                     Composite Action entry point
src/                           Runtime report and history modules
examples/basic/                Complete Midscene Test browser project
.github/workflows/ci.yml        Quality checks, example E2E, and manual Pages publication
```

`pnpm lint` checks JavaScript and TypeScript with Rslint and formatting with Prettier.
`pnpm format` applies Rslint fixes, then formats the entire project with Prettier.
Use `pnpm check` before submitting changes; CI runs the same checks
on Node 22 and 24 and exercises the composite Action on a GitHub runner.

VS Code is configured to run Rslint fixes and Prettier on save. Install the
recommended Rstack and Prettier extensions; the editor uses the same project
configurations as the CLI.

`rslint.config.mjs` uses the built-in JavaScript and TypeScript recommended presets
and Node globals. Prettier handles formatting. YAML is checked by Prettier for syntax and formatting;
Rslint does not run custom YAML parser rules.

## Action changes

Keep `action.yml` inputs and outputs, README tables, and caller examples in sync.
Preserve failures after collecting reports. Run the example and verify its reports
when changing report handling. Runtime module paths are relative to
`GITHUB_ACTION_PATH`, so callers can use a different working directory.

The CI E2E job installs `examples/basic` and runs real AI cases through `uses: ./`.
The example must pass. CI downloads its report artifact and prepares a Pages site from the downloaded
files. Ordinary CI does not start a local HTTP server. There is no separate unit or shell test suite.
`pnpm check` runs lint and formatting; run `npm test` in `examples/basic` for local E2E.
Configure model credentials in the `Model` environment (see the example README).
Fork PRs run quality checks only because model secrets are unavailable.

Artifact upload and Pages deployment require a GitHub runner. Manually dispatch
`ci.yml` with `publish-pages` enabled to check the deployed report URLs with curl.
Publication requires GitHub Pages with the GitHub Actions source and the documented
job permissions.

Pages preparation reads the test project directly: pass its directory to
`src/prepare-pages-site.mjs --reports <project-directory>`. It reads
`.midscene/test-results/` and `midscene_run/report/` locally while retaining the
published `runs/<run-id>/midscene-results/` layout. Raw artifacts are uploaded for
download; only the previous Pages artifact is downloaded during publication.

## Release

This is a composite Action: there is no npm publication or bundle build. Consumers
load `action.yml` and `src/` directly from the chosen Git ref.

After merging a reviewed change with passing CI, a maintainer can publish a
version tag such as `v1.0.0` and update the corresponding major ref (`v1`) to that
release. Update examples for breaking changes. A release must contain all runtime
modules; it must not require consumers to install development dependencies.
