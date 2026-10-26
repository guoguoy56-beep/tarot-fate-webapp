# 命运之牌 Tarot Fate WebApp

[![CI](https://github.com/guoguoy56-beep/tarot-fate-webapp/actions/workflows/ci.yml/badge.svg)](https://github.com/guoguoy56-beep/tarot-fate-webapp/actions/workflows/ci.yml)

一个基于React等技术栈开发的沉浸式 AI 塔罗牌占卜 Web 应用。

项目通过古典女巫木桌视觉、卡牌物理交互动效和大语言模型解读能力，为用户提供完整的占卜仪式体验。用户可以输入问题、扰动洗牌、抽取代表过去、现在与未来的三张牌，并获得对应的 AI 解读与命运总结。

## 主要功能

- 沉浸式旧女巫木桌视觉风格
- 基于鼠标移动轨迹的洗牌交互
- 78 张塔罗牌底部弧形牌带
- 过去、现在、未来三牌拖拽牌阵
- 逐张 3D 翻牌与打字机文本动画
- 完整 78 张 Rider-Waite-Smith 真实牌面
- 通过 DeepSeek API 生成个性化塔罗解读
- 使用 `localStorage` 保存本地占卜历史
- DeepSeek 异常时显示明确错误并支持手动重试

## 技术栈

- Next.js 16.4.2（App Router）
- React / React DOM 19.2.8
- TypeScript 5.9.3
- Tailwind CSS 3.4.19
- Framer Motion 12.43.0
- Vitest 5.0.5（领域单元、DeepSeek 适配器和 API 集成测试）
- Playwright Test 1.64.1（Chromium 桌面浏览器冒烟）
- DeepSeek API

## 本地运行

项目统一使用以下运行时版本：

- Node.js 24 LTS（`24.x`）
- npm `>=11.19.1 <12`

`.nvmrc`、`package.json#engines` 与 `package.json#packageManager` 是版本约束的权威来源；其中 `packageManager` 固定为 `npm@11.19.1`，用于保证锁文件生成与安装行为一致。首次运行前先确认版本：

```bash
node --version
npm --version
```

如果使用 nvm，可先执行 `nvm use`；未安装 Node 24 时执行 `nvm install 24` 后再切换。npm 版本低于要求时，先升级到 `11.19.1`。然后按锁文件进行标准可复现安装并启动开发服务：

```bash
npm ci
npm run dev
```

日常拉取代码、CI 和部署环境统一使用 `npm ci`；仅在明确变更依赖并需要同步更新 `package-lock.json` 时使用 `npm install`。

启动后访问 [http://localhost:3000](http://localhost:3000)。

## 持续集成

GitHub Actions 会在推送到 `main` 或向 `main` 发起 Pull Request 时执行质量门禁。`Dependency audit` 与 `Tests and browser smoke` 独立运行，各自固定 Node.js 24、npm `11.19.1` 并执行干净 `npm ci`；前者阻断 high/critical 全量依赖风险，后者执行 `npm test`、Lint、类型检查和 Chromium 浏览器冒烟。原名 `Quality gate` 的汇总检查要求两个作业全部成功。E2E 启动前自动构建生产应用；失败时上传 trace、截图和报告，保留 7 天。npm 缓存只加速下载，不替代锁文件安装。

`npm test` 使用 Vitest 在 Node 环境运行 10 个文件、135 项测试，包含 79 项领域单元测试、24 项 DeepSeek 适配器 Mock 测试和 32 项 API 集成测试。覆盖 78 张生产卡牌和真实 JPG、Fisher–Yates 与正逆位、请求/响应校验、localStorage 结构与 20 条上限，以及 DeepSeek 成功、格式错误、上游错误、超时和网络异常。API 集成测试直接调用真实 `POST(Request)`，验证 500 字符/4096 字节边界、可信牌义重建、HTTP 错误契约及响应/日志隐私。适配器测试使用受控 `fetch` Mock，API 测试替换 DeepSeek 模块边界，均使用假 Key，不访问真实付费服务；超时用例使用假时钟。

开发时可运行 `npm run test:watch`。可单独运行 `npm run audit:all` 检查全部依赖、`npm run audit:prod` 检查生产依赖；`npm run audit:signatures` 用于人工核验注册表签名和来源证明，不作为每次提交的硬门禁。项目通过 `.npmrc` 和 `package.json#allowScripts` 管理安装脚本审批。

浏览器冒烟首次运行需要安装匹配版本的 Chromium 无头组件：

```bash
npm exec -- playwright install --only-shell chromium
npm run test:e2e
```

`test:e2e` 固定使用 `127.0.0.1:3000`，启动前需要端口空闲。Playwright 自动构建、启动和关闭独立生产服务，服务禁用在线解读，浏览器拦截 `/api/reading` 返回标注为测试用途的本地 JSON。当前只有一条 1920×1080 Chromium 流程，覆盖提问、鼠标洗牌、三次拖牌、逐张阅读、手记、保存和刷新后历史读取。参考截图位于 `output/playwright/reference/`，失败产物和 HTML 报告也位于 Git 忽略的 `output/playwright/`。

## 环境变量

如需启用 DeepSeek 在线 AI 解读，请在项目根目录创建 `.env.local`：

```env
DEEPSEEK_API_KEY=your_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_READING_ENABLED=true
```

API Key 仅由 Next.js 服务端接口读取，不应提交到 Git 仓库或暴露在前端代码中。当前默认使用 `deepseek-v4-flash` 非思考模式，并要求返回包含 `past`、`present`、`future`、`summary` 的结构化 JSON。将 `DEEPSEEK_READING_ENABLED=false` 并重启本地服务可暂停新的在线解读请求；未配置时默认启用。服务端将每次合法 AI 请求的结果、耗时、错误分类和上游实际返回的 Token 用量写入带 `[tarot.reading]` 前缀的本地结构化日志，计数随进程重启归零，且不记录用户问题、卡牌、Prompt、API Key 或解读正文。未配置或调用失败时不会自动生成模拟解读，页面会保留当前抽牌状态并允许手动重试。

## 项目文档

详细的中文项目说明、视觉规范、DEMO 开发方案、动态效果设计和当前开发交接信息位于 [`ProjectDocument`](./ProjectDocument/) 目录。

## 当前状态

项目已完成第一版可运行 DEMO 的核心流程、DeepSeek API 接口加固、真实在线解读联调和完整 78 张 Rider-Waite-Smith 真实牌面接入。项目现处于重启建设阶段，按 `ProjectDocument/项目重启建设总计划-2026-09-09.md` 依优先级恢复工程、API、数据与测试基础。

截至 2026-10-26，阶段 3 正在推进，`TEST-001～TEST-004` 已完成，`TEST-005` 已通过本地浏览器验收，待远程 CI 确认。兼容安全更新后，生产依赖审计为 0，全量审计剩 3 项 moderate、0 high/critical，符合现有门禁；剩余项来自 Tailwind 3 的 PostCSS 开发依赖，继续记录在风险清单中。详见 `ProjectDocument/BASE-005-兼容安全更新记录-2026-10-26.md`。

当前确认 BASE-005 与 TEST-005 的远程 CI，随后推进 TEST-006 共享 Mock 规范。公网部署和匿名限流继续延期；旧前端仍处于维护冻结期，整体前端重做保留在 `FE-GATE` 决策门之后。
