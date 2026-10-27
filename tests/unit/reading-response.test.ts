import { expect, test } from "vitest";

import { getReadingApiError, isReadingResponse } from "@/lib/reading-response";
import type { ReadingApiErrorCode } from "@/types/reading";

import { createReadingApiError, createReadingResponse } from "../fixtures/reading";

test("accepts a complete non-empty reading response", () => {
  expect(
    isReadingResponse({
      ...createReadingResponse(),
      ignored: true,
    }),
  ).toBe(true);
});

test.each([
  null,
  [],
  {},
  { past: "过去", present: "现在", future: "未来" },
  { past: "过去", present: " ", future: "未来", summary: "总结" },
  { past: "过去", present: "现在", future: 1, summary: "总结" },
])("rejects an invalid reading response", (value) => {
  expect(isReadingResponse(value)).toBe(false);
});

const apiErrorCodes = [
  "INVALID_REQUEST",
  "QUESTION_TOO_LONG",
  "REQUEST_TOO_LARGE",
  "INVALID_CARD_COUNT",
  "INVALID_CARD_ID",
  "UNKNOWN_CARD",
  "INVALID_CARD_POSITION",
  "DUPLICATE_CARD_POSITION",
  "INVALID_CARD_ORIENTATION",
  "DUPLICATE_CARD",
  "DEEPSEEK_DISABLED",
  "DEEPSEEK_NOT_CONFIGURED",
  "DEEPSEEK_AUTH_FAILED",
  "DEEPSEEK_INSUFFICIENT_BALANCE",
  "DEEPSEEK_RATE_LIMITED",
  "DEEPSEEK_TIMEOUT",
  "DEEPSEEK_UPSTREAM_ERROR",
  "DEEPSEEK_INVALID_RESPONSE",
  "INTERNAL_ERROR",
] satisfies ReadingApiErrorCode[];

test.each(apiErrorCodes)("accepts the known API error code %s", (code) => {
  expect(getReadingApiError(createReadingApiError(code, true))).toEqual({
    code,
    message: "这是明确标注的测试错误。",
    retryable: true,
  });
});

test.each([
  null,
  {},
  { error: null },
  { error: { code: "UNKNOWN_CODE", message: "错误", retryable: true } },
  { error: { code: "INTERNAL_ERROR", message: " ", retryable: true } },
  { error: { code: "INTERNAL_ERROR", message: "错误", retryable: "yes" } },
])("rejects a malformed API error", (value) => {
  expect(getReadingApiError(value)).toBeNull();
});
