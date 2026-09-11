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

- Next.js 16.3.4（App Router）
- React / React DOM 19.2.8
- TypeScript 5.9.3
- Tailwind CSS 3.4.19
- Framer Motion 12.43.0
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

GitHub Actions 会在推送到 `main` 或向 `main` 发起 Pull Request 时执行质量门禁：固定 Node.js 24 与 npm `11.19.1`，运行干净的 `npm ci`，随后依次执行 high/critical 全量依赖审计、`npm run test:data`、`npm run lint`、`npm run typecheck` 和 `npm run build`。npm 缓存只用于加速下载，不替代锁文件安装。

`npm run test:data` 会直接检查 78 张生产卡牌的数据、分类、必要字段、真实 JPG 资源，以及 Fisher–Yates 牌组和正逆位规则。可单独运行 `npm run audit:all` 检查全部依赖、`npm run audit:prod` 检查生产依赖；`npm run audit:signatures` 用于人工核验注册表签名和来源证明，不作为每次提交的硬门禁。项目通过 `.npmrc` 拒绝未审批的依赖安装脚本，获准脚本必须在 `package.json#allowScripts` 中精确固定版本。更完整的领域、API、AI Mock 和浏览器测试仍将在后续 `TEST-001～006` 阶段补齐。

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

截至 2026-09-11，阶段 1 与当前本地范围内的阶段 2 已完成。`BASE-001～BASE-005`、`KIT-001`、`API-001～API-003`、`API-005`、`DATA-001～DATA-002` 已完成；`API-004` 的公网部署与匿名限流工作已移至未来发布阶段，只有用户明确决定公开部署后才重新评估。当前下一项是 `TEST-001` 测试工具选择。旧前端仍处于维护冻结期，整体前端重做保留在 `FE-GATE` 决策门之后。
