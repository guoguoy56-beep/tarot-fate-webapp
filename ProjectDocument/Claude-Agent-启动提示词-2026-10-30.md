# Claude Agent 启动提示词

在新 Agent 空间接入项目根目录后，将下面代码块中的内容完整发送给 Claude。路径以新空间中实际挂载的项目根目录为准。

```text
请接手这个塔罗牌 WebApp 的前端重建。我已把完整项目文件夹接入当前 Agent 空间，原本路径为 D:\毕业设计\塔罗牌WebApp；若挂载路径不同，请从包含 package.json、src、public、ProjectDocument 的目录定位项目根目录。

这次先整体了解项目，再继续与我讨论前端方案和后续构建。第一阶段只读：不要直接改代码、改文档、安装依赖、初始化新工程、升级框架或部署，也不要调用真实付费 AI。

首先完整阅读：
1. ProjectDocument/前端重建交接-Claude-Agent-2026-10-30.md
2. ProjectDocument/Agents.md
3. ProjectDocument/HANDOFF.md
4. ProjectDocument/FRONTEND-001-重建分支与需求访谈-2026-10-30.md
5. ProjectDocument/FRONTEND-002-多牌阵能力评估-2026-10-30.md
6. ProjectDocument/FRONTEND-003-首页视觉探索-2026-10-30.md

然后按交接文档中的走读清单，实际检查 Git、README、package.json 和工程配置，通读 src 下的页面、组件、样式、牌组数据、领域类型、随机逻辑、API、DeepSeek 适配与本地存储，再阅读测试、fixture、Mock 和 CI。不要只读文档就认为理解了代码；不要读取或输出 .env.local 等文件里的密钥。

请实际查看 ProjectDocument/frontend-handoff-assets/ 内三张首页概念图。固定编号为：
1 = homepage-option-01-armillary.png
2 = homepage-option-02-nebula-voyage.png
3 = homepage-option-03-cosmic-corridor.png
我还没有选择任何一张，也没有批准直接开工。看不到图片时请说明具体缺口，不要猜图。

必须记住：
- 毕业设计论文、原 Word、图表、截图和排版现在一律保持原样，等新版完成后再统一修改。
- 新工作继续在 codex/frontend-rebuild；main、codex/frontend-baseline-2026-10-30 和 frontend-before-rebuild-2026-10-30 标签保留。先检查工作区，不覆盖已有修改，不清理未跟踪材料，不强推或擅自合并 main。
- 暂定名“命运回廊”，桌面端优先，手机适配暂缓。神秘塔罗星空采用深蓝黑紫、蓝紫星云与暗金。卡牌飞入并待机，标题和开始按钮依次出现；点击开始后同场景浮出牌阵和问题面板；提交后穿行进入抽牌位置，解读前舒缓转场。
- 自动洗牌，星空圆环选牌，悬停聚焦，点击后自动飞入牌位；解读逐张翻牌、逐张阅读。
- 先完成全部八类牌阵前端体验，新增牌阵的真实 AI 解读与保存后续接入；登录先做演示，不启动真实认证、云资源或部署。牌阵张数和牌位仍以可调整草案为起点。
- 旧项目只有过去/现在/未来三牌完整贯通，接口和历史均有限制。保留已有服务与数据，不用假内容冒充真实 AI，不把新功能计划写成已实现。

读完后，请先用中文说明你的项目理解，并引用实际检查过的关键文件路径：当前架构与完整流程、可复用部分、固定三牌限制、测试与环境现状、已确认需求和仍待讨论事项，以及对三张图的实际查看情况。区分事实、建议和未验证内容。

最后给出后续讨论顺序，先向我提出 2～3 个最关键的问题，继续收敛视觉和前端方案；已经明确的决定不要反复重问。第一阶段先完成走读与讨论，待我们明确进入构建阶段后，再分步骤实施并验证。
```
