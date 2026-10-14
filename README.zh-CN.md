# Midscene Action

[English](README.md) | 简体中文

在 GitHub Actions 中运行 Midscene 测试并保存报告，支持发布到 GitHub Pages。

这个 Action 可以：

- 运行 Midscene 测试。
- 在 Summary 中查看结果，下载测试报告。
- 将报告发布到 GitHub Pages，在线查看本次及历史报告。

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

    # 发布到 GitHub Pages；仅接受 'true' 或 'false'。
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

## 发布到 GitHub Pages

先在 Settings → Pages → Build and deployment 中，把 **Source** 设置为 **GitHub Actions**。设置步骤见 [GitHub Pages 文档](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。

在基础示例的任务（job）中添加发布权限和部署环境（environment），并启用 `publish-pages`。下面是需要添加或调整的配置；请保留基础示例中的 checkout、Node 设置和安装步骤：

```yaml
permissions:
  contents: read
  actions: read
  pages: write
  id-token: write

environment:
  name: CI
  url: ${{ steps.midscene.outputs.page-url }}

steps:
  # 此处保留 checkout、Node 设置和安装步骤。
  - name: Run tests and publish reports
    id: midscene
    uses: web-infra-dev/midscene-action@v1
    with:
      working-directory: tests/midscene
      command: npm test
      publish-pages: 'true'
```

将 `CI` 换成你的部署环境名称，并配置凭据和允许部署的分支。测试和发布使用同一个任务的环境和权限，部署要求见 [actions/deploy-pages](https://github.com/actions/deploy-pages#security-considerations)。

在工作流顶层添加 `concurrency`，让同一站点的发布按顺序执行：

```yaml
concurrency:
  group: midscene-pages
  cancel-in-progress: false
```

**Pages 配置会在测试前检查。** 如果检查失败，Action 会显示设置指引，跳过测试、报告上传和 Summary，然后失败。位于 Action 前面的安装步骤此时已经执行。

发布成功后，Summary 会提供本次运行的报告链接。站点首页会列出仍有报告可查看的历史运行记录。

## 报告与结果

在工作流的 **Summary** 中查看测试结果，在 **Artifacts** 中下载报告。启用 Pages 并发布成功后，Summary 会提供在线报告链接。

测试失败后，Action 仍会收集报告；如果启用了 Pages，还会尝试发布。Action 最终仍会失败。

## 输出

通过 `${{ steps.midscene.outputs.<输出名称> }}` 读取：

| Output                 | 说明                          |
| ---------------------- | ----------------------------- |
| `test-result`          | 测试命令状态。                |
| `report-artifact-name` | 包含报告的构建产物名称。      |
| `artifact-url`         | 构建产物下载页面链接。        |
| `page-url`             | 发布成功后的 Pages 站点地址。 |
| `publication-result`   | 部署步骤状态。                |

## 贡献

开发、验证和发布说明见 [CONTRIBUTING.md](CONTRIBUTING.md)。
