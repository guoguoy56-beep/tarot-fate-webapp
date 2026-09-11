# HANDOFF.md

本文档是塔罗牌 WebApp 项目的交接入口。每次开启新对话、切换 AI 助手、阶段复盘或继续开发前，优先阅读本文档，再按需要阅读 `ProjectDocument/` 下的详细文档。

## 1. 项目定位

项目名称：基于 React 的塔罗牌占卜 Web 应用设计与实现。

项目目标：实现一个基于 Next.js、React、TypeScript、Tailwind CSS 和 Framer Motion 的沉浸式塔罗占卜 WebApp。用户输入问题后，完成洗牌、抽牌、翻牌、AI 解读和本地历史记录保存，整体体验服务于毕业设计展示、答辩和论文撰写。

核心定位：一个结合古典视觉美学、物理交互动效与大语言模型解读能力的沉浸式塔罗占卜 WebApp。

核心用户：对塔罗、占卜、情绪探索和沉浸式互动体验感兴趣的普通用户。用户不需要专业塔罗知识，只需要输入问题并按界面引导完成一次占卜仪式。

## 2. 设计理念

整体美术方向为“旧女巫木桌风”：

- 深色古籍女巫桌面。
- 旧木桌、烛光、羊皮纸、黄铜边框、哥特仪式感字体。
- 神秘、古典、克制，不使用现代霓虹、科技星空、大面积玻璃拟态或高饱和商业渐变。
- 背景是柔和绘制感旧木桌，边缘压暗，中央有琥珀色烛光晕染。
- 首页标题、牌堆、输入浮层沿中轴排布，牌堆和羊皮纸输入区不能重叠。
- 真实塔罗牌面最终目标为完整 78 张 Rider-Waite-Smith Public Domain 资源，并加统一旧牌外框、暗金描边和复古滤镜。
- 卡背方向为 Sharp Gothic Ritual 卡背：近黑棕底色、烛金几何圆环、火焰、月相或仪式符号。

## 3. 技术栈与运行方式

技术栈：

- Next.js `16.3.4` App Router。
- React / React DOM `19.2.8`。
- TypeScript `5.9.3`。
- Tailwind CSS。
- Framer Motion。
- Lucide React。
- DeepSeek API，经 Next.js API Route 服务端调用。
- localStorage 保存本地占卜历史。

运行时版本基线：

- Node.js 24 LTS（`24.x`）。
- npm `>=11.19.1 <12`。
- `.nvmrc`、`package.json#engines` 与 `package.json#packageManager` 为版本约束来源；当前包管理器声明为 `npm@11.19.1`。
- 2026-09-09 本地 Node.js 验证环境为 `v24.12.0`，依赖安装、锁文件生成与验收统一使用 npm `11.19.1`。
- npm `11.6.2` 曾生成包含 `@emnapi` / `wasi-threads` 解析错配的无效锁文件，因此不再视为合格基线；不得用低于 `11.19.1` 的 npm 重写 `package-lock.json`。

进入项目后先执行 `node --version` 和 `npm --version`。使用 nvm 时可执行 `nvm use`；如本机尚未安装 Node 24，则先执行 `nvm install 24`。若本机 npm 版本低于 `11.19.1`，先升级到 `npm@11.19.1`，再执行依赖安装或锁文件维护。

常用命令：

```powershell
npm ci
npm run dev
npm run lint
npm run typecheck
npm run test:data
npm run check
npm run build
npm run start
npm run audit:all
npm run audit:prod
npm run audit:signatures
```

`npm run dev` 和 `npm run start` 均固定使用 `3000` 端口；如果端口被占用，应先释放端口，不自动切换到 `3001`。

本地开发地址：

```txt
http://localhost:3000
```

VS Code 启动方式：

```powershell
cd D:\毕业设计\塔罗牌WebApp
npm run dev
```

停止服务：在终端按 `Ctrl + C`。

## 4. 重要文档

必须优先阅读：

