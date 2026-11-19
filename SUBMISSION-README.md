# 命运回廊 Tarot Fate WebApp —— 毕业设计源码交付说明

本包为毕业设计《命运回廊 Tarot Fate WebApp》的**完整可运行源代码**，不含依赖目录、构建产物、运行时数据库与本机凭据。

| 项目 | 内容 |
| --- | --- |
| 项目名称 | 命运回廊 Tarot Fate WebApp |
| 技术栈 | Next.js 16.4.6（App Router）· React 19.2.8 · TypeScript 5.9.3 · Three.js 0.187 · Tailwind CSS 3.4.19 · Better Auth 1.7.25 · Node 内建 SQLite |
| 源码规模 | 业务源码 56 个文件 / 8,188 行；测试代码 5,089 行；合计约 1.33 万行 |
| 压缩包体积 | 约 30 MB（上限 500 MB） |
| 运行时要求 | Node.js 24.x，npm 11.19.1 |

---

## 1. 交付内容

```
tarot-fate-webapp-src/
├── src/                      # 业务源码（页面、组件、领域逻辑、API 路由）
├── tests/                    # 单元测试、集成测试、端到端测试与共享夹具
├── public/                   # 运行必需静态资源：78 张牌面、字体、3D 贴图
├── scripts/demo.mjs          # 演示启动器（自动建库、建演示账号、构建并启动）
├── ProjectDocument/          # 开发过程文档（需求、决策记录、验收记录）
├── package.json              # 依赖与脚本定义
├── package-lock.json         # 锁定依赖版本，保证可复现安装
├── next.config.js            # Next.js 配置
├── tsconfig.json             # TypeScript 配置（含 @/* 路径别名）
├── tailwind.config.ts        # 样式框架配置
├── postcss.config.js         # 样式构建配置
├── eslint.config.mjs         # 代码规范配置
├── vitest.config.mts         # 单元/集成测试配置
├── playwright.config.ts      # 端到端测试配置
├── playwright.auth.config.ts # 认证流程端到端测试配置
├── next-env.d.ts             # Next.js 类型声明
├── .nvmrc / .npmrc           # Node 版本与安装脚本策略
├── .env.example              # 环境变量模板（不含任何真实密钥）
├── .gitignore                # 版本忽略规则
├── README.md                 # 项目主说明文档
├── SUBMISSION-README.md      # 本文件
└── DELIVERY-MANIFEST.txt     # 逐文件清单（路径、字节数、SHA-256）
```

---

## 2. 快速运行

```bash
# 1. 确认运行时（Node 24.x / npm 11.19.1）
node --version
npm --version

# 2. 按锁文件安装依赖（约 600 MB，仅安装过程产生，不属于源码）
npm ci

# 3. 启动演示模式（自动建库、创建演示账号、构建并启动）
npm run demo
```

浏览器访问 `http://127.0.0.1:3000`。

`npm run demo` 的行为：首次运行生成 `data/demo/.auth-secret` 与 `data/demo/accounts.json`（随机长密码，仅存本机），初始化 `auth.sqlite` 与 `journals.sqlite`，随后执行生产构建并监听回环地址 3000 端口。**本包不附带任何数据库或账号文件，首次运行会自动重建**，因此不存在数据泄露或环境不一致问题。

其他命令：

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 开发模式（热更新） |
| `npm run demo:setup` | 仅初始化演示账号，不启动服务 |
| `npm test` | 运行单元与集成测试（离线，不调用真实 AI） |
| `npm run test:e2e` | 运行 Chromium 端到端冒烟测试 |
| `npm run check` | 代码规范 + 类型检查 + 生产构建 |

如需启用真实 DeepSeek 在线解读，复制 `.env.example` 为 `.env.local` 并填入自己的 API Key；不配置时页面保留抽牌状态并提示重试，不会伪造解读结果。

---

## 3. 源码结构

