# 测试数据与 Mock 规范

常规本地测试与 CI 均不使用真实 DeepSeek，也不需要真实 API Key。

| 层级 | 命令 / 文件 | 执行边界 |
| --- | --- | --- |
| 领域单元 | `npm test` / `tests/unit/` | 导入真实领域函数、牌组及资源，不访问服务 |
| DeepSeek 适配器 | `npm test -- tests/unit/deepseek.test.ts` | 运行真实适配器，显式 Mock `fetch`、假 Key、假时钟 |
| API 集成 | `npm test -- tests/integration/reading-route.test.ts` | 调用真实 `POST(Request)`，只 Mock DeepSeek 调用边界 |
| 浏览器闭环 | `npm run test:e2e` / `tests/e2e/` | 启动本地生产服务，拦截 `/api/reading` 返回 fixture，阻断浏览器外部来源请求 |
| 真实 DeepSeek | AI-001/AI-002 的人工或受控环境验证 | 与上述命令和 CI 分离，显式发起付费请求 |

`npm test` 收集单元与 API 测试，不收集浏览器测试。浏览器目前仅保留一条桌面核心流程；首次运行按根 README 安装匹配的 Chromium，运行前保持 `127.0.0.1:3000` 空闲。不要占用或关闭其他用途的服务来绕过端口检查。

## 共享数据

`tests/fixtures/reading.ts` 只导入生产类型，不导入测试运行器、生产校验器或网络客户端，可供 Vitest、Playwright 和后续新前端测试复用：

- `createReadingRequest(question?)`：每次新建请求、三牌数组和牌对象，固定为愚者正位 / 过去、魔术师逆位 / 现在、女祭司正位 / 未来。
- `createReadingResponse(overrides?)`：每次新建四字段解读，正文和总结明确标注模拟用途；可覆盖特定字段构造隐私或格式变体。
- `createReadingApiError(code, retryable?)`：每次新建公开 `{ error: { code, message, retryable } }`。错误码和重试标志由用例明确传入，不推导生产错误映射。

Fixture 中只保存合成问题和假标记，不保存真实用户问题、API Key、完整 Prompt 或敏感日志。不要修改共享可变单例；非法输入在用例中从工厂返回值构造。HTTP `Response` 必须每次创建，不能共享已消费的正文。

公开 API 错误、上游 provider 原始响应和内部 `DeepSeekReadingError` 属于不同契约，保持分开。适配器的正逆位专用关键词、API 的隐私标记、provider envelope、HTTP 错误矩阵和超时行为继续在对应测试内显式定义。预期值不能通过被测生产校验器生成。

AI-002 后成功 fixture 的三段长度为 149/149/153、总结 84 个 Unicode 码点，满足三段 120～180、总结 60～100 的公开契约。适配器成功 Mock 必须带 `finish_reason: "stop"`；异常内容用例也要给正常完成标志，避免提前被完成状态检查挡住而丢失内容校验覆盖。长度、额外字段和完成状态不合规时应拒绝，不生成替代正文。

浏览器仍断言实际随机抽出的三牌和保存记录，不把牌组直接替换为固定三牌，也不通过写 localStorage 绕过保存流程。

## Mock 安装与清理

Vitest 的 `tests/setup.ts` 在每个用例前屏蔽继承的真实 Key、关闭在线解读并安装拒绝所有 `fetch` 的默认替身；用例后检查其调用次数，即使业务代码捕获请求异常也会失败。这是当前 `fetch` 边界的防误调用保护，不是 Node 进程的网络沙箱。

适配器测试再显式安装受控 `fetch`，使用假 Key、假地址及模型；API 测试替换 DeepSeek 模块并保留自己的失败网络替身和零调用断言。新增涉及网络的测试也必须在调用边界设置 Mock，不能恢复真实 `fetch` 或使用真实凭据。不要因默认保护报错而关闭保护、跳过用例或降低断言。

`vitest.config.mts` 自动清除调用记录、恢复 spy、全局变量和环境变量；假时钟由适配器用例的 `afterEach` 恢复。默认保护放在 `beforeEach`，避免被 `unstubGlobals` 清理后失效。

Playwright 在导航前安装路由拦截，禁用 Service Worker；独立服务显式设定 `DEEPSEEK_READING_ENABLED=false` 和空 Key，不复用开发服务。CI 不注入 DeepSeek 凭据；不添加在线测试到 `test`、`test:e2e` 或现有工作流。

## 真实服务的手动验证

真实验证属于 AI-001 及 AI-002 的独立受控验收。本规范不增加在线脚本，不在常规测试或 CI 中执行付费请求。

1. 确认已进入真实服务验收任务，核对账户余额和预定请求次数；凭据由操作者在服务端本地私密环境配置，不写入 fixture、命令历史、报告或提交。
2. 使用独立的正常应用进程，并确认其服务端配置允许在线解读。不要使用 Playwright 的禁用服务或带 API 拦截的页面。检查服务地址、模型和开关后再启动，不在报告中打印 Key。
3. 在普通浏览器输入合成问题、抽取三张牌并手动提交一次，核对四字段响应、牌位、牌名及正逆位。AI-001 要求至少三组不同牌组成功；逐次明确发起，不自动循环或自动重试。
4. 记录计划/实际请求数、成功数、HTTP 状态、平均耗时、模型、实际 Token 用量和内容核对是否通过。只记录汇总指标，不保存完整问题、解读、Prompt 或凭据；缺少上游用量时记录未知，不估算成真实值。
5. 遇到账户、认证、限流、超时或格式失败时记录安全错误分类并停止自动推进，处理原因后再由操作者决定是否重试。结束后停止专用验证进程；常规测试继续使用原有 Mock 命令。

未经真实验证，不以 Mock 通过推断账户余额、模型可用性、真实成功率或在线输出质量。
