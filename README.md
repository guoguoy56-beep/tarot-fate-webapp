# 命运之牌 Tarot Fate WebApp

一个基于React等技术栈开发的沉浸式 AI 塔罗牌占卜 Web 应用。

项目通过古典女巫木桌视觉、卡牌物理交互动效和大语言模型解读能力，为用户提供完整的占卜仪式体验。用户可以输入问题、扰动洗牌、抽取代表过去、现在与未来的三张牌，并获得对应的 AI 解读与命运总结。

## 主要功能

- 沉浸式旧女巫木桌视觉风格
- 基于鼠标移动轨迹的洗牌交互
- 78 张塔罗牌底部弧形牌带
- 过去、现在、未来三牌拖拽牌阵
- 逐张 3D 翻牌与打字机文本动画
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

确保本机已安装 Node.js，然后执行：

```bash
npm install
npm run dev
```

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

项目已完成第一版可运行 DEMO 的核心流程、DeepSeek API 接口加固和真实在线解读联调。部署到新环境时仍需配置有效 API Key。目前继续完善首页环境光、统一牌堆组件、移动端布局、真实塔罗牌面资源和阅读阶段揭示特效。
