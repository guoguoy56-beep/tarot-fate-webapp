---
name: tarot-safe-refactoring
description: Use only when the user or approved project plan explicitly requests refactoring in this Tarot WebApp. Preserve behavior through small verified steps, especially around TarotExperience, API boundaries, and storage; do not use to start the frozen frontend rewrite or add speculative architecture.
---

# 塔罗 WebApp 安全重构

在行为保护和清晰边界下做小步重构，不把“代码更漂亮”当成独立目标。

## 前置检查

1. 确认重构已被用户或当前计划明确授权，并写出要解决的具体问题。
2. 阅读 `HANDOFF.md`、相关任务、调用方、类型、测试和已知回归。
3. 固定必须保持的可观察行为：主流程、API 契约、存储兼容、错误与重试、桌面/移动端关键路径。
4. 若保护测试不足，先补最小行为测试或记录可重复的人工验证步骤。

## 项目阶段约束

- `FE-GATE` 前不要大拆 `TarotExperience.tsx`、替换状态架构或重做视觉；只处理阻断性缺陷所需的最小结构调整。
- 新前端方案批准后，组件、状态、动画和样式边界以专项方案为准，不沿用原套件的 Vue/Pinia 假设。
- 不引入 Java 分层、数据库、通用仓储、事件总线或状态机库，除非单独决策已经批准。
- 不把 API-002～005、存储迁移或新前端任务夹带进当前重构。

## 执行循环

1. 建立基线并运行相关测试/检查。
2. 一次移动或改写一个边界，保持 diff 可审查。
3. 每一步运行最相关验证；出现行为变化立即定位，不继续叠加修改。
4. 删除只因本次重构产生的死代码；不清理无关历史代码。
5. 最后运行完整相关测试和 `npm run check`，检查 diff 与任务范围。

## 完成条件

- 原行为和错误路径有验证证据。
- 目标问题得到可说明的改善。
- 没有未经批准的新依赖、功能或架构层。
- 文档说明移动后的职责边界、验证结果和后续工作，但不把后续项标记为完成。
