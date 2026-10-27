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
    past: "这是明确标注的测试解读：回顾过去，辨认你已经积累的经验。",
    present: "这是明确标注的测试解读：关注现在，选择一项可以实践的小行动。",
    future: "这是明确标注的测试解读：面向未来，保留调整方向的空间。",
    summary: "本地模拟解读仅用于自动测试，不代表真实 AI 输出。",
    ...overrides,
  };
}

export function createReadingApiError(code: ReadingApiErrorCode, retryable = false): ReadingApiError {
  return { error: { code, message: "这是明确标注的测试错误。", retryable } };
}
