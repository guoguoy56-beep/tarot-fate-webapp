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

`npm test` 使用 Vitest 在 Node 环境运行 10 个文件、167 项测试，包含 102 项领域单元测试、33 项 DeepSeek 适配器 Mock 测试和 32 项 API 集成测试。覆盖 78 张生产卡牌和真实 JPG、Fisher–Yates 与正逆位、请求/响应校验、localStorage 结构与 20 条上限，以及 DeepSeek 成功、格式错误、上游错误、超时和网络异常。响应测试包含逐字段长度、额外字段、Unicode 边界和上游完成原因；API 集成测试直接调用真实 `POST(Request)`，验证 500 字符/4096 字节边界、可信牌义重建、HTTP 错误契约及响应/日志隐私。适配器测试使用受控 `fetch` Mock，API 测试替换 DeepSeek 模块边界，均使用假 Key，不访问真实付费服务；超时用例使用假时钟。

开发时可运行 `npm run test:watch`。可单独运行 `npm run audit:all` 检查全部依赖、`npm run audit:prod` 检查生产依赖；`npm run audit:signatures` 用于人工核验注册表签名和来源证明，不作为每次提交的硬门禁。项目通过 `.npmrc` 和 `package.json#allowScripts` 管理安装脚本审批。

三层测试共用 `tests/fixtures/reading.ts` 的合成请求、成功解读及公开错误结构。Vitest 每个用例默认屏蔽真实 Key、关闭在线解读并拒绝未显式 Mock 的 `fetch`；完整的数据、隔离和真实服务手动验证规范见 [tests/README.md](./tests/README.md)。

当前解读契约要求恰好四个字符串字段：三段各 120～180、总结 60～100 个 Unicode 字符，去除首尾空白后计数。缺失、额外、空白、过短、过长或上游未正常完成时，返回原有 `DEEPSEEK_INVALID_RESPONSE`，不截断、不补字、不自动重试。服务端与浏览器共用校验，现有历史记录继续使用独立存储规则。

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

2026-10-27 真实验收时，现有配置模型名被正常接受，三次响应的模型字段均为 `deepseek-flash`；官方仍支持该旧名的兼容路由，项目本轮保留配置。[官方说明](https://api-docs.deepseek.com/)

## 项目文档

详细的中文项目说明、视觉规范、DEMO 开发方案、动态效果设计和当前开发交接信息位于 [`ProjectDocument`](./ProjectDocument/) 目录。

## 当前状态

项目已完成第一版可运行 DEMO 的核心流程、DeepSeek API 接口加固、真实在线解读联调和完整 78 张 Rider-Waite-Smith 真实牌面接入。项目现处于重启建设阶段，按 `ProjectDocument/项目重启建设总计划-2026-09-09.md` 依优先级恢复工程、API、数据与测试基础。

截至 2026-10-27，`TEST-001～TEST-006` 及阶段 3 测试底座已完成。共享 fixture、默认隔离和运行规范通过本地及 [远程 CI #40467792481](https://github.com/guoguoy56-beep/tarot-fate-webapp/actions/runs/40467792481) 验收；135 项单元/API 测试、单条 Chromium 流程、完整检查和全部远程门禁均通过，未调用真实 DeepSeek。本日生产依赖审计为 0，全量为 1 moderate、0 high/critical；依赖和锁文件无变更。上一轮安全更新及历史审计快照保留在 `ProjectDocument/BASE-005-兼容安全更新记录-2026-10-26.md`。

AI-001 已完成：三组不同牌阵真实请求成功，牌名/方向/牌位匹配；服务端平均约 4.43 秒，实际合计 2941 Token。详见 [AI-001 验收记录](./ProjectDocument/AI-001-真实DeepSeek服务验收记录-2026-10-27.md)。

2026-10-30，AI-002 已完成：Prompt、固定字段、长度与上游完成状态校验通过验收；普通、医疗、法律、财务与即时人身安全五类共 6 次真实请求均满足结构/长度要求，内容核对见 [AI-002 验收记录](./ProjectDocument/AI-002-Prompt与输出结构验收记录-2026-10-30.md)。服务端平均 3.79 秒、实际 9672 Token；167 项离线测试、完整检查和单条 Chromium 流程通过，实现提交 `4d5ae3b` 已推送，[远程 CI #41019771543](https://github.com/guoguoy56-beep/tarot-fate-webapp/actions/runs/41019771543) 全部门禁成功。下一项为 STORE-001 存储版本化；运行时校验不等同于全面语义过滤。公网部署和匿名限流继续延期，旧前端维护冻结及 `FE-GATE` 约束不变。

同日按用户体感反馈调整文风：取消固定用途声明和句数模板，增强未来走向、转折条件与自然融入的建议，保留不保证结局及专业风险提醒。新一轮 167 项测试、完整检查和 1 次同题关系真实样本通过，历史六次矩阵不视为新版本已重复验收；详细边界见 AI-002 记录第 6 节。

随后按用户提供的参考截图，进一步改成面对面解牌：从牌面依据讲到具体情境、趋势和行动，减少泛化抒情，用独立问题展示推演方式。最终 167 项测试与完整检查通过；真实候选先被校验拒绝，强化篇幅后手动补测成功，详情见 AI-002 记录第 7 节。保留三牌结构，不把参考布局或精确时间推断作为已实现能力。
