import { expect, test } from "vitest";

import { tarotCards } from "@/data/tarotCards";
import { drawRandomDeck, orientationLabel, positionLabel } from "@/lib/tarot";

function seededRandom(seed: number) {
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(1_664_525, state) + 1_013_904_223) >>> 0;
    return state / 2 ** 32;
  };
}

test("drawRandomDeck returns every production card without mutating the source", () => {
  const sourceIds = tarotCards.map((card) => card.id);
  const deck = drawRandomDeck(seededRandom(42));

  expect(deck).toHaveLength(78);
  expect(new Set(deck.map((card) => card.id))).toEqual(new Set(sourceIds));
  expect(tarotCards.map((card) => card.id)).toEqual(sourceIds);
  expect(deck).not.toBe(tarotCards);
});

test("positionLabel maps known positions and preserves unknown labels", () => {
  expect(positionLabel("past")).toBe("过去");
  expect(positionLabel("present")).toBe("现在");
  expect(positionLabel("future")).toBe("未来");
  expect(positionLabel("custom")).toBe("custom");
});

test("orientationLabel maps both supported orientations", () => {
  expect(orientationLabel("upright")).toBe("正位");
  expect(orientationLabel("reversed")).toBe("逆位");
});
