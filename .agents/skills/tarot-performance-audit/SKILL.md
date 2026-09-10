---
name: tarot-performance-audit
description: Use when the user explicitly asks for performance diagnosis or when executing PERF-001 or PERF-002 for this Tarot WebApp. Measure asset loading, 78-card rendering, animation cost, bundle behavior, and API latency before optimizing; do not trigger broad performance rewrites during the frozen frontend stage.
---

# 塔罗 WebApp 性能诊断

只根据测量证据优化影响用户体验的瓶颈。

## 启动条件

- 当前任务是 `PERF-001`、`PERF-002`，或用户明确要求诊断性能。
- 若仍在 `FE-GATE` 前且没有实际性能回归，只记录风险，不重写旧前端。

## 基线

1. 阅读 `HANDOFF.md`、性能任务和当前前端专项方案（若已存在）。
2. 固定设备/浏览器、视口、开发或生产构建、网络条件和测试流程。
3. 记录基线后再修改；开发模式数据不能代替生产构建结论。

## 重点测量

- 首屏背景、卡背、字体、图标和牌面资源的体积、格式、加载时机与缓存。
- 是否在不需要时下载 78 张正面牌。
- 洗牌和抽牌时 DOM 节点数、长任务、掉帧、布局抖动、filter、阴影与混合模式成本。
- 390×844、768×1024、1280×720、1920×1080 视口下的关键流程。
- `prefers-reduced-motion` 路径是否真正减少 JavaScript 和 CSS 动画。
- `/api/reading` 的应用开销、上游等待和超时；明确区分本地代码与 DeepSeek 延迟。
- 构建产物和客户端边界是否因无关依赖或错误导入扩大。

## 优化规则

1. 优先处理最大、已复现且位于当前范围内的瓶颈。
2. 每次只改一个主要变量，保留前后可比数据。
3. 图片格式、懒加载、组件边界、动画属性和缓存策略按实际证据选择。
4. 不用删除核心交互、降低可访问性或隐藏加载错误换取分数。
5. 优化后运行功能回归和 `npm run check`，确认视觉与流程没有退化。

## 输出

报告环境、复现步骤、基线、瓶颈证据、改动、改后数据、权衡和剩余风险。无法稳定复现时明确说明，不给出虚假的提升百分比。
