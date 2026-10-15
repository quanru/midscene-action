# Midscene Github Action

<p align="center">
  <a href="https://github.com/web-infra-dev/midscene-action/actions/workflows/ci.yml"><img src="https://github.com/web-infra-dev/midscene-action/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/web-infra-dev/midscene-action/tags"><img src="https://img.shields.io/github/v/tag/web-infra-dev/midscene-action?label=version&amp;sort=semver" alt="Latest version"></a>
  <a href="LICENSE.md"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
</p>

<p align="center"><a href="README.md">English</a> | 简体中文</p>

Midscene Github Action 将测试执行与报告管理整合到 GitHub Actions 中，让每次 Midscene 测试的结果都方便查看、下载和分享。

- **查看结果**：在 Summary（运行摘要）中直接查看测试结果。
- **下载报告**：完整报告自动归档到 Artifacts，随时下载。
- **在线预览**：按需发布测试报告到 Cloudflare Workers，每次运行都有独立的报告链接。

Action 会直接运行你配置的测试命令，请提前准备好测试所需的依赖、浏览器和模型配置。

## 使用方法

指定测试命令和项目目录：

```yaml
- uses: web-infra-dev/midscene-action@v1
  with:
    working-directory: tests/midscene
    command: npm test
```

## 输入参数

在 `with` 中设置参数，定义见 [action.yml](action.yml)。

| 参数                     | 是否必填                         | 默认值             | 说明                                                                                                                              |
| ------------------------ | -------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `working-directory`      | 是                               | 无                 | Midscene 测试项目目录，相对于工作区。项目位于仓库根目录时填 `.`。                                                                 |
| `command`                | 是                               | 无                 | 指定运行 Midscene 项目测试的命令，例如 `npm test`。                                                                               |
| `artifact-name`          | 否                               | `midscene-results` | 上传的报告名称，显示在 Artifacts 中。推荐使用字母、数字、连字符和下划线；多个测试步骤或并行任务使用此 Action 时，请设置不同名称。 |
| `retention-days`         | 否                               | `14`               | Artifacts 中报告文件的保留天数，到期后自动删除。                                                                                  |
| `publish-pages`          | 否                               | `false`            | 是否将测试报告发布到 Cloudflare Workers。仅接受 `true` 或 `false`。                                                               |
| `cloudflare-api-token`   | `publish-pages` 为 `true` 时必填 | 无                 | Cloudflare API Token，请通过 GitHub Secrets 传入。                                                                                |
| `cloudflare-account-id`  | `publish-pages` 为 `true` 时必填 | 无                 | Cloudflare 账号 ID。                                                                                                              |
| `cloudflare-worker-name` | 否                               | `midscene-reports` | 托管报告的 Worker 名称。首次发布时，如 Worker 尚不存在，Action 会自动创建。                                                       |

## 完整示例

下面以位于 `tests/midscene` 的测试项目为例，使用 npm 安装依赖、Chromium 运行测试。你可以根据项目实际情况调整目录、安装步骤和测试命令。

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

## 发布报告到 Cloudflare Workers

将 `publish-pages` 设置为 `true`，即可将测试报告发布到 Cloudflare Workers。

- **免费托管**：无需升级付费方案，报告静态文件的存储和访问免费。[计费说明](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
- **保留上限**：免费方案最多保留最近 100 份 Midscene 测试报告，超出后自动删除最久未更新的报告，旧链接随之失效。[限制说明](https://developers.cloudflare.com/workers/previews/#limits)
- **文件限制**：免费方案通常足以托管测试报告，支持每次上传最多 20,000 个文件，单个文件最大 25 MiB。[官方限制](https://developers.cloudflare.com/workers/platform/limits/#static-assets)

首次使用时，请完成以下配置。

### 创建 API Token

根据是否提前创建 Worker，选择对应的 Token 权限：

| 发布方式                       | 准备工作                                                                                                                                                                                                                                                                                                                     | 获取 Token                                                                                                                                                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **⭐ 使用已有 Worker（推荐）** | <ul><li>在 <strong>Workers &amp; Pages</strong> 中创建 Worker，将 <code>cloudflare-worker-name</code> 设置为其名称。</li><li>在 <strong>Domains → Worker URL</strong> 中开启 <strong>Preview</strong>。</li></ul>[![Worker 的 Preview 开关位置](assets/cloudflare-worker-preview.png)](assets/cloudflare-worker-preview.png) | 选择 **Specified Workers**，选中目标 Worker，勾选 **Individual Workers → Editor**。<br><br>[![指定 Worker 的 Editor 权限配置](assets/cloudflare-worker-editor.png)](assets/cloudflare-worker-editor.png) |
| 自动创建 Worker                | 无需提前创建，Action 会按 `cloudflare-worker-name` 创建 Worker。                                                                                                                                                                                                                                                             | 选择 **Entire Account**，勾选 **Workers → Admin**，可管理该账号下的所有 Worker。<br><br>[![Workers 产品级 Admin 权限配置](assets/cloudflare-workers-admin.png)](assets/cloudflare-workers-admin.png)     |

创建成功后，在弹出的提示框中复制 API Token 和 Account ID。API Token 仅显示一次，请及时保存。

### 启用发布

将 API Token 保存为仓库 Secret `CLOUDFLARE_API_TOKEN`，Account ID 保存为仓库 Variable `CLOUDFLARE_ACCOUNT_ID`，然后按以下示例配置：

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

cloudflare-worker-name 默认为 midscene-reports。如需发布到已有 Worker，请填写其在 Cloudflare 中的名称。

## 报告与结果

测试完成后，可在执行 Summary 中查看结果、预览报告：

![Summary 中的测试结果、报告下载和在线报告入口](assets/test-summary.png)

## 输出

给 Action 步骤设置 `id: midscene`，即可通过 `${{ steps.midscene.outputs.<name> }}` 读取输出。

| 输出                   | 说明                       |
| ---------------------- | -------------------------- |
| `test-result`          | 测试命令状态。             |
| `report-artifact-name` | 已上传的报告名称。         |
| `artifact-url`         | 报告下载页面链接。         |
| `page-url`             | 发布成功后的本次报告地址。 |
| `publication-result`   | 部署步骤状态。             |

## 示例

- [Basic](.github/workflows/example-basic.yml)：使用 AI 操作本地问候表单，并验证 DOM 结果。
- [TodoMVC](.github/workflows/example-todomvc.yml)：结合自定义 Todo Node、YAML 生命周期钩子、AI 操作和精确的 DOM 断言。

## 参与贡献

开发、验证和发布说明见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

[MIT](LICENSE.md)。
