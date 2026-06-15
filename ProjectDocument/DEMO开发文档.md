# 塔罗牌 WebApp DEMO 开发文档

## 1. 开发目标

本开发文档面向第一版可展示 DEMO。目标是在有限时间内完成一个能完整跑通核心流程的塔罗牌 WebApp，而不是一次性实现所有扩展功能。

第一版 DEMO 必须具备：

1. 用户输入问题。
2. 点击开始仪式。
3. 进入俯视桌面的洗牌阶段。
4. 用户通过鼠标轨迹扰动牌堆。
5. 卡牌收束到底部弧形牌带。
6. 用户拖拽三张牌到“过去 / 现在 / 未来”位置。
7. 系统逐张翻牌。
8. 后端调用 DeepSeek API 生成三牌解读。
9. 前端按三张牌分段流式展示解读。
10. 用户可保存本次占卜记录到 localStorage。

## 2. 技术栈

### 2.1 核心框架

- Next.js App Router
- React
- TypeScript

### 2.2 样式与动画

- Tailwind CSS
- Framer Motion

### 2.3 AI 接口

- DeepSeek API
- Next.js API Route
- OpenAI 兼容请求格式

### 2.4 本地数据

- TypeScript 本地牌库文件
- localStorage 本地历史记录

## 3. 推荐目录结构

```txt
src/
  app/
    page.tsx
    layout.tsx
    globals.css
    api/
      reading/
        route.ts
  components/
    home/
      RitualHome.tsx
      QuestionParchment.tsx
    table/
      DivinationTable.tsx
      CameraLiftScene.tsx
    cards/
      TarotCard.tsx
      TarotDeck.tsx
      ArcCardFan.tsx
      DropZone.tsx
    reading/
      RevealSequence.tsx
      StreamingText.tsx
      FinalJournal.tsx
  data/
    tarotCards.ts
  hooks/
    useShufflePhysics.ts
    useTarotDraw.ts
    useReadingStream.ts
    useLocalReadings.ts
  lib/
    deepseek.ts
    storage.ts
    tarot.ts
  types/
    tarot.ts
    reading.ts
  assets/
    cards/
      major/
      minor/
      backs/
    textures/
```

如果项目根目录不使用 `src/`，也可以将这些目录直接放在项目根目录下，但职责划分应保持一致。

## 4. 页面状态机

建议将主流程设计为一个明确的状态机，避免交互混乱。

```ts
type AppStage =
  | 'intro'
  | 'question'
  | 'camera-lift'
  | 'shuffle'
  | 'fan'
  | 'draw'
  | 'reading'
  | 'final'
```

各阶段说明：

- `intro`: 黑屏与中央显现。
- `question`: 首页标题、引导语和问题输入。
- `camera-lift`: 点击开始仪式后的镜头上抬。
- `shuffle`: 鼠标轨迹洗牌。
- `fan`: 卡牌收束为底部弧形牌带。
- `draw`: 用户拖拽三张牌。
- `reading`: 逐张翻牌与 AI 解读。
- `final`: 终局清场与命运手记。

## 5. TypeScript 类型设计

### 5.1 塔罗牌类型

```ts
export type ArcanaType = 'major' | 'minor'

export type TarotSuit = 'wands' | 'cups' | 'swords' | 'pentacles' | null

export interface TarotCardData {
  id: string
  nameCn: string
  nameEn: string
  arcana: ArcanaType
  suit: TarotSuit
  number: number
  uprightKeywords: string[]
  reversedKeywords: string[]
  meaning: string
  image: string
}
```

### 5.2 抽牌结果类型

```ts
export type SpreadPosition = 'past' | 'present' | 'future'

export type CardOrientation = 'upright' | 'reversed'

export interface DrawnCard {
  position: SpreadPosition
  cardId: string
  orientation: CardOrientation
}
```

### 5.3 AI 解读类型

```ts
export interface ReadingResponse {
  past: string
  present: string
  future: string
  summary: string
}
```

