# Contributing to Midscene Action

Thanks for your interest in contributing! Bug reports, documentation improvements,
and pull requests are welcome.

## Setup

Fork and clone the repository. Use Node.js 24 and pnpm, then install dependencies:

```sh
pnpm install --frozen-lockfile
```

## Making changes

Create a branch for your changes. No build step is needed.

```text
.
├── action.yml                  # Composite Action entry point
└── src/
    └── cloudflare-report.mjs   # Report preparation and Wrangler configuration
```

Keep the English and Chinese READMEs and examples in sync when changing inputs,
outputs, or usage.

## Checks

Run lint and formatting checks before opening a pull request:

```sh
pnpm check
```

To apply fixes:

```sh
pnpm format
```

For changes to test execution or reports, follow the
[basic example](examples/basic/README.md) to run the end-to-end tests. These tests
require model credentials. CI also runs the example through the Action; fork pull
requests run quality checks only.

## Pull requests

Open a pull request against `main`. Describe what changed, why, and how you
verified it. Link any related issues.
