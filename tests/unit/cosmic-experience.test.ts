import { describe, expect, it } from "vitest";
import { cosmicSpreads, isRingDrag, nearestRotation, ringDragDelta, selectOrbitalCard } from "@/lib/cosmic-experience";

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

describe("projected ring drag direction", () => {
  const ring = { cx: 500, cy: 300, rx: 400, ry: 120 };
  it.each([
    { side: "front, rightward", from: { x: 500, y: 420 }, to: { x: 620, y: 420 }, sign: -1 },
    { side: "back, rightward", from: { x: 500, y: 180 }, to: { x: 620, y: 180 }, sign: 1 },
    { side: "left, downward", from: { x: 100, y: 300 }, to: { x: 100, y: 350 }, sign: -1 },
    { side: "right, downward", from: { x: 900, y: 300 }, to: { x: 900, y: 350 }, sign: 1 },
  ])("follows the pointer at $side", ({ from, to, sign }) => {
    const delta = ringDragDelta(from, to, ring);
    expect(delta * sign).toBeGreaterThan(0);
    expect(ringDragDelta(to, from, ring)).toBeCloseTo(-delta);
    // Rotating the original normalized radial vector must align it with the next pointer.
    const angle = Math.atan2((from.y - ring.cy) / ring.ry, (from.x - ring.cx) / ring.rx) + delta;
    const expected = Math.atan2((to.y - ring.cy) / ring.ry, (to.x - ring.cx) / ring.rx);
    expect(Math.sin(angle)).toBeCloseTo(Math.sin(expected));
    expect(Math.cos(angle)).toBeCloseTo(Math.cos(expected));
  });
  it("crosses the atan2 boundary without jumping almost a full turn", () => {
    const delta = ringDragDelta({ x: 100, y: 301 }, { x: 100, y: 299 }, ring);
    expect(delta).toBeGreaterThan(0);
    expect(delta).toBeLessThan(0.02);
  });
  it("does not rotate for radial movement or a stationary pointer", () => {
    expect(ringDragDelta({ x: 500, y: 420 }, { x: 500, y: 480 }, ring)).toBe(0);
    expect(ringDragDelta({ x: 100, y: 300 }, { x: 100, y: 300 }, ring)).toBe(0);
  });
  it("ignores undefined motion through or inside the center", () => {
    expect(ringDragDelta({ x: 500, y: 300 }, { x: 900, y: 300 }, ring)).toBe(0);
    expect(ringDragDelta({ x: 100, y: 300 }, { x: 900, y: 300 }, ring)).toBe(0);
    expect(ringDragDelta({ x: 500, y: 305 }, { x: 505, y: 300 }, ring)).toBe(0);
    expect(ringDragDelta({ x: 500, y: 300 }, { x: 900, y: 300 }, { ...ring, rx: 0 })).toBe(0);
  });
});
