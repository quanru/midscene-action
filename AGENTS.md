# Midscene Action

The root composite Action runs caller commands and optionally publishes reports.
Runtime modules live in `src/`.
Use Node built-ins at runtime and keep project-specific commands and environment
variables in the caller. Composite Actions do not need a bundled `dist/`.

Run `pnpm check` before handing off changes. It includes lint and formatting
checks. End-to-end tests run examples/basic through the Action in CI. Use `pnpm format` to apply fixes.
