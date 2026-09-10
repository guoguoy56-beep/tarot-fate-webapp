---
name: tarot-api-engineering
description: Use for implementing or reviewing this Tarot WebApp's API-001 through API-005 work, especially /api/reading validation, trusted card normalization, request limits, deployment-aware rate limiting, and DeepSeek cost or failure protection. Do not use for frontend design, database work, or generic CRUD API conventions.
---

# 塔罗 WebApp API 工程

按项目总计划逐项加固 `POST /api/reading`，保持现有 Next.js App Router 架构和已确认的产品范围。

## 开始前

1. 阅读 `ProjectDocument/HANDOFF.md` 和总计划中当前 API 任务的范围、验收与“不做”项。
2. 阅读 `src/app/api/reading/route.ts`、`src/types/reading.ts`、`src/types/tarot.ts`、`src/data/tarotCards.ts` 和 `src/lib/deepseek.ts`。
3. 确认当前唯一任务编号；不要顺手实现后续 API 任务。
4. 先记录当前请求、成功响应和错误响应行为，再确定最小修改面。

## 项目固定边界

- 保留 `POST /api/reading`；除非项目计划明确变更，不强制改成 `/api/v1` 或资源 CRUD 路由。
- 保留现有错误外形 `{ error: { code, message, retryable } }`；新增错误码必须稳定、可测试且不泄露内部异常。
- 客户端最终只能提交问题和抽牌事实：`cardId`、`position`、`orientation`。牌名、关键词和含义由服务端可信数据生成。
- API Key 只在服务端读取；日志、响应、测试 fixture 和文档不得包含密钥。
- 上游失败不生成假解读，不自动无限重试，并保留客户端牌局供人工重试。
- 当前范围不含账号、数据库、支付、后台、多牌阵和跨设备同步。

## 分阶段边界

- `API-001`：只建立共享运行时校验和稳定的 400 错误码；覆盖缺字段、错误类型、重复牌位、重复卡牌和未知 `cardId`。
- `API-002`：才把请求收敛为抽牌事实，并由服务端查询 `tarotCardMap`、选择正逆位牌义。
- `API-003`：才处理问题字符数、空白、换行和请求体规模限制。
- `API-004`：先确认部署形态，再实现匿名限流、并发约束和 429；不要用只对单进程有效的方案冒充生产限流。
- `API-005`：实现预算、熔断、指标和上游错误保护，不提前扩展管理后台。

## 实施流程

1. 从当前任务验收条件反推输入、输出和错误码。
2. 比较手写校验与 Schema 依赖；单一路由能清晰解决时优先不新增依赖。
3. 把可复用的领域规则放到服务端和测试都能导入的模块，避免只写在路由内部。
4. 让路由只负责解析请求、调用领域校验/服务和映射 HTTP 响应。
5. 对边界值、重复值、未知 ID、恶意字段和上游错误做失败路径验证。
6. 运行最相关验证，再运行 `npm run check`；依赖变化时额外执行项目规定的安装脚本与审计检查。
7. 检查 diff，更新任务记录、总计划状态和 `HANDOFF.md`，再按项目 Git 规则提交。

## 输出要求

完成时说明：本次任务编号、契约变化、错误码变化、验证证据、未覆盖风险和唯一下一任务。不要把尚未实施的后续阶段描述成已完成。