### 5.4 历史记录类型

```ts
export interface ReadingRecord {
  id: string
  question: string
  createdAt: string
  spread: {
    position: SpreadPosition
    cardId: string
    orientation: CardOrientation
    interpretation: string
  }[]
  summary: string
}
```

## 6. 组件职责说明

### 6.1 `RitualHome`

负责首页整体视觉与状态入口。

职责：

- 黑屏中央显现。
- 显示标题“命运之牌”。
- 显示引导语。
- 承载羊皮纸问题输入区。
- 点击“开始仪式”后进入下一阶段。

### 6.2 `QuestionParchment`

负责问题输入。

职责：

- 显示羊皮纸浮层。
- 输入用户问题。
- 显示占卜引导语。
- 触发开始按钮。

注意：

- 输入不设硬性字数限制。
- 可用软性提示引导用户提问更清晰。

### 6.3 `DivinationTable`

负责占卜桌主场景。

职责：

- 渲染旧木桌背景。
- 管理不同阶段下的卡牌布局。
- 控制洗牌、抽牌、翻牌、终局之间的切换。

### 6.4 `TarotDeck`

负责 78 张牌的集合渲染。

职责：

- 初始牌堆。
- 洗牌散落。
- 收束到底部弧形牌带。

### 6.5 `ArcCardFan`

负责底部弧形牌带。

职责：

- 将 78 张牌按弧线排列。
- 每张牌背面朝上。
- 支持拖拽抽牌。

弧形布局可基于卡牌索引计算：

```ts
const angle = (index - centerIndex) * angleStep
const x = (index - centerIndex) * cardGap
const y = Math.abs(index - centerIndex) * curveDepth
```

### 6.6 `DropZone`

负责过去、现在、未来三个放置区域。

职责：

- 标识当前等待放置的位置。
- 检测卡牌是否拖入区域。
- 成功放置后锁定卡牌。

### 6.7 `RevealSequence`

负责逐张翻牌。

职责：

- 按过去、现在、未来顺序翻牌。
- 控制当前聚焦卡牌。
- 控制背景压暗。
- 配合 `StreamingText` 展示对应解读。

### 6.8 `StreamingText`

负责文本流式显示。

职责：

- 接收一段文本。
- 以打字机效果逐字显示。
- 避免页面卡顿。

第一版可以先使用前端本地打字机效果模拟流式展示。API 接口稳定后，再升级为真实流式读取。

### 6.9 `FinalJournal`

负责终局命运手记。

职责：

- 展示用户问题。
- 展示三张牌与完整解读。
- 展示最终总结箴言。
- 提供保存记录按钮。

## 7. 核心 Hook 设计

### 7.1 `useShufflePhysics`

负责洗牌阶段的卡牌扰动。

输入：

- 卡牌初始位置
- 鼠标坐标
- 鼠标移动速度

输出：

- 每张牌的 x
- 每张牌的 y
- 每张牌的 rotate
- 每张牌的 zIndex

实现思路：

1. 监听鼠标移动或拖拽事件。
2. 记录最近一段鼠标轨迹。
3. 计算每张卡牌与鼠标点之间的距离。
4. 距离越近，受到的推力越大。
5. 给每张牌叠加少量随机旋转与延迟。
6. 使用 Framer Motion spring 动画表现物理阻尼。

复杂逻辑应添加中文注释，说明推力、衰减、随机扰动和边界控制。

### 7.2 `useTarotDraw`

负责抽牌逻辑。

职责：

- 从 78 张牌中随机确定牌序。
- 判断正逆位。
- 记录三张被抽中的牌。
- 管理过去、现在、未来的放置顺序。

### 7.3 `useReadingStream`

负责 AI 解读展示。

职责：

- 调用后端 API。
- 接收结构化结果。
- 按当前翻牌阶段展示对应段落。
- 控制文本逐字显示。

### 7.4 `useLocalReadings`

负责历史记录。

职责：

- 从 localStorage 读取记录。
- 保存新记录。
- 删除历史记录。
- 清空全部历史。

