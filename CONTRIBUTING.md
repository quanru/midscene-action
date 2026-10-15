# Contributing to Midscene Action

Bug reports, documentation improvements, and pull requests are welcome.

## Development

Create a branch for your changes. Use Node.js 24 and pnpm:

```sh
pnpm install --frozen-lockfile
pnpm check
```

Use `pnpm format` to fix lint and formatting issues. Keep both READMEs and examples
in sync when changing usage.

For changes to test execution or reports, run the [basic](examples/basic/README.md)
and [TodoMVC](examples/todomvc/README.md) examples with model credentials.

## Pull requests

Open a pull request against `main`. Describe the change and how you tested it.

## Releases

Publish from the GitHub website:

1. Confirm that CI and both example workflows pass for the commit you want to release.
2. Open **Releases → Draft a new release** and create a `vX.Y.Z` tag, such as
   `v1.0.0`, for that commit.
3. Write or generate the release notes. Review them and explain any breaking changes.
4. Select **Publish this Action to the GitHub Marketplace** and publish the release.
5. Check that **Update major version tag** succeeds in the Actions tab. If it fails,
   rerun the workflow.

The [release workflow](.github/workflows/release.yml) updates `v1`, `v2`, etc.
automatically for stable releases. Prereleases are skipped. Keep specific version
tags such as `v1.0.0` unchanged.

GitHub Release Notes serve as the changelog.