```
src/
├── app/                        # Next.js App Router
│   ├── page.tsx                # 首页入口
│   ├── layout.tsx              # 全局布局与字体
│   ├── globals.css             # 全局样式
│   └── api/
│       ├── reading/route.ts    # POST /api/reading  AI 解读接口
│       ├── journals/route.ts   # 个人手记增删查接口
│       └── auth/[...all]/      # Better Auth 认证路由
├── components/                 # 客户端交互层
│   ├── CosmicExperience.tsx    # 主状态机：开场→提问→牌圈→逐牌→总结→手记
│   ├── CosmicOpening.tsx       # 星空开场
│   ├── CosmicQuestion.tsx      # 提问与牌阵选择
│   ├── CosmicHistory.tsx       # 历史手记列表与详情
│   ├── CosmicLogin.tsx         # 登录/退出
│   ├── AmbientLightEffects.tsx # 环境光效
│   └── *.css                   # 组件级样式与字体声明
├── lib/                        # 领域逻辑（与 UI 解耦，可独立测试）
│   ├── tarot.ts                # 牌组抽取
│   ├── tarot-random.ts         # Fisher–Yates 洗牌与正逆位
│   ├── cosmic-*.ts             # 3D 空间、牌圈几何、相机运镜、星野与星云
│   ├── reading-*.ts            # 请求读取、领域校验、响应契约、脱敏观测
│   ├── deepseek.ts             # 上游 AI 适配器
│   ├── journal-*.ts            # 手记记录模型、SQLite 持久化、前端存储
│   └── auth*.ts                # 认证配置与运行时
├── data/tarotCards.ts          # 78 张 Rider-Waite-Smith 牌义数据
└── types/                      # 领域类型定义
```

分层原则：`types` → `data` → `lib`（纯函数与领域规则）→ `app/api`（HTTP 边界）→ `components`（表现与交互）。领域层不依赖 React 与浏览器 API，因此可在 Node 环境直接单元测试。

---

## 4. 核心实现导读

按论文技术点对应到具体文件，便于评审查阅。

| 技术点 | 关键文件 | 实现说明 |
| --- | --- | --- |
| 连续 3D 空间与星野渲染 | `lib/cosmic-three-backdrop.ts`、`cosmic-starfield.ts`、`cosmic-nebula.ts`、`cosmic-galactic-band.ts`、`cosmic-meteors.ts` | Three.js 场景装配；星野、星云、银河带、流星分层生成，按设备像素比自适应 |
| 牌圈空间与运镜 | `lib/cosmic-ring-space.ts`、`cosmic-ring-entry.ts`、`cosmic-space-camera.ts`、`cosmic-stream-meshes.ts` | 78 张牌在圆环上的空间布局、入环飞行、多段相机混合过渡 |
| 牌面与牌背投影 | `lib/cosmic-card-back-projection.ts`、`cosmic-ring-handoff.ts`、`cosmic-card-marker.ts` | 3D 牌面到 2D 屏幕的裁剪矩阵与 DOM/WebGL 交接，保证翻转无跳变 |
| 牌阵与选牌几何 | `lib/cosmic-experience.ts`、`cosmic-home-space.ts`、`cosmic-dive-path.ts` | 8 种牌阵定义；圆环拖拽的阻力、最近槽位吸附与选中锚点保持 |
| 塔罗领域模型 | `data/tarotCards.ts`、`lib/tarot.ts`、`tarot-random.ts` | 78 张牌完整牌义；Fisher–Yates 无偏洗牌；正逆位独立随机源，可注入种子以便测试 |
| AI 解读服务端 | `app/api/reading/route.ts`、`lib/deepseek.ts` | 服务端唯一持有 API Key；30 s 超时、1200 输出 Token 上限、上游异常分类 |
| 请求边界防护 | `lib/reading-request-body.ts`、`reading-limits.ts`、`reading-validation.ts` | 4 KB 请求体硬上限、500 字符问题上限、按牌 ID 从服务端数据重建可信牌义，杜绝客户端伪造 |
| 响应契约校验 | `lib/reading-response.ts` | 恰好四字段（三段各 120–180 字、总结 60–100 字），缺失/多余/超长一律拒绝，不截断不补字 |
| 可观测性与隐私 | `lib/reading-observability.ts` | 结构化日志仅记录耗时、错误分类与 Token 用量，不记录问题、牌面、Prompt 与解读正文 |
| 认证与会话 | `lib/auth-config.ts`、`auth.ts`、`auth-client.ts`、`app/api/auth/[...all]/route.ts` | Better Auth + SQLite 会话；演示模式强制回环地址、校验密钥强度、文件权限 0600 |
| 个人手记持久化 | `lib/journal-db.ts`、`journal-record.ts`、`journal-storage.ts`、`app/api/journals/route.ts` | `node:sqlite` 建表与版本化记录校验；按登录账号隔离，越权访问返回 404 |
| 前端状态机 | `components/CosmicExperience.tsx` | 单文件 661 行主流程编排：开场、提问、抽牌、逐牌阅读、整体解读、保存与历史 |
| 测试体系 | `tests/unit`、`tests/integration`、`tests/e2e`、`tests/fixtures` | 领域纯函数单测、真实 `POST(Request)` 集成测试、Chromium 端到端流程；默认屏蔽真实密钥与网络 |