## 8. API 设计

### 8.1 路由

```txt
POST /api/reading
```

### 8.2 请求体

```ts
interface ReadingRequest {
  question: string
  cards: {
    position: 'past' | 'present' | 'future'
    nameCn: string
    nameEn: string
    orientation: 'upright' | 'reversed'
    uprightKeywords: string[]
    reversedKeywords: string[]
    meaning: string
  }[]
}
```

### 8.3 响应体

```ts
interface ReadingResponse {
  past: string
  present: string
  future: string
  summary: string
}
```

### 8.4 DeepSeek 调用规则

DeepSeek API Key 必须只存在于服务端环境变量中。

推荐环境变量：

```txt
DEEPSEEK_API_KEY=your_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
```

前端不得直接调用 DeepSeek API。当前默认使用 `deepseek-v4-flash` 非思考模式，由服务端一次性获取严格 JSON；接口失败时保留抽牌状态并提供手动重试，不自动回退到模拟解读。

## 9. AI Prompt 规范

后端调用 DeepSeek 时，应使用固定系统角色。

示例：

```txt
你是一位古老女巫，通晓塔罗、象征、梦境与宿命。你的语言神秘、晦涩、富有诗意，但必须围绕用户的问题给出可理解的解读。

你需要根据用户的问题，以及三张分别代表过去、现在、未来的塔罗牌，生成一次完整三牌占卜解读。

要求：
1. 不要说自己是 AI。
2. 不要使用现代心理咨询式语气。
3. 不要直接给出绝对承诺。
4. 语言应具有古老女巫、烛光、命运、影子、旧书、火焰等氛围。
5. 返回 JSON，字段必须为 past、present、future、summary。
```

用户消息应包含：

- 用户问题
- 过去牌
- 现在牌
- 未来牌
- 每张牌正逆位
- 每张牌关键词

## 10. localStorage 规范

推荐 key：

```ts
const STORAGE_KEY = 'tarot_reading_records'
```

保存策略：

1. 每次终局后由用户手动点击保存。
2. 保存前生成唯一 ID。
3. 使用 ISO 时间字符串保存创建时间。
4. 保存失败时给出前端提示。

## 11. DEMO 开发阶段拆分

### 阶段 1：项目骨架

目标：

- 初始化 Next.js + TypeScript + Tailwind 项目。
- 配置 Framer Motion。
- 建立目录结构。
- 创建基础类型文件。

完成标准：

- 首页可以正常运行。
- Tailwind 样式生效。
- Framer Motion 可用。

### 阶段 2：首页与视觉基调

目标：

- 实现黑屏中央显现。
- 实现烛光占卜台首页。
- 实现羊皮纸输入浮层。
- 实现“开始仪式”按钮。

完成标准：

- 用户可以输入问题。
- 点击按钮后能切换到下一阶段。

### 阶段 3：洗牌交互

目标：

- 实现镜头上抬效果。
- 渲染 78 张牌的背面牌堆。
- 实现鼠标轨迹扰动洗牌。
- 实现“命运已乱，开始抽牌”按钮。

完成标准：

- 用户移动鼠标时，卡牌能产生散落和旋转。
- 点击结束按钮后进入底部牌带阶段。

### 阶段 4：底部弧形牌带与拖拽抽牌

目标：

- 实现底部弧形牌带。
- 实现三张牌拖拽放置。
- 实现过去、现在、未来放置区。

完成标准：

- 用户可以拖出三张牌。
- 三张牌能按顺序放入指定位置。

### 阶段 5：翻牌与 AI 解读

目标：

- 实现 3D 翻牌。
- 实现 `/api/reading`。
- 接入 DeepSeek API。
- 实现结构化解读结果。
- 实现逐字显示文本。

完成标准：

- 三张牌能逐张翻开。
- 每张牌有对应解读。
- API Key 不暴露在前端。

### 阶段 6：终局与历史记录

目标：

