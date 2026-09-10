---
name: tarot-code-review
description: Use when the user asks to review this Tarot WebApp's code, diff, commit, API, storage, or implementation quality. Produce evidence-backed findings for the current Next.js and React codebase; do not use for automatic implementation or broad redesign proposals.
---

# 塔罗 WebApp 代码审查

以发现真实缺陷和回归风险为主，不把审查写成风格偏好清单。

## 审查准备

1. 阅读 `ProjectDocument/HANDOFF.md`、当前任务文档和 `ProjectDocument/Agents.md`。
2. 确认审查范围：工作区 diff、指定提交、指定文件或完整链路。
3. 阅读变更上下游和相关测试；不要只看孤立代码片段。
4. 区分本次引入的问题、既有已知问题和计划中明确延后的工作。

## 优先检查

按以下顺序寻找可复现、可定位的问题：

1. 正确性：状态转换、三牌唯一性与完整性、正逆位、历史记录结构、错误映射。
2. 安全与隐私：客户端伪造牌义、密钥泄露、未限制输入、敏感问题进入日志、限流失效。
3. 稳定性：超时清理、重复提交、竞态、异常 JSON、上游 4xx/5xx、浏览器存储损坏。
4. 回归：旧前端核心流程、API 契约、构建、移动端或键盘路径是否被当前改动破坏。
5. 可维护性：重复领域规则、客户端/服务端类型漂移、无必要抽象和超出当前任务的耦合。

## 项目约束

- `FE-GATE` 前，旧前端处于维护冻结；不要把计划中已知的视觉重做项当成本次代码缺陷，除非当前变更使其恶化。
- 不因个人偏好要求 Java 分层、Vue/Pinia、数据库、统一 `Result` 包装或 `/api/v1` CRUD。
- 严重度由实际影响决定：阻断、安全或数据损坏为高；明确行为错误为中；局部可维护性风险为低。
- 没有证据时写成待验证风险，不写成确定缺陷。
- 审查默认只报告，不修改代码；只有用户同时要求修复时才实施。

## 输出格式

先列 findings，按严重度排序。每条包含：

- 简短标题和严重度；
- 精确文件与行号；
- 触发条件；
- 实际影响；
- 最小修复方向。

随后列验证缺口和假设。若没有发现，明确写“未发现可操作缺陷”，并说明仍未覆盖的测试范围。