- `ProjectDocument/HANDOFF.md`：项目交接入口，记录当前状态、规则、进度和下一步。
- `ProjectDocument/项目说明文档.md`：项目总说明、目标、流程、模块、技术架构。
- `ProjectDocument/美术风格规范文档.md`：视觉风格、颜色、材质、卡背、输入浮层、按钮规范。
- `ProjectDocument/DEMO开发文档.md`：第一版可展示 DEMO 的功能、类型、组件和开发阶段拆分。
- `ProjectDocument/首页动态效果设计文档.md`：首页环境光、标题入场、真实牌堆衔接、阅读揭示特效等动效决策。

## 5. 项目维护规则

后续所有代码、文档、视觉、动效、功能方案或实现细节的修改，都必须遵守以下规则：

1. 修改代码时，同步更新相关项目文档。
2. 修改文档时，如影响项目进度、方案或下一步计划，同步更新本 `ProjectDocument/HANDOFF.md`。
3. 每完成一个阶段、任务或明确内容，都要更新 `ProjectDocument/HANDOFF.md` 的“已完成内容”和“下一步计划”。
4. 所有代码或项目文档修改完成并验证通过后，都要提交本地 Git 版本，并同步推送到 GitHub 远程仓库。
5. Git commit 信息应简要说明本次变更，便于版本回溯和阶段验收。
6. 推送前必须检查提交范围和敏感信息，禁止上传 API Key、环境变量文件、构建缓存或临时测试产物。
7. 如果因网络或 GitHub 服务异常无法推送，必须明确记录本地领先远程的提交，并在网络恢复后补充推送和验证远程状态。
8. 新对话中的 AI 助手应先阅读 `ProjectDocument/HANDOFF.md`，再读取需要的项目文档和代码。

## 6. 当前代码结构

当前主要文件：

```txt
src/app/page.tsx
src/app/layout.tsx
src/app/globals.css
src/app/api/reading/route.ts
src/components/TarotExperience.tsx
src/data/tarotCards.ts
src/lib/deepseek.ts
src/lib/reading-observability.ts
src/lib/reading-validation.ts
src/lib/storage.ts
src/lib/tarot.ts
src/types/reading.ts
src/types/tarot.ts
tests/data/tarot-data.test.mjs
public/assets/old-witch-table-home-bg.png
public/cards/rws/*.jpg
```

当前实现仍主要集中在 `src/components/TarotExperience.tsx`，包括首页、洗牌、抽牌、阅读和终局手记的大部分界面与交互。

## 7. 当前已完成内容

已完成的项目基础：