- 实现未选中牌飞出屏幕。
- 实现命运手记。
- 实现 localStorage 保存历史。
- 实现历史记录查看入口。

完成标准：

- 用户可以保存一次占卜记录。
- 刷新页面后历史记录仍可查看。

## 12. 开发优先级

第一优先级：

- 主流程可跑通。
- 三张牌可抽取、翻开和解读。
- AI 接口可用。

第二优先级：

- 洗牌手感更自然。
- 卡牌弧形排列更美观。
- 终局清场动画更完整。

第三优先级：

- 牌面插画完善。
- 命运手记视觉增强。
- 历史记录页面美化。

## 13. 占位数据策略

在 AI 接口联调完成前，可以使用本地假数据。

占位文本必须符合项目语气，例如：

```txt
旧牌在火光中低语。你曾经回避的影子，正在以另一种形状回到你的桌前。
```

禁止使用：

- Lorem Ipsum
- 无意义乱码
- 与项目氛围不符的现代口水话

## 14. 动画实现注意事项

1. 涉及 Framer Motion、拖拽、鼠标事件和 localStorage 的组件必须添加 `"use client"`。
2. 78 张牌同时动画可能产生性能压力，应避免每帧进行复杂计算。
3. 洗牌阶段可以只对靠近鼠标轨迹的牌进行明显扰动，远处牌只做轻微变化。
4. 卡牌图片应压缩，避免首屏加载过慢。
5. 复杂动画应优先保证流畅，再追求细节。

## 15. 测试要点

### 15.1 功能测试

- 问题为空时是否允许开始仪式。
- 是否能完成洗牌。
- 是否能结束洗牌。
- 是否能拖拽三张牌。
- 是否能按顺序翻牌。
- API 异常时是否有提示。
- 历史记录是否能保存和读取。

### 15.2 交互测试

- 鼠标轨迹洗牌是否卡顿。
- 拖拽过程中卡牌是否错位。
- 放置区域是否容易识别。
- 翻牌动画是否自然。
- 终局清场是否影响三张主牌。

### 15.3 视觉测试

- 首页文字是否清晰。
- 羊皮纸浮层是否符合古典风格。
- 页面是否过暗导致不可用。
- 按钮是否具有可点击感。
- 移动端是否出现文字重叠。

## 16. 风险与应对

### 16.1 78 张牌动画性能风险

应对方式：

- 降低同时参与复杂动画的卡牌数量。
- 使用 transform 代替 layout 变化。
- 减少阴影和滤镜的实时变化。

### 16.2 AI 返回格式不稳定

应对方式：

- 在 Prompt 中强制要求 JSON。
- 后端校验 `past`、`present`、`future`、`summary` 四个非空字符串字段。
- 后端区分配置、认证、余额、限流、超时、上游服务和格式错误。
- 前端显示中文错误并允许手动重试，不自动重复请求。

### 16.3 牌面资源授权与整理风险

应对方式：

- 优先使用明确标注 Public Domain 的 Rider-Waite-Smith 资源。
- 采用同一来源的完整 78 张图片，避免混用不同版本。
- 统一转换为 WebP 并按项目 `id` 命名。
- 前端提供图片缺失兜底样式，避免单张素材缺失导致页面崩溃。

### 16.4 DEMO 视觉过度开发

应对方式：

- 优先完成主流程。
- 视觉细节分阶段增强。
- 不在第一阶段实现登录、数据库和复杂后台。

## 17. 最小可行 DEMO 验收标准

当以下条件全部满足时，第一版 DEMO 视为完成：

1. 用户能输入问题并开始仪式。
2. 页面能进入洗牌场景。
3. 用户能用鼠标扰动牌堆。
4. 卡牌能收束为底部弧形牌带。
5. 用户能拖拽三张牌到指定位置。
6. 三张牌能逐张翻开。
7. 系统能展示三段解读和总结。
8. 用户能保存命运手记。
9. 刷新页面后仍能读取历史记录。
10. 整体视觉符合深色古籍女巫桌面方向。
