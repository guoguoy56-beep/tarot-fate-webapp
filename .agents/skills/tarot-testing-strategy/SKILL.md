---
name: tarot-testing-strategy
description: Use for TEST-001 through TEST-006 or when adding and validating automated tests for this Tarot WebApp. Select the smallest compatible TypeScript, Next.js API, and browser test stack; never call the paid DeepSeek service from CI and do not add broad legacy-UI snapshot coverage.
---

# 塔罗 WebApp 测试策略

为新前端前的领域、API、AI 适配和存储边界建立可重复的测试保护。

## 决策顺序

1. 阅读总计划的 `TEST-001～006`、当前技术栈、CI 和现有脚本。
2. 盘点待测行为、可直接导入的纯函数、Route Handler 边界和浏览器流程。
3. 在 `TEST-001` 比较候选工具后再选型；不要预先锁定 Vitest、Jest 或 Playwright 组合。
4. 优先复用一个测试运行器覆盖 TypeScript 单元和 API 集成；E2E 只引入一个浏览器工具。
5. 新增依赖前检查 Node.js 24、Next.js 16、React 19、npm 11 和现有 ESLint 的兼容性。

## 分层范围

- 领域单元：78 张牌完整性、ID 唯一、洗牌不丢不重、正逆位、请求/响应校验和错误码。
- DeepSeek 适配器：成功 JSON、非 JSON、缺字段、401、402、429、5xx、超时和网络异常，全部使用受控 mock。
- API 集成：合法三牌、空/超长问题、重复牌位、重复卡牌、未知 `cardId`、上游错误映射和敏感信息不泄露。
- 存储：空值、损坏 JSON、错误对象、部分坏记录、版本迁移、删除与清空。
- 浏览器 E2E：旧前端只保留一条核心闭环冒烟和少量参考截图；新前端覆盖在 `FE-GATE` 后重新设计。

## 强制边界

- CI 不读取真实 `DEEPSEEK_API_KEY`，不访问真实付费 AI。
- 不以跳过、降低断言或只检查“函数被调用”来制造通过。
- 不建立大规模旧前端视觉快照；旧 UI 即将替换。
- 覆盖率是发现缺口的信号，不把统一百分比当成脱离风险的完成标准。
- 测试应验证公开行为；只有无法通过公开边界观察时才断言内部细节。

## 实施与验收

1. 先写能证明目标行为或缺陷的最小测试。
2. 让 fixture 和 mock 具名、确定且不含秘密；成功和错误响应保持共享规范。
3. 先运行相关测试，再运行完整测试和 `npm run check`。
4. 把稳定测试命令接入现有 CI，不使用永远成功的占位命令。
5. 记录实际执行的命令、通过数量、未覆盖边界和是否使用真实外部服务。
