import { describe, expect, it } from "vitest";
import { cosmicSpreads, isRingDrag, nearestRotation, selectOrbitalCard } from "@/lib/cosmic-experience";

describe("cosmic spread and orbital selection", () => {
  it("supports all eight spreads with their semantic positions", () => {
    expect(cosmicSpreads.map((spread) => spread.slots.length)).toEqual([1, 1, 3, 3, 5, 5, 4, 4]);
    expect(new Set(cosmicSpreads.map((spread) => spread.id)).size).toBe(8);
    expect(cosmicSpreads.find((spread) => spread.id === "timeline")?.slots).toEqual(["过去", "现在", "未来"]);
  });
  it("preserves identity, anchor, orientation and selection order while enforcing capacity", () => {
    const first = { anchor: 47, cardId: "fool", orientation: "reversed" as const };
    const second = { anchor: 2, cardId: "sun", orientation: "upright" as const };
    const input = Object.freeze([Object.freeze(first)]);
    const selected = selectOrbitalCard(input, second, 2);
    expect(selected).toEqual([first, second]);
    expect(input).toEqual([first]);
    expect(selectOrbitalCard(selected, first, 3)).toEqual(selected);
    expect(selectOrbitalCard(selected, { ...first, anchor: 10 }, 3)).toEqual(selected);
    expect(selectOrbitalCard(selected, { anchor: 8, cardId: "moon", orientation: "upright" }, 2)).toEqual(selected);
  });
  it("rotates the existing anchor to the foreground without long jumps", () => {
    for (const anchor of [0, 2, 47, 77]) {
      const initial = 23.5;
      const angle = nearestRotation(initial, anchor, 78);
      expect(Math.abs(angle - initial)).toBeLessThanOrEqual(Math.PI);
      const projected = angle + anchor / 78 * Math.PI * 2;
      expect(Math.sin(projected)).toBeCloseTo(Math.sin(2));
      expect(Math.cos(projected)).toBeCloseTo(Math.cos(2));
    }
  });
  it("separates small click movement from a deliberate drag in either axis", () => {
    expect(isRingDrag({ x: 10, y: 10 }, { x: 13, y: 14 })).toBe(false);
    expect(isRingDrag({ x: 10, y: 10 }, { x: 18, y: 10 })).toBe(true);
    expect(isRingDrag({ x: 10, y: 10 }, { x: 10, y: 2 })).toBe(true);
  });
});
