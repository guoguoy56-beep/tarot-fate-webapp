import { expect, test } from "vitest";

import {
  countReadingQuestionCharacters,
  MAX_READING_QUESTION_CHARACTERS,
  MAX_READING_REQUEST_BYTES,
  normalizeReadingQuestion,
} from "@/lib/reading-limits";

test("reading limits retain the API contract", () => {
  expect(MAX_READING_QUESTION_CHARACTERS).toBe(500);
  expect(MAX_READING_REQUEST_BYTES).toBe(4096);
});

test("normalizeReadingQuestion trims edges and normalizes line endings", () => {
  expect(normalizeReadingQuestion("  第一行\r\n第二行\r第三行  ")).toBe("第一行\n第二行\n第三行");
});

test("question character counting treats a Unicode code point as one character", () => {
  expect(countReadingQuestionCharacters("命运🔮牌")).toBe(4);
});
