# Midscene Action

[English](README.md) | 简体中文

在 GitHub Actions 中运行 Midscene 测试并保存报告，支持发布到 Cloudflare Workers。

这个 Action 可以：

- 运行 Midscene 测试。
- 在 Summary 中查看结果，下载测试报告。
- 将每次运行的报告发布到 Cloudflare Workers，获得独立链接。

在运行这个 Action 前，请在工作流中安装依赖和浏览器、启动应用并配置模型。Action 会执行你的测试命令，并收集 Midscene 项目生成的报告。

## 使用方法

所有可用参数见 [action.yml](action.yml)。

Action 会将测试生成的 HTML 报告和结果文件上传为 GitHub Actions 构建产物（artifact）。在工作流运行页面的 **Artifacts** 区域，可以下载包含这些文件的 ZIP 压缩包。

```yaml
- uses: web-infra-dev/midscene-action@v1
  with:
    # 必填：运行测试的 Bash 命令。请先安装依赖。
    command: npm test

    # 必填：你要运行的 Midscene 测试项目目录，没有默认值。
    # tests/midscene 仅为示例；项目位于仓库根目录时填 '.'。
    working-directory: tests/midscene

    # 上传报告的名称，显示在运行页面的 Artifacts 区域。
    # 同一次运行中，每次上传需使用不同名称。
    # 默认：midscene-results
    artifact-name: midscene-results

    # 上传的报告在 GitHub Actions 中保留的天数，到期后自动删除。
    # 默认：14
    retention-days: '14'

    # 发布到 Cloudflare Workers；仅接受 'true' 或 'false'。
    # 默认：false
    publish-pages: 'false'
```

`artifact-name` 可自定义，推荐使用字母、数字、连字符或下划线，例如 `midscene-results`、`midscene-chromium`。同一次工作流运行中，每次上传的名称必须不同；不同次运行可以沿用相同名称。

### 基础用法

下面假设测试项目位于 `tests/midscene`，使用 npm 和 Playwright Chromium。根据项目调整安装步骤和测试命令。

```yaml
name: Midscene tests

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

默认情况下，Action 会运行测试、上传报告，并在 Summary 中展示结果。如果使用 `command: pnpm test` 等其他测试命令，请先在前面的步骤中安装包管理器和依赖。

## 发布到 Cloudflare Workers

Workers Previews 目前处于 open beta。本集成固定使用 Wrangler 4.136.3，需要通过一次真实 CI 部署验证账号配置。

如需自动创建 Worker，Token 需要 Workers 产品级 **Admin** 权限。已有 Worker 时，按权限模型可以只授予该 Worker 的 **Editor**；Preview 存在尚未解决的[账号 Token 鉴权问题报告](https://github.com/cloudflare/workers-sdk/issues/15797)，需要实测验证。如果首次使用 Workers，请先在 Workers & Pages 中设置账号的 `workers.dev` 子域名。无需创建 Pages 项目，首次发布会创建 Worker。详见 [Workers Preview 官方文档](https://developers.cloudflare.com/workers/previews/get-started/)。

启用发布，传入 Account ID 和 Token：

```yaml
- name: Run tests and publish reports
  id: midscene
  uses: web-infra-dev/midscene-action@v1
  with:
    working-directory: tests/midscene
    command: npm test
    publish-pages: 'true'
    cloudflare-api-token: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    cloudflare-account-id: ${{ vars.CLOUDFLARE_ACCOUNT_ID }}
```

Worker 名称默认是 `midscene-reports`，可通过 `cloudflare-worker-name` 修改。

测试前只检查必填发布参数是否填写。凭据和权限由 Wrangler 在部署时验证；即使测试通过，部署失败也会使 Action 失败。

每次运行或重跑自动创建名为 `run-<run_id>-<run_attempt>` 的 Preview，Summary 提供本次报告的独立链接。多个工作流可以共用一个 Worker。免费方案每个 Worker 最多支持 100 个 Preview，超过后 Cloudflare 自动删除最久未部署的 Preview，其报告链接会失效。详见 [Preview 限制](https://developers.cloudflare.com/workers/previews/#limits)。

发布时请使用干净的测试输出目录：要求只有一个 `.midscene/test-results/*/summary.json`，且其中指向的 HTML 报告存在。静态资源访问免费；每次部署最多 20,000 个文件，单文件最多 25 MiB。详见 [Cloudflare 计费说明](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)和[限制](https://developers.cloudflare.com/workers/platform/limits/#static-assets)。

## 报告与结果

在工作流的 **Summary** 中查看测试结果，在 **Artifacts** 中下载报告。启用发布 并发布成功后，Summary 会提供在线报告链接。

测试失败后，Action 仍会收集报告；如果启用了发布，还会尝试发布。Action 最终仍会失败。

## 输出

通过 `${{ steps.midscene.outputs.<输出名称> }}` 读取：

| Output                 | 说明                       |
| ---------------------- | -------------------------- |
| `test-result`          | 测试命令状态。             |
| `report-artifact-name` | 包含报告的构建产物名称。   |
| `artifact-url`         | 构建产物下载页面链接。     |
| `page-url`             | 发布成功后的本次报告地址。 |
| `publication-result`   | 部署步骤状态。             |

## 贡献

开发、验证和发布说明见 [CONTRIBUTING.md](CONTRIBUTING.md)。
