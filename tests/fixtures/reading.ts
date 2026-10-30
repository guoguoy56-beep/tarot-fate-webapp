import type { ReadingApiError, ReadingApiErrorCode, ReadingRequest, ReadingResponse } from "../../src/types/reading";

// Framework-neutral fixtures: never import a runner, production validator or live client here.
export function createReadingRequest(question = "自动测试：我该如何面对接下来的变化？"): ReadingRequest {
  return {
    question,
    cards: [
      { cardId: "fool", position: "past", orientation: "upright" },
      { cardId: "magician", position: "present", orientation: "reversed" },
      { cardId: "high-priestess", position: "future", orientation: "upright" },
    ],
  };
}

export function createReadingResponse(overrides: Partial<ReadingResponse> = {}): ReadingResponse {
  return {
    past: "这是明确标注的自动测试模拟解读：回看过去，桌上的旧牌提醒你整理已经走过的路。请辨认那些真实发生的选择、付出的努力和获得的支持，再区分尚未证实的担忧。你可以写下一个曾经帮助自己的习惯，观察它今天是否仍然适用。这里的文字只用于检查页面阅读、保存与刷新流程，不代表真实模型的判断，也不能预测接下来的结果。",
    present: "这是明确标注的自动测试模拟解读：关注现在，先让纷乱的问题落在纸上，再从中挑出一件能够实践的小事。你可以确认手边的时间与资源，向信任的人说明自己的需求，并为行动安排清楚的边界。不要把眼前的犹豫当成已经注定的答案，保留核对事实与调整计划的空间。这段模拟内容仅用于验证测试流程，不构成专业建议或真实预言。",
    future: "这是明确标注的自动测试模拟解读：面向未来，把尚未发生的事情看作几种可以讨论的可能，而不是写好的结局。请为下一步准备一个温和而具体的行动，也想一想遇到变化时可以向谁寻求帮助。待新的事实出现，再检查原有判断是否需要修改。此处的牌意与措辞是合成测试内容，只服务于界面和数据校验，不能代替你的选择或专业人士的意见。",
    summary: "本地模拟解读仅用于自动测试，不代表真实人工智能输出。请把文字当作检查页面与记录功能的合成样例，现实中的决定仍需核对事实、结合自身处境，并在必要时寻求合格专业人士的帮助。",
    ...overrides,
  };
}

export function createReadingApiError(code: ReadingApiErrorCode, retryable = false): ReadingApiError {
  return { error: { code, message: "这是明确标注的测试错误。", retryable } };
}
