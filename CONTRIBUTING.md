# Contributing to midscene-action

Thanks for contributing!

## Development

The action requires Node 20 (see `.nvmrc`).

```bash
npm install
npm test        # rstest unit tests (no network, no model calls)
npm run typecheck
npm run lint
npm run build   # bundle src/ into dist/ with @vercel/ncc
```

Notes:

- `dist/` is generated but **must be committed** — GitHub Actions runs the
  bundled file directly. CI fails when the committed `dist/` differs from a
  fresh build, so always run `npm run build` before submitting.
- The tests use [`rstest`](https://rstest.dev/). Do not introduce other test
  runners.

## End-to-end tests

`.github/workflows/e2e.yml` runs the action against itself (`uses: ./`) with a
tiny static site in `tests/fixtures/site` and real model credentials stored as
repository secrets/variables. It runs on pushes to `main`, pull requests from
the same repository, the weekly schedule and manual dispatch. Pull requests
from forks run unit tests only (secrets are intentionally unavailable).

## Releases

Releases are cut via the `release` workflow (workflow dispatch) and
`scripts/release.mjs`: an exact tag `vX.Y.Z` plus a moving major tag (`v0` for
0.x, `v1` after GA). Never force-push tags outside the release script.
