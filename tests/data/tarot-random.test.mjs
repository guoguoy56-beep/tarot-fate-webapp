import assert from "node:assert/strict";
import test from "node:test";

import { tarotCards } from "../../src/data/tarotCards.ts";
import { randomOrientation, shuffleDeck } from "../../src/lib/tarot-random.ts";

function sequenceRandom(values) {
  let index = 0;

  return () => {
    assert.ok(index < values.length, "the random sequence was exhausted");
    const value = values[index];
    index += 1;
    return value;
  };
}

function seededRandom(seed) {
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(1_664_525, state) + 1_013_904_223) >>> 0;
    return state / 2 ** 32;
  };
}

test("Fisher-Yates follows deterministic swap indexes and preserves its input", () => {
  const source = Object.freeze(["fool", "magician", "priestess", "empress"]);
  const shuffled = shuffleDeck(source, sequenceRandom([0, 0.5, 0.999]));

  assert.deepEqual(shuffled, ["empress", "priestess", "magician", "fool"]);
  assert.deepEqual(source, ["fool", "magician", "priestess", "empress"]);
  assert.notEqual(shuffled, source);
});

test("repeated seeded shuffles never lose, duplicate, or mutate tarot cards", () => {
  const sourceIds = tarotCards.map((card) => card.id);
  const expectedIds = [...sourceIds].sort();

  for (let seed = 1; seed <= 250; seed += 1) {
    const shuffled = shuffleDeck(tarotCards, seededRandom(seed));
    const shuffledIds = shuffled.map((card) => card.id);

    assert.equal(shuffled.length, 78, `seed ${seed} must keep all cards`);
    assert.equal(new Set(shuffledIds).size, 78, `seed ${seed} must not duplicate cards`);
    assert.deepEqual([...shuffledIds].sort(), expectedIds, `seed ${seed} must preserve deck membership`);
  }

  assert.deepEqual(
    tarotCards.map((card) => card.id),
    sourceIds,
    "shuffling must not mutate the production tarotCards array",
  );
});

test("orientation keeps the existing greater-than-half boundary", () => {
  assert.equal(randomOrientation(() => 0), "reversed");
  assert.equal(randomOrientation(() => 0.5), "reversed");
  assert.equal(randomOrientation(() => 0.500_000_1), "upright");
  assert.equal(randomOrientation(() => 0.999_999_9), "upright");
});
