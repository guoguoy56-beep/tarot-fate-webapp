import { expect, test } from "vitest";

import { getReadingApiError, isReadingResponse } from "@/lib/reading-response";
import type { ReadingApiErrorCode } from "@/types/reading";

import { createReadingApiError, createReadingResponse } from "../fixtures/reading";

test("accepts a complete reading response within the content limits", () => {
  expect(isReadingResponse(createReadingResponse())).toBe(true);
});

test("rejects extra fields even when the required fields are valid", () => {
  expect(isReadingResponse({ ...createReadingResponse(), ignored: true })).toBe(false);
});

test("rejects required fields inherited from a prototype", () => {
  const reading = createReadingResponse();
  const value = Object.assign(Object.create({ summary: reading.summary }), {
    past: reading.past,
    present: reading.present,
    future: reading.future,
  });

  expect(isReadingResponse(value)).toBe(false);
});

test.each([
  ["past", 120],
  ["past", 180],
  ["present", 120],
  ["present", 180],
  ["future", 120],
  ["future", 180],
  ["summary", 60],
  ["summary", 100],
] as const)("accepts %s at its %i-character boundary", (field, length) => {
  const reading = createReadingResponse({ [field]: "测".repeat(length) });

  expect(isReadingResponse(reading)).toBe(true);
});

test.each([
  ["past", 119],
  ["past", 181],
  ["present", 119],
  ["present", 181],
  ["future", 119],
  ["future", 181],
  ["summary", 59],
  ["summary", 101],
] as const)("rejects %s outside its %i-character boundary", (field, length) => {
  const reading = createReadingResponse({ [field]: "测".repeat(length) });

  expect(isReadingResponse(reading)).toBe(false);
});

test("accepts supplementary Unicode characters counted as code points", () => {
  const reading = createReadingResponse({ summary: "🔮".repeat(60) });

  expect(reading.summary).toHaveLength(120);
  expect(isReadingResponse(reading)).toBe(true);
});

test("does not count a surrogate pair twice to meet the minimum", () => {
  const reading = createReadingResponse({ past: "测".repeat(118) + "🔮" });

  expect(reading.past).toHaveLength(120);
  expect(isReadingResponse(reading)).toBe(false);
});

test("ignores surrounding whitespace when checking upper boundaries", () => {
  const reading = createReadingResponse({
    past: ` \t${"测".repeat(180)}\n`,
    present: ` \t${"测".repeat(180)}\n`,
    future: ` \t${"测".repeat(180)}\n`,
    summary: ` \t${"测".repeat(100)}\n`,
  });

  expect(isReadingResponse(reading)).toBe(true);
});

test("does not use surrounding whitespace to reach a lower boundary", () => {
  const reading = createReadingResponse({ past: ` ${"测".repeat(119)} ` });

  expect(isReadingResponse(reading)).toBe(false);
});

test("rejects the short field lengths observed during AI-001", () => {
  const reading = createReadingResponse({
    past: "测".repeat(67),
    present: "测".repeat(87),
    future: "测".repeat(71),
    summary: "测".repeat(59),
  });

  expect(isReadingResponse(reading)).toBe(false);
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
