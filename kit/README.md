# 项目工程套件索引

本目录保存用户提供的原始“全栈开发专家”套件。评估结论与项目适配结果见：

- `ProjectDocument/KIT-001-全栈开发专家套件评估与适配记录-2026-09-10.md`

## 目录状态

| 路径 | 状态 | 用途 |
| --- | --- | --- |
| `kit/AI用全栈开发套件包/` | 原始参考，保持不动 | Qoder 格式的 Java Spring Boot + Vue 3 套件，不作为本项目默认指令 |
| `.agents/skills/tarot-api-engineering/` | 已启用 | API-001～API-005 的项目专属工作流 |
| `.agents/skills/tarot-code-review/` | 已启用 | 基于当前 Next.js/React 代码和阶段计划的审查流程 |
| `.agents/skills/tarot-testing-strategy/` | 已启用，按任务触发 | TEST-001～TEST-006 的测试选型与实施约束 |
| `.agents/skills/tarot-performance-audit/` | 已启用，延后使用 | PERF-001～PERF-002 或明确性能诊断任务 |
| `.agents/skills/tarot-safe-refactoring/` | 已启用，仅显式触发 | 经计划批准的行为保持型重构 |

Codex 会扫描仓库根目录的 `.agents/skills`。若新增或修改的技能没有立即出现在技能选择器中，重启 Codex 后再检查。

## 当前不启用的原始能力

- `Vue组件开发`：项目使用 React 19，且新前端方案要到 `FE-GATE` 才确定。
- `Java业务开发`：项目服务端是 Next.js Route Handler，不存在 Spring Boot 后端。
- `数据库设计`：当前明确不引入账号和服务端数据库，历史继续使用 localStorage。

原始文件没有删除、移动或覆盖，便于未来其他 Java/Vue 项目复用。
