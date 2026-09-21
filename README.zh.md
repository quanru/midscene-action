# midscene-action

在**你自己的 GitHub Actions runner** 上运行 [Midscene](https://midscenejs.com) YAML 脚本——模型、浏览器和被测页面都留在你的基础设施内。Action 会安装 [`@midscene/cli`](https://www.npmjs.com/package/@midscene/cli)、执行 YAML 用例、把自包含 HTML 报告上传为 artifact，并在 pull request 上创建或更新一条结果评论。

> [!NOTE]
> 本 Action 运行的是 Midscene 本体，**不是**触发厂商云的薄封装：所有逻辑都在你的 runner 上、使用你自己的模型 API Key 执行。

## 它能做什么

- 仓库里的 YAML 脚本一步接入 PR 测试结果。
- 结论走标准的 GitHub job 状态，无需第三方服务即可作为合并门禁。
- 自包含 HTML 报告（截图内联）作为 workflow artifact 保存，不会发送到外部报告托管。
- 支持 preview 部署：可以显式传入 URL，也可以让 Action 从 `deployment_status` 事件的 `environment_url` 自动读取。
- 预算控制（`max-cases`、`timeout-minutes`）在配置错误时于消耗模型 token 之前直接失败。

## 前提条件

1. 仓库中已有 YAML 脚本——参见 [Midscene YAML 文档](https://midscenejs.com/zh/automate-with-scripts-in-yaml)。
2. 通过环境变量配置模型（`MIDSCENE_MODEL_NAME`、`MIDSCENE_MODEL_BASE_URL`、`MIDSCENE_MODEL_API_KEY`、`MIDSCENE_MODEL_FAMILY`）或提供 `.env` 文件——参见[模型配置](https://midscenejs.com/zh/model-common-config)。
3. Node.js 版本满足 `@midscene/cli` 要求（`^20.19.0`、`^22.12.0` 或 `>=24.0.0`），在本 Action 之前通过 `actions/setup-node` 设置。

## 使用方式

完整 starter workflow 见 [`examples/`](./examples)。最小示例：

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

在 YAML 中通过内置插值引用 preview URL：

```yaml
web:
  url: ${MIDSCENE_PREVIEW_URL}
tasks:
  - name: home page
    flow:
      - aiAssert: the main heading is visible
```

## 输入参数

| 名称 | 默认值 | 说明 |
| --- | --- | --- |
| `yaml-files` | `midscene-scripts` | YAML 文件、目录或 glob 模式，与 `config` 互斥。 |
| `config` | — | Midscene 批量配置 YAML 路径（`--config`）。 |
| `setup` | — | 通过 `--setup` 传入的前置脚本。 |
| `working-directory` | `.` | `.env`、YAML 模式与 `midscene_run/` 的基准目录。 |
| `concurrent` | `1` | 并发脚本数（`--concurrent`）。 |
| `retries` | `0` | 失败脚本的额外重试次数（`--retry`），重试次数会显示在评论中。 |
| `continue-on-error` | `false` | 失败后继续执行其余脚本；总体结论仍为失败。 |
| `headed` | `false` | 有头浏览器；Linux 上需自行提供 Xvfb。 |
| `share-browser-context` | `false` | 传入 `--share-browser-context`。 |
| `summary-name` | `midscene-summary.json` | `<run-dir>/output/` 下的汇总 JSON 文件名。 |
| `run-dir` | `midscene_run` | 产物根目录（导出为 `MIDSCENE_RUN_DIR`）。 |
| `extra-args` | — | 原样附加的 CLI 参数；禁止 `--keep-window` 与 shell 元字符。 |
| `cli-version` | Action 内置固定版本 | 精确的 `@midscene/cli` 版本（推荐）、`latest`、`beta` 或 tarball URL。 |
| `npm-registry` | — | 安装 CLI 时使用的 npm registry。 |
| `cache` | `true` | 缓存 npm cache 与 Puppeteer 浏览器下载。 |
| `install-browser-deps` | `true` | Linux 上自动补装缺失的 Chrome 系统依赖。 |
| `browser-executable` | — | 自定义 Chrome 路径（`PUPPETEER_EXECUTABLE_PATH`）。 |
| `upload-artifact` | `true` | 将报告目录上传为 workflow artifact。 |
| `artifact-name` | `midscene-report` | artifact 名称；matrix 作业请加矩阵后缀。 |
| `artifact-extra-paths` | — | 额外上传的路径，每行一个。 |
| `retention-days` | `7` | artifact 保留天数。 |
| `pr-comment` | `true` | 创建或更新结果评论；fork PR 上自动跳过。 |
| `comment-identifier` | `default` | 评论 marker 标识，matrix 作业可用来分隔评论线程。 |
| `preview-url` | — | 显式 preview URL；缺省时从成功的 `deployment_status` 事件读取。 |
| `preview-env` | `MIDSCENE_PREVIEW_URL` | 接收 preview URL 的环境变量名。 |
| `max-cases` | — | 展开后的 YAML 数量超过该值时，在任何模型调用之前直接失败。 |
| `timeout-minutes` | — | 整个执行的墙钟超时；超时前已产生的报告仍会上传。 |
| `fail-on-error` | `true` | 设为 `false` 时用于不阻塞合并的观测型作业。 |
| `github-token` | `${{ github.token }}` | 用于 PR 评论的 token，不会传入 Midscene 子进程。 |

## 输出参数

`success`、`total`、`successful`、`failed`、`partial-failed`、`not-executed`、
`total-duration`、`summary-path`、`report-dir`、`run-url`、`preview-url`。

## 权限

```yaml
permissions:
  contents: read
  pull-requests: write
```

## 报告

HTML 报告为自包含单文件（截图以 data URI 内联）。Action 将其上传为
`midscene-report` workflow artifact，PR 评论链接到 workflow run 的 Artifacts
区域——artifact 没有匿名永久链接，下载需要仓库读取权限。

## 安全模型

- **Fork pull request**：GitHub 不会向来自 fork 的 `pull_request` 事件提供
  secret，因此 Action 会在前置检查阶段发现模型配置缺失并给出可操作的报错；示例中的
  job 级 `if` 会直接跳过此类运行。**不要**用 `pull_request_target` 配合未受信的
  checkout 绕过这一限制——那会让未经审查的代码携带你的 secret 执行。
- **Prompt injection**：被测页面是不可信输入，页面内容会发送给模型。用例应以
  `aiAssert` 为主，避免对共享环境执行有副作用的操作；CI 建议使用带消费限额的专用模型
  Key。
- **版本固定**：方便起见可用滚动 tag（`@v0`，GA 后为 `@v1`），供应链管控严格的场景可固定到
  commit SHA。内置 `@midscene/cli` 默认固定版本，通过版本升级 PR 更新。

## 自托管、Windows 与 macOS runner

Chrome for Testing 由 CLI 的 Puppeteer 依赖安装并在多次运行之间缓存。裸 Linux runner
上 Action 会自动补装所需系统包（如需自行管理可设 `install-browser-deps: false`）。
Linux 上使用有头模式需要 Xvfb 等虚拟显示。

## 版本策略

0.x 阶段使用精确 tag `v0.x.y` 与滚动 tag `v0`，v1 之前可能存在破坏性变更。GA 后滚动
tag 切换为 `v1`。

## 许可证

MIT