设计取舍：AI 解读的**可信数据重建**放在服务端而非客户端，是因为牌义与牌位会直接影响生成内容，若信任客户端传入文本，等于开放提示注入面。这一约束由 `reading-validation.ts` 集中实现，并被 API 集成测试覆盖。

---

## 5. 未包含内容及原因

| 未包含 | 体积 | 原因 |
| --- | --- | --- |
| `node_modules/` | 607 MB | 依赖可由 `package-lock.json` 完整复现，`npm ci` 自动还原 |
| `.next/`、`.next-dev/` | 606 MB | Next.js 构建缓存与产物，`npm run build` 自动生成 |
| `output/` | 976 MB | 测试截图、Playwright 报告、验收证据等过程产物，非源码 |
| `.git/` | 77 MB | 版本历史，与源码内容无关 |
| `.playwright-cli/` | 28 MB | 浏览器驱动缓存 |
| `data/*.sqlite`、`data/demo/` | 约 1 MB | 运行时数据库、演示账号与认证密钥，属本机隐私数据，首次运行自动重建 |
| `.env.local` | < 1 KB | 含真实 API Key，按安全规范不随源码分发 |
| `kit/`、`handoff_inspect/` | 1.4 MB | 开发辅助工具包与临时审查材料，非项目组成部分 |
| `ProjectDocument` 中的图片与学校表格 | 约 15 MB | 视觉稿截图与开题/中期材料，已在论文附件中单独提交 |

**结论：业务源码、测试、静态资源与工程配置 100% 保留，未做任何代码删减。** 压缩包体积主要来自 78 张真实牌面（7.6 MB）与字体、3D 贴图（25 MB），二者是页面正常渲染的必需资源。

---

## 6. 质量保障

| 检查项 | 命令 | 说明 |
| --- | --- | --- |
| 单元与集成测试 | `npm test` | Vitest，Node 环境，默认隔离真实密钥与外部网络 |
| 类型检查 | `npm run typecheck` | TypeScript 严格模式，`noEmit` |
| 代码规范 | `npm run lint` | ESLint 9 + Next.js 规则 |
| 生产构建 | `npm run build` | 构建成功即证明模块依赖完整、无缺失文件 |
| 端到端流程 | `npm run test:e2e` | Playwright + Chromium，覆盖提问→洗牌→抽牌→阅读→手记→刷新读取 |

包内已附带 `DELIVERY-MANIFEST.txt`，记录每个文件的字节数与 SHA-256，可用于核对传输完整性。

---

## 7. 说明

本项目为个人毕业设计作品，牌面图像采用 Rider-Waite-Smith 公版素材，仅用于教学演示。应用内示例解读均明确标注为示例内容，不构成医疗、法律、财务或人身安全建议。
