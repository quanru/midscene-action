# Midscene Github Action

<p align="center">
  <a href="https://github.com/web-infra-dev/midscene-action/actions/workflows/ci.yml"><img src="https://github.com/web-infra-dev/midscene-action/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/web-infra-dev/midscene-action/tags"><img src="https://img.shields.io/github/v/tag/web-infra-dev/midscene-action?label=version&amp;sort=semver" alt="Latest version"></a>
  <a href="LICENSE.md"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
</p>

<p align="center">English | <a href="README.zh-CN.md">简体中文</a></p>

Midscene GitHub Action brings test execution and report management to GitHub Actions, making Midscene test results easy to view, download, and share.

- **View results**: see test results directly in the Summary.
- **Download reports**: complete reports are automatically saved as Artifacts for download.
- **View online**: optionally publish test reports to Cloudflare Workers, with a separate report URL for each run.

The Action runs the test command you configure. Prepare the dependencies, browsers, and model configuration your tests need beforehand.

## Usage

Specify your test command and project directory:

```yaml
- uses: web-infra-dev/midscene-action@v1
  with:
    working-directory: tests/midscene
    command: npm test
```

## Inputs

Set inputs under `with`. Their definitions are also available in [action.yml](action.yml).

| Input                    | Required                       | Default            | Description                                                                                                                                                                           |
| ------------------------ | ------------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `working-directory`      | Yes                            | None               | Midscene test project directory, relative to the workspace. Use `.` for the repository root.                                                                                          |
| `command`                | Yes                            | None               | Command to run your Midscene project tests, such as `npm test`.                                                                                                                       |
| `artifact-name`          | No                             | `midscene-results` | Name of the uploaded reports in Artifacts. Letters, numbers, hyphens, and underscores are recommended. Use different names when multiple test steps or parallel jobs use this Action. |
| `retention-days`         | No                             | `14`               | Days to keep report files in Artifacts before automatic deletion.                                                                                                                     |
| `publish-pages`          | No                             | `false`            | Whether to publish test reports to Cloudflare Workers. Accepts only `true` or `false`.                                                                                                |
| `cloudflare-api-token`   | When `publish-pages` is `true` | None               | Cloudflare API Token. Pass it from GitHub Secrets.                                                                                                                                    |
| `cloudflare-account-id`  | When `publish-pages` is `true` | None               | Cloudflare Account ID.                                                                                                                                                                |
| `cloudflare-worker-name` | No                             | `midscene-reports` | Name of the Worker hosting reports. The Action creates it on first publication if it does not exist.                                                                                  |

## Complete example

This example uses a test project in `tests/midscene`, with npm to install dependencies and Chromium to run tests. Adjust the directory, installation steps, and test command to suit your project.

```yaml
name: Midscene Visual Tests

on:
  push:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  test:
    runs-on: ubuntu-24.04
    timeout-minutes: 20
    env:
      MIDSCENE_MODEL_API_KEY: ${{ secrets.MIDSCENE_MODEL_API_KEY }}
      MIDSCENE_MODEL_NAME: ${{ vars.MIDSCENE_MODEL_NAME }}
      MIDSCENE_MODEL_FAMILY: ${{ vars.MIDSCENE_MODEL_FAMILY }}
      MIDSCENE_MODEL_BASE_URL: ${{ vars.MIDSCENE_MODEL_BASE_URL }}
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: '24'
      - name: Install dependencies and browser
        working-directory: tests/midscene
        run: |
          npm ci
          npx playwright install --with-deps chromium
      - name: Run Midscene tests
        id: midscene
        uses: web-infra-dev/midscene-action@v1
        with:
          working-directory: tests/midscene
          command: npm test
```

## Publish reports to Cloudflare Workers

Set `publish-pages` to `true` to publish test reports to Cloudflare Workers.

- **Free hosting**: no paid plan is required. Storage and requests for the report’s static files are free. [Billing details](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
- **Report retention**: on the free plan, each Worker keeps up to 100 Midscene test reports. When the limit is reached, the least recently updated report is automatically deleted and its link stops working. [Retention limits](https://developers.cloudflare.com/workers/previews/#limits)
- **File limits**: the free plan is generally sufficient for test reports, supporting up to 20,000 files per upload and 25 MiB per file. [Platform limits](https://developers.cloudflare.com/workers/platform/limits/#static-assets)

Complete the following setup before your first publication.

### Create an API Token

Choose the token permissions based on whether you create the Worker in advance:

| Publishing option                           | Preparation                                                                                                                                                                                                                                                                                                                   | Get a token                                                                                                                                                                                                                                           |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **⭐ Use an existing Worker (recommended)** | <ul><li>Create a Worker in <strong>Workers &amp; Pages</strong> and set <code>cloudflare-worker-name</code> to its name.</li><li>Enable <strong>Preview</strong> under <strong>Domains → Worker URL</strong>.</li></ul>[![Worker Preview toggle](assets/cloudflare-worker-preview.png)](assets/cloudflare-worker-preview.png) | Choose **Specified Workers**, select the target Worker, and enable **Individual Workers → Editor**.<br><br>[![Editor permissions for a specific Worker](assets/cloudflare-worker-editor.png)](assets/cloudflare-worker-editor.png)                    |
| Create a Worker automatically               | No Worker needs to be created in advance. The Action creates one using `cloudflare-worker-name`.                                                                                                                                                                                                                              | Choose **Entire Account** and enable **Workers → Admin**, which allows the token to manage all Workers in that account.<br><br>[![Workers product-level Admin permissions](assets/cloudflare-workers-admin.png)](assets/cloudflare-workers-admin.png) |

After creating the token, copy the API Token and Account ID from the confirmation dialog. The API Token is shown only once, so save it immediately.

### Enable publishing

Save the API Token as the repository secret `CLOUDFLARE_API_TOKEN` and the Account ID as the repository variable `CLOUDFLARE_ACCOUNT_ID`, then configure the Action as follows:

```yaml
- name: Run tests and publish reports
  id: midscene
  uses: web-infra-dev/midscene-action@v1
  with:
    working-directory: tests/midscene
    command: npm test
    publish-pages: true
    cloudflare-api-token: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    cloudflare-account-id: ${{ vars.CLOUDFLARE_ACCOUNT_ID }}
```

`cloudflare-worker-name` defaults to `midscene-reports`. To publish to an existing Worker, use its name in Cloudflare.

## Reports and results

After the tests finish, view results and open reports from the run’s Summary:

![Test results, report download, and online report links in the Summary](assets/test-summary.png)

## Outputs

Set `id: midscene` on the Action step, then read outputs with `${{ steps.midscene.outputs.<name> }}`:

| Output                 | Description                             |
| ---------------------- | --------------------------------------- |
| `test-result`          | Status of the test command.             |
| `report-artifact-name` | Name of the uploaded reports.           |
| `artifact-url`         | Link to the report download page.       |
| `page-url`             | This run’s report URL after publishing. |
| `publication-result`   | Status of the deployment step.          |

## Examples

- [Basic](.github/workflows/example-basic.yml): use AI to submit a local greeting form and verify the DOM result.
- [TodoMVC](.github/workflows/example-todomvc.yml): combine custom Todo Nodes, YAML lifecycle hooks, AI actions, and exact DOM assertions.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to develop, check, and release changes.

## License

[MIT](LICENSE.md).

Built with [Midscene](https://github.com/web-infra-dev/midscene) and [Cloudflare Workers](https://workers.cloudflare.com/).
