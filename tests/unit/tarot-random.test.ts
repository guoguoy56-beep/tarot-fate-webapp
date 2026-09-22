import { expect, test } from "vitest";

import { tarotCards } from "@/data/tarotCards";
import { randomOrientation, shuffleDeck } from "@/lib/tarot-random";

function sequenceRandom(values: readonly number[]) {
  let index = 0;

  return () => {
    expect(index).toBeLessThan(values.length);
    const value = values[index];
    index += 1;
    return value;
  };
}

function seededRandom(seed: number) {
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(1_664_525, state) + 1_013_904_223) >>> 0;
    return state / 2 ** 32;
  };
}

test("Fisher-Yates follows deterministic swap indexes and preserves its input", () => {
  const source = Object.freeze(["fool", "magician", "priestess", "empress"]);
  const shuffled = shuffleDeck(source, sequenceRandom([0, 0.5, 0.999]));

  expect(shuffled).toEqual(["empress", "priestess", "magician", "fool"]);
  expect(source).toEqual(["fool", "magician", "priestess", "empress"]);
  expect(shuffled).not.toBe(source);
});

test("repeated seeded shuffles never lose, duplicate, or mutate tarot cards", () => {
  const sourceIds = tarotCards.map((card) => card.id);
  const expectedIds = [...sourceIds].sort();

  for (let seed = 1; seed <= 250; seed += 1) {
    const shuffled = shuffleDeck(tarotCards, seededRandom(seed));
    const shuffledIds = shuffled.map((card) => card.id);

    expect(shuffled).toHaveLength(78);
    expect(new Set(shuffledIds).size).toBe(78);
    expect([...shuffledIds].sort()).toEqual(expectedIds);
  }

  expect(tarotCards.map((card) => card.id)).toEqual(sourceIds);
});

test("orientation keeps the existing greater-than-half boundary", () => {
  expect(randomOrientation(() => 0)).toBe("reversed");
  expect(randomOrientation(() => 0.5)).toBe("reversed");
  expect(randomOrientation(() => 0.500_000_1)).toBe("upright");
  expect(randomOrientation(() => 0.999_999_9)).toBe("upright");
});
