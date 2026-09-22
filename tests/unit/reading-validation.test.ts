import { expect, test } from "vitest";

import { tarotCardMap } from "@/data/tarotCards";
import { validateReadingRequest } from "@/lib/reading-validation";
import type { ReadingRequestErrorCode } from "@/types/reading";

const validCards = [
  { cardId: "fool", position: "past", orientation: "upright" },
  { cardId: "magician", position: "present", orientation: "reversed" },
  { cardId: "high-priestess", position: "future", orientation: "upright" },
] as const;

function createValidRequest() {
  return {
    question: "  我该如何面对变化？\r\n请给我提示。  ",
    cards: validCards.map((card) => ({ ...card })),
  };
}

test("valid requests are normalized and rebuilt from trusted card data", () => {
  const request = createValidRequest();
  const value = {
    ...request,
    cards: request.cards.map((card) => ({ ...card, nameCn: "伪造牌名", meaning: "伪造牌义" })),
  };
  const result = validateReadingRequest(value);

  expect(result.success).toBe(true);
  if (!result.success) {
    throw new Error("expected a valid reading request");
  }

  expect(result.data.question).toBe("我该如何面对变化？\n请给我提示。");
  expect(result.data.cards).toHaveLength(3);
  expect(result.data.cards[0]).toEqual({
    cardId: "fool",
    position: "past",
    orientation: "upright",
    nameCn: tarotCardMap.get("fool")?.nameCn,
    nameEn: tarotCardMap.get("fool")?.nameEn,
    uprightKeywords: tarotCardMap.get("fool")?.uprightKeywords,
    reversedKeywords: tarotCardMap.get("fool")?.reversedKeywords,
    meaning: tarotCardMap.get("fool")?.meaning,
  });
  expect(result.data.cards[0].nameCn).not.toBe("伪造牌名");
  expect(result.data.cards[0].meaning).not.toBe("伪造牌义");
});

const invalidRequests: Array<[string, unknown, ReadingRequestErrorCode]> = [
  ["non-object request", null, "INVALID_REQUEST"],
  ["non-string question", { ...createValidRequest(), question: 42 }, "INVALID_REQUEST"],
  ["blank question", { ...createValidRequest(), question: " \r\n " }, "INVALID_REQUEST"],
  ["question over 500 Unicode characters", { ...createValidRequest(), question: "🔮".repeat(501) }, "QUESTION_TOO_LONG"],
  ["non-array cards", { ...createValidRequest(), cards: {} }, "INVALID_REQUEST"],
  ["wrong card count", { ...createValidRequest(), cards: validCards.slice(0, 2) }, "INVALID_CARD_COUNT"],
  ["non-object card", { ...createValidRequest(), cards: [null, ...validCards.slice(1)] }, "INVALID_REQUEST"],
  [
    "invalid card id type",
    { ...createValidRequest(), cards: [{ ...validCards[0], cardId: 7 }, ...validCards.slice(1)] },
    "INVALID_CARD_ID",
  ],
  [
    "unknown card",
    { ...createValidRequest(), cards: [{ ...validCards[0], cardId: "unknown" }, ...validCards.slice(1)] },
    "UNKNOWN_CARD",
  ],
  [
    "invalid position",
    { ...createValidRequest(), cards: [{ ...validCards[0], position: "center" }, ...validCards.slice(1)] },
    "INVALID_CARD_POSITION",
  ],
  [
    "duplicate position",
    {
      ...createValidRequest(),
      cards: [validCards[0], { ...validCards[1], position: "past" }, validCards[2]],
    },
    "DUPLICATE_CARD_POSITION",
  ],
  [
    "invalid orientation",
    { ...createValidRequest(), cards: [{ ...validCards[0], orientation: "sideways" }, ...validCards.slice(1)] },
    "INVALID_CARD_ORIENTATION",
  ],
  [
    "duplicate card",
    {
      ...createValidRequest(),
      cards: [validCards[0], { ...validCards[1], cardId: "fool" }, validCards[2]],
    },
    "DUPLICATE_CARD",
  ],
];

test.each(invalidRequests)("maps %s to the expected error code", (_name, value, expectedCode) => {
  const result = validateReadingRequest(value);

  expect(result.success).toBe(false);
  if (result.success) {
    throw new Error("expected an invalid reading request");
  }
  expect(result.error.code).toBe(expectedCode);
  expect(result.error.message.trim()).not.toBe("");
});
