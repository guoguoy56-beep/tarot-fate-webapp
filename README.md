# 命运之牌 Tarot Fate WebApp

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

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Framer Motion
- DeepSeek API

## 本地运行

项目统一使用以下运行时主版本：

- Node.js 24 LTS（`24.x`）
- npm 11（`11.x`）

`.nvmrc` 与 `package.json#engines` 是版本约束的权威来源。首次运行前先确认版本：

```bash
node --version
npm --version
```

如果使用 nvm，可先执行 `nvm use`；未安装 Node 24 时执行 `nvm install 24` 后再切换。然后安装依赖并启动开发服务：

```bash
npm install
npm run dev
```

当前 `package-lock.json` 的可复现安装问题将在计划任务 `BASE-003` 中修复；完成前不要把 `npm install` 成功视为干净环境可复现的证明。

启动后访问 [http://localhost:3000](http://localhost:3000)。

## 环境变量

如需启用 DeepSeek 在线 AI 解读，请在项目根目录创建 `.env.local`：

```env
DEEPSEEK_API_KEY=your_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
```

API Key 仅由 Next.js 服务端接口读取，不应提交到 Git 仓库或暴露在前端代码中。当前默认使用 `deepseek-v4-flash` 非思考模式，并要求返回包含 `past`、`present`、`future`、`summary` 的结构化 JSON。未配置或调用失败时不会自动生成模拟解读，页面会保留当前抽牌状态并允许手动重试。

## 项目文档

详细的中文项目说明、视觉规范、DEMO 开发方案、动态效果设计和当前开发交接信息位于 [`ProjectDocument`](./ProjectDocument/) 目录。

## 当前状态

项目已完成第一版可运行 DEMO 的核心流程、DeepSeek API 接口加固、真实在线解读联调和完整 78 张 Rider-Waite-Smith 真实牌面接入。项目现处于重启建设阶段，旧前端已进入维护冻结，后续将整体重新设计和实现；当前按 `ProjectDocument/项目重启建设总计划-2026-09-09.md` 优先恢复工程、API、数据与测试基础。运行时主版本已固定为 Node.js 24 LTS / npm 11，下一项任务是 `BASE-002` 框架升级方案。