- Next.js + React + TypeScript + Tailwind CSS 项目骨架。
- Framer Motion 已接入。
- `lucide-react` 已接入。
- App Router 页面入口已配置。
- 工程基线已补齐：`eslint.config.mjs` 已迁移为 ESLint `9.39.5` 原生 Flat Config，直接组合 `eslint-config-next/core-web-vitals` 与 `eslint-config-next/typescript`；新增 `npm run typecheck` 与 `npm run check`。
- 本地开发与生产启动脚本已固定端口为 `3000`，避免 Next.js 自动切换到 `3001` 造成混乱。
- 已移除旧的自定义 `.next-dev` / `distDir` 配置，使用 Next.js 16 默认隔离目录：开发类型输出为 `.next/dev`，生产构建输出为 `.next`；`tsconfig.json` 已同步覆盖两者。
- `BASE-003` 框架与工具链升级已完成：Next.js `16.3.4`、React / React DOM `19.2.8`、TypeScript `5.9.3`、ESLint `9.39.5`、eslint-config-next `16.3.4`。
- `package-lock.json` 已使用 npm `11.19.1` 从干净状态重建，`package.json#packageManager` 固定为 `npm@11.19.1`；标准 `npm ci` 可复现安装，`npm ls --depth=0` 无缺失、无无效依赖、无多余顶层依赖。
- `BASE-004` CI 基线已完成：`.github/workflows/ci.yml` 会在推送到 `main` 和面向 `main` 的 Pull Request 上，以 Node.js 24、npm `11.19.1` 执行 `npm ci`、Lint、类型检查和生产构建；首次 GitHub 托管运行 [#34424590039](https://github.com/guoguoy56-beep/tarot-fate-webapp/actions/runs/34424590039) 全部通过。
- CI 的 npm 缓存仅用于加速包下载，`node_modules` 每次由锁文件重新安装；`DATA-001` 已将 `npm run test:data` 接入门禁，直接验证 78 张生产数据和真实 JPG 资源。领域、API、AI Mock 与浏览器测试仍待 `TEST-001～006` 补齐。
- `BASE-005` 依赖与供应链风险复核已完成：全量和生产依赖审计均为 0 个已知漏洞；CI 已加入 high/critical 全量审计；`.npmrc` 严格限制安装脚本，并将已审查的 `unrs-resolver@1.12.2` 精确加入白名单。
- 升级后 `npm run check` 与 `npm run build` 均通过；生产服务 HTTP 冒烟通过。Playwright 模拟成功响应已走通提问、洗牌、三次拖牌、逐张揭示和命运手记；模拟 503 已确认三张牌保留且手动重试可再次发起请求。成功路径浏览器控制台为 0 error / 0 warning。
- npm 全量审计与仅生产依赖审计均为 `0` 个漏洞。
- 全局样式、暗色基础背景和首页背景图样式已配置。
- 首页背景图已放置在 `public/assets/old-witch-table-home-bg.png`。
- 首页、洗牌、抽牌、阅读与终局阶段统一使用首页旧女巫木桌背景图和首页氛围遮罩，不在后续流程加强暗角；允许保留轻微场景缩放运镜。
- 已实现 `AmbientLightEffects`：按阶段控制两侧蜡烛 flicker、中央桌面暖光呼吸、烛光附近少量尘埃，并支持 `prefers-reduced-motion` 降低动态。
- 左右蜡烛局部 flicker 光源中心已按截图对齐到火焰中心，允许光效层向屏幕外溢出；局部光晕范围已扩大，但中心点保持不变。

已完成的功能和交互：

- 首页标题、引导语、羊皮纸输入区和“开始仪式”按钮。
- 首页主标题已按用户选定的左上角方案改为暗金雕刻感字符级标题：`命` 最大、`运` 略小、`之` 略小但不再过度缩小、`牌` 高挑收尾，并加入克制的火焰、月相、细线和星芒装饰；标题字号已收紧、颜色压暗为旧铜金，`命` 与 `牌` 的末端竖笔已向下延长，并移除字内伪元素条纹纹理和字符描边以接近预览图效果。本次只调整标题视觉，不改输入框、牌堆和主流程。
- 首页牌堆已使用独立中轴锚点固定在视口中心，避免 Framer Motion 动画覆盖 CSS 居中位移。
- 首页羊皮纸输入区已改为底部安全距离定位并保持水平居中，与中央牌堆保留稳定间隔；矮窗口下自动压缩纵向内边距。
- 首页 78 张真实牌堆已统一：首页与洗牌阶段已改为同一批 78 张牌和同一个中轴锚点持续渲染；首页 UI 退场期间牌堆保持原位，进入洗牌后才从原位响应鼠标扰动。
- 本地随机塔罗牌 deck 生成。
- 78 张牌的卡背渲染。
- 鼠标轨迹扰动洗牌逻辑。
- 洗牌结束后进入底部弧形牌带。
- 用户拖拽三张牌到“过去 / 现在 / 未来”位置。
- 抽牌阶段拖拽中的卡牌会临时脱离底部牌带裁剪，并提升到普通 UI 之上，避免被放置区、提示文字或历史按钮遮挡。
- 抽牌阶段三个牌位框整体沿中轴上移，底部弧形牌带位置保持不变；牌位纵向位置继续由单一阶段布局变量控制，便于后续替换边框、字体和素材。
- 抽牌阶段牌位区进一步上移至 `top: 24%`，移除框外重复位置标题；底部拖拽牌与框内卡牌使用相同 `layoutId`，放置成功时平滑移动并放大到牌位尺寸。
- 三张牌逐张 3D 翻牌。
- 逆位牌从翻开、阅读到进入命运手记的共享布局动画全程保持逆位，不再在过渡中翻回正向；飞向手记的临时卡牌层不再显示重复文字。
- 前端打字机式文本显示。
- `/api/reading` 后端 API 路由。
- `API-001` 共享领域校验已完成：服务端用可复用校验器检查三牌数量、已知 ID、牌位、方向、重复牌位和重复卡牌，并以稳定错误码返回 400。
- `API-002` 服务端可信牌义已完成：浏览器只发送问题与 `cardId`、牌位、方向；服务端从 `tarotCardMap` 补全名称、关键词和含义，伪造或附加的客户端牌义字段会被丢弃，不能进入 DeepSeek Prompt。
- `API-003` 请求规模限制已完成：问题最多 500 个 Unicode 字符，首尾空白清理、换行统一且内部换行保留；请求体最多 4096 个 UTF-8 字节，普通和分块超大请求均返回稳定 413。旧前端显示计数、超限提示并阻止提交。
- `API-004` 已完成范围纠偏：用户确认项目当前仅做本地开发与运行，没有云端部署计划。此前未经确认假设 Vercel + Upstash 的实现已撤销，当前仓库不依赖 Redis、不要求云端环境变量，也没有公网匿名限流。该任务移至未来发布阶段，只有用户明确决定公开部署并选定平台后才重新启动。
- DeepSeek API 服务端调用封装，默认使用 `deepseek-v4-flash` 非思考模式和一次性 JSON 响应。
- DeepSeek 请求已增加 30 秒超时、返回字段校验，以及配置、认证、余额、限流、上游服务和格式错误分类。
- 阅读阶段在接口失败时保留当前问题与三张牌，显示中文错误并支持手动重试；不再自动回退到模拟解读。
- DeepSeek 真实在线接口已完成联调；服务端只向模型发送当前正逆位对应的关键词，并明确禁止模型改写牌的实际方向。
- 已选定并接入 Eclipse Reliquary / 日蚀圣龛正式卡背，首页牌堆、洗牌、底部牌带、抽牌与翻牌背面统一使用 `public/assets/tarot-card-back.webp`。
- 卡背外层边缘已从偏亮黄褐调整为深黑棕暗铜色，接近卡背主色但保留轻微区分，避免首页 78 张牌堆叠后形成突兀亮边。
- 已接入完整 78 张 Rider-Waite-Smith 真实牌面 JPG 素材，文件位于 `public/cards/rws/`；`src/data/tarotCards.ts` 已改为使用 `/cards/rws/*.jpg` 路径，翻牌正面已从代码占位样式替换为真实牌面；牌面内缩 `5px`，底层使用 `#FCF8FD` 填充，不额外添加厚黑边框或最外层白色描边，并在整个卡牌组件上层统一叠加 medium 强度黄色老旧滤镜、轻中度暗角、角落褐色旧化、旧纸颗粒和贴着牌图内缘的褐色磨损渐变；牌面上不再叠加项目自定义牌名、关键词或正逆位文字。
- 已优化 78 张牌交互性能：洗牌指针更新限制为每动画帧一次并缓存卡背节点；抽牌牌带使用稳定牌位，抽走单牌时不再触发其余牌集体重排，并仅为当前拖拽牌绘制外阴影；首页牌堆改为单一整体阴影，避免 78 层阴影叠加。
- 洗牌扰动采用非线性距离衰减与低刚度弹簧响应，卡牌带滞后和惯性而非锁定鼠标；洗牌结束后所有牌保持可见地快速收拢到下方同一位置，再从该位置连续展开为抽牌牌带，不使用渐隐渐显。
- localStorage 历史记录读取和保存。
- 历史记录弹窗。
- 终局命运手记界面。

已完成的文档：

- 项目说明文档。
- 美术风格规范文档。
- DEMO 开发文档。
- 首页动态效果设计文档。
- 本交接文档 `ProjectDocument/HANDOFF.md`。

## 8. 当前重要设计决策

首页动效方向：

- 采用前端叠加动态光效，不重新生成背景图。
- 两侧蜡烛要有明显可见的真实蜡烛式快速细碎 flicker。
- 烛光不仅影响蜡烛附近，也能明显扫到桌面中心，让整体暖光轻微变化。
- 尘埃粒子几乎只在烛光附近可见，不做全屏粒子背景。
- 环境光贯穿后续阶段，但随阶段降低强度。

标题入场：

- 首页主标题当前已具备字符级 DOM 结构和左上角方案的静态视觉样式，便于后续接入单字入场动效。
- 主标题拆成单字乱序重叠显现。
- 四字标题默认出现顺序为第 3 字 -> 第 2 字 -> 第 1 字 -> 第 4 字。
- “命运之牌”的入场顺序为：之 -> 运 -> 命 -> 牌。
- 最终排版仍为“命运之牌”。

牌堆方案：

- 采用方案 B：统一 `TarotDeck` 组件。
- 首页牌堆、洗牌牌堆、底部牌带后续应由同一批真实牌数据和统一组件管理。
- 首页 78 张真实牌堆已统一；当前首页牌堆是整齐压紧的一摞真实 78 张牌，不是 5 张装饰预览。
- 当前代码已在首页与洗牌阶段复用同一批 78 张牌的中轴牌堆，后续需要收敛为独立 `TarotDeck` 组件。

镜头与背景：

- 取消明显 2D 背景 3D 镜头变化。
- 不再强调大幅 `camera-lift`。
- 后续改为 `ritual-transition`：标题先淡、羊皮纸模糊下沉、中央牌堆留在原地进入 `shuffle-ready`。
- 3D 重点放在卡牌本体，不对 2D 背景做明显 `rotateX`。

阅读阶段：

- 三张牌放置区在 `reading` 阶段需要上移，避免卡牌与底部解读面板重合。
- 当前牌需要更明显的暖光聚焦、边缘高光和神秘金粉粒子。
- 阅读阶段揭示特效应独立为 `CardRevealEffects`，不要绑在全局环境光组件里。

## 9. 当前已知问题与待修正点

当前代码与最新设计文档仍有差异：

- 仓库不包含 `.env.local`，在新设备或部署环境运行真实解读前仍需单独配置 DeepSeek API Key。
- 真实牌面当前为 JPG 版本，尚未统一转换为 WebP；如后续接入可靠图片转换工具，可再压缩和统一格式。
- `TarotExperience.tsx` 仍使用 `camera-lift` 阶段命名。
- 背景目前还有 `rotateX` 相关动效，需要按新方案弱化或取消。
- 首页牌堆已与洗牌牌堆统一为同一批 78 张牌，但后续仍需将当前内联布局进一步收敛为独立 `TarotDeck` 组件。
- `shuffle-ready` / `shuffle-active` 尚未拆分。
- `RitualTitle` 单字乱序入场尚未实现；当前仅完成首页主标题静态视觉个性化和字符级结构。
- `CardRevealEffects` 当前牌聚光、边缘高光、神秘金粉粒子尚未实现。
- `reading` 阶段三牌区上移和底部解读面板防遮挡布局尚未实现。
- 目前大部分组件仍集中在一个 `TarotExperience.tsx` 文件中，后续可以逐步拆分。

## 10. 下一步计划

> 2026-09-09 更新：本节以下内容是前端整体重做决策之前的旧视觉优化顺序，现已暂停，不再作为当前执行入口。最新权威计划见 `ProjectDocument/项目重启建设总计划-2026-09-09.md`。旧前端仅保留为参考和必要维护对象。

建议按以下顺序推进，避免一次性重构过大：

1. 完善 `RitualTitle` 动效。
   - 当前主标题已完成左上角方案静态视觉样式和完整 `aria-label`。
   - 后续补充单字乱序重叠显现。
   - 英文小标题保持整体淡入。

2. 收敛首页牌堆实现。
   - 当前首页已渲染真实 deck 的整齐压紧牌堆。
   - 后续把当前内联布局迁移到统一 `TarotDeck` 组件。
   - 保留现有鼠标扰动算法。

3. 引入 `ritual-transition`。
   - 替代当前明显 `camera-lift` 语义。
   - 标题淡出，羊皮纸模糊下沉，牌堆进入 `shuffle-ready`。

4. 拆分统一 `TarotDeck`。
   - 支持 `home-stack / shuffle-ready / shuffle-active / fan / draw`。
   - 迁移现有鼠标扰动逻辑。
   - 保持现有抽牌流程可用。

5. 修正阅读阶段布局。
   - 三牌区上移。
   - 底部解读面板防遮挡。
   - 移动端降低卡牌尺寸。

6. 实现 `CardRevealEffects`。
   - 当前牌暖光聚焦。
   - 当前牌边缘高光。
   - 神秘金粉粒子揭示效果。

每完成以上任一任务，都要更新 `ProjectDocument/HANDOFF.md`、相关项目文档，并提交 Git 版本。

## 11. 验证清单

每次实现后至少检查：

- `npm run lint` 是否通过。
- `npm run typecheck` 是否通过。
- `npm run build` 是否通过。
- 首页是否能正常进入。
- 用户能否输入问题并点击开始仪式。
- 洗牌是否仍能被鼠标轨迹扰动。
- 能否结束洗牌并进入底部牌带。
- 能否拖拽三张牌到过去、现在、未来。
- 三张牌是否能按顺序翻开。
- DeepSeek 正常响应时是否返回过去、现在、未来和总结四个完整字段。
- DeepSeek 配置错误、认证失败、限流或超时时是否保留抽牌状态并允许手动重试。
- 阅读面板是否不再被卡牌遮挡。
- 历史记录是否能保存和读取。
- 页面是否符合旧女巫木桌风，不出现现代霓虹或过度粒子。

## 12. 环境变量

DeepSeek API 相关环境变量建议：

```txt
DEEPSEEK_API_KEY=your_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_READING_ENABLED=true
```

API Key 不得暴露在前端。当前接口使用非思考模式、严格 JSON 输出、1200 Token 输出上限和 30 秒服务端超时；未配置 Key 时返回明确配置错误，不生成模拟解读。将 `DEEPSEEK_READING_ENABLED=false` 并重启本地服务，可在访问上游前人工熔断新的在线解读；未配置该变量时默认启用。合法 AI 阶段请求会输出 `[tarot.reading]` 本地结构化日志，记录结果、耗时、错误分类、Provider 状态和实际 Token，累计值只覆盖当前进程且不含问题、卡牌、Prompt、Key 或解读正文。项目当前没有 Redis、Vercel 或其他云端运行依赖，`npm run dev` 与 `npm run start` 均只需要本地 Node.js 环境和可选的 DeepSeek Key。

## 13. 2026-09-09 项目重启评估

已完成一次覆盖代码、依赖、文档、Git、桌面端/移动端真实浏览器流程、DeepSeek 错误链路、安全和部署准备度的全量评估。详细结论见：

- `ProjectDocument/项目重启技术评估报告-2026-09-09.md`

本轮评估后的核心判断：

- 桌面端毕业设计演示 DEMO 完成度约 75%，综合产品化完成度约 55%。
- `BASE-001` 已完成：运行时统一为 Node.js 24 LTS，npm 基线经 `BASE-003` 实测收紧为 `>=11.19.1 <12`，并通过 `.nvmrc`、`package.json#engines`、`package.json#packageManager`、README 和本交接文档固化。
- `BASE-002` 已完成：升级目标最终确定为 Next.js `16.3.4`、React / React DOM `19.2.8`、ESLint `9.39.5`、eslint-config-next `16.3.4`、TypeScript `5.9.3`；选择 ESLint 9 是为了同时满足 Next 16 及其规则插件的已声明 peer 范围。Tailwind 4 和 Motion 13 延后到新前端阶段。完整决策见 `ProjectDocument/BASE-002-框架升级决策记录-2026-09-09.md`。
- `BASE-003` 已完成：框架和工具链已按最终组合升级；ESLint 已迁移到原生 Flat Config；旧自定义 `.next-dev` / `distDir` 已移除并采用 Next.js 16 默认 `.next/dev`；`package-lock.json` 已用 npm `11.19.1` 从干净状态重建。
- `BASE-004` 已完成：GitHub Actions CI 已固化 Node/npm 版本，并自动执行干净安装、Lint、类型检查和生产构建；本地与首次远程质量门禁均通过。实施记录见 `ProjectDocument/BASE-004-CI基线实施记录-2026-09-10.md`。
- `BASE-005` 已完成：完整与生产依赖审计均为 0；CI 会阻断 high/critical 漏洞；依赖安装脚本采用严格、精确版本白名单。ESLint 9 EOL 仍按期限复核；npm 签名接口曾返回 503，已在 API-004 范围纠偏后重试通过，详见 `ProjectDocument/BASE-005-依赖与供应链风险记录-2026-09-10.md`。
- `KIT-001` 已完成：用户提供的“全栈开发专家”套件经评估为部分适用。原包是面向 Qoder 的 Java Spring Boot + Vue 3 套件，不能原样作为本项目 Codex 技能；原件保持不动，适用方法已重写为 `.agents/skills/` 下的 API、代码审查、测试策略、性能诊断和安全重构五个仓库技能。Vue、Java、数据库能力搁置，新前端技能等 `FE-GATE` 后再定。详见 `ProjectDocument/KIT-001-全栈开发专家套件评估与适配记录-2026-09-10.md`。
- `API-001` 已完成：新增 `src/lib/reading-validation.ts` 共享校验，`ReadingCardPayload` 和旧前端请求增加 `cardId`；非法 JSON、缺字段、错误类型、错误牌数、非法/未知 ID、非法/重复牌位、非法方向和重复卡牌均返回稳定 400。生产 HTTP 矩阵 13/13 通过，合法请求通过本地模拟 DeepSeek 返回 200，未调用真实服务。详见 `ProjectDocument/API-001-共享领域校验实施记录-2026-09-10.md`。
- `API-002` 已完成：公开请求类型已收敛为问题和三张牌的 `cardId`、牌位、方向；共享校验器按 ID 从 `tarotCardMap` 重建 `TrustedReadingRequest`，DeepSeek 适配层只接受该可信类型并按实际方向选择关键词。最小请求、伪造元数据和未知卡牌三项本地生产形态 HTTP/Prompt 验收全部通过，未调用真实服务。详见 `ProjectDocument/API-002-服务端可信牌义实施记录-2026-09-10.md`。
- `API-003` 已完成：新增共享 500 字限制和 4096 字节请求体限制；服务端按标准 `Request.body` 流累计实际字节，不能通过省略 `Content-Length` 绕过。新增 `QUESTION_TOO_LONG`（400）和 `REQUEST_TOO_LARGE`（413）；HTTP 边界矩阵 8/8、真实浏览器 500/501 字和 emoji 计数均通过。详见 `ProjectDocument/API-003-请求长度与规模限制实施记录-2026-09-10.md`。
- `API-004` 的部署前提已按用户决定纠正：当前项目仅本地运行，不选定云平台、不创建云资源，也不为尚不存在的公网环境引入 Redis。此前 Vercel + Upstash 方案及实现已从当前代码和运行文档撤销；未来出现明确部署计划时，API-004 与 `REL-001` 一起重新评估。
- `API-005` 已完成：增加 `DEEPSEEK_READING_ENABLED=false` 本地人工熔断、1200 Token 单次输出上限和进程内 `[tarot.reading]` 结构化指标；成功路径统计上游实际 Usage，失败路径区分本地阻止、余额不足、限流、Provider 故障和无效响应。浏览器契约不变，不增加自动重试、假解读、数据库或云端依赖。实施记录见 `ProjectDocument/API-005-成本与故障保护实施记录-2026-09-11.md`。
- `DATA-001` 已完成：新增无第三方依赖的 Node 24 数据测试，直接验证 78 张牌、唯一 ID/图片路径、22/56 大小阿卡纳、四花色各 14 张、编号范围、必要文本与正逆位关键词，以及 78 个实际 JPG 文件和 JPEG 首尾标记；`npm run test:data` 已接入 GitHub Actions。生产数据无需修正。实施记录见 `ProjectDocument/DATA-001-塔罗牌数据与资源完整性测试实施记录-2026-09-11.md`。
- npm `11.6.2` 曾生成无效的 `@emnapi` / `wasi-threads` 锁文件；当前通过最低 npm 版本约束和 `packageManager: npm@11.19.1` 防止问题复现。
- 框架升级验收已全部通过：真实 `npm ci`、`npm ls --depth=0`、`npm run check`、`npm run build`、生产服务 HTTP 冒烟、Playwright 模拟成功/503 的完整核心流程；成功路径浏览器控制台为 0 error / 0 warning。
- `npm audit` 全量审计与 `npm audit --omit=dev` 生产依赖审计均为 `0` 个漏洞，旧版 Next.js 安全风险已随升级消除。
- DeepSeek 真实请求当前因账户余额不足返回 503；错误保留牌局和手动重试逻辑可用。
- 桌面端后半流程已通过浏览器级模拟响应验证；发现阅读面板遮牌、终局历史按钮不可点击和保存可重复等问题。
- 390×844 移动端布局明显未完成，核心抽牌页不满足可用标准。
- localStorage 只做 JSON 解析，没有运行时结构校验；错误结构会导致历史弹窗崩溃。
- `/api/reading` 已完成卡牌身份、牌位、方向、三牌唯一性、服务端可信牌义、问题长度、请求体规模限制和本地成本/故障保护。公网频率/并发保护仍随部署决策延期。
- ESLint `9.39.5` 已进入 EOL，但 ESLint 10 仍与当前 `eslint-config-next` 带入的三个插件 peer 范围冲突；该风险只影响开发工具链、当前没有已知漏洞，已限时接受并要求最迟 2026-10-10 复核。
- `npm audit signatures` 曾因 npm 注册表的 Next.js SWC 来源证明接口连续返回 503；2026-09-10 已成功重试，当前 389 个包签名有效、83 个包具有已验证 attestations，公开发布前仍需再次执行。

以下是技术评估完成时给出的初始优先顺序。由于用户随后确认前端整体重做，该顺序已被第 14 节和新总计划替代，仅保留为评估历史：

1. 修复依赖锁文件，固定 Node/npm 环境并升级安全版本。
2. 建立核心流程自动化冒烟测试。
3. 加固 `/api/reading` 的可信数据边界、输入限制、限流和成本保护。
4. 修复桌面端阅读遮挡、终局历史入口、本地数据校验和重复保存。
5. 完成移动端抽牌方案和可访问性基础。
6. 在测试保护下拆分 `TarotExperience.tsx`。
7. 最后继续标题入场、`CardRevealEffects` 和素材性能优化。

## 14. 2026-09-09 前端整体重做决策与建设计划

用户已确认：项目后续将对前端进行整体重新设计和实现。前端具体视觉、交互、组件架构和迁移路径暂不在当前阶段提前决定，待工程、API、数据和测试基础稳定后单独讨论。

新的权威执行计划：

- `ProjectDocument/项目重启建设总计划-2026-09-09.md`

计划原则：

- 当前旧前端进入维护冻结，保留为流程、视觉、素材和交互参考。
- 不再继续旧路线中的大规模组件拆分、移动端重做和视觉特效开发。
- 旧前端只修复会阻塞基础验证、临时演示、数据安全或后端联调的严重问题。
- 先完成依赖可复现、框架安全升级、API 可信边界、测试底座、AI 可用性和本地数据兼容。
- 上述基础通过阶段关口后，再共同输出新前端专项方案。
- 新前端达到功能、桌面/移动端、数据兼容和 E2E 验收标准后，才删除旧前端代码。

工程套件规则：

- Codex 仓库技能位于 `.agents/skills/`，只在描述匹配的任务中使用；它们辅助执行，不替代本 HANDOFF 和总计划。
- `kit/AI用全栈开发套件包/` 是用户提供的 Qoder/Java/Vue 原始参考，不作为项目技术栈或默认实现规范。
- 性能和重构技能不能绕过当前优先级；React 前端实现技能在 `FE-GATE` 前不创建、不使用。

当前唯一下一项任务：

1. `DATA-002`：规范随机牌组与正逆位逻辑，用明确的 Fisher-Yates 实现替换随机比较器，并验证不丢牌、不重复和不修改源数据。

`BASE-001`～`BASE-005`、`KIT-001`、`API-001`～`API-003`、`API-005` 和 `DATA-001` 均已完成。API-004 的公网部署与匿名限流已按用户决定延期到未来发布阶段；当前不创建云资源。前端整体重做继续冻结，只有在工程、API、数据、测试与 AI 可用性门禁全部满足后，才进入新前端专项讨论与建设。
