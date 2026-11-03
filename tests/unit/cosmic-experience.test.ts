import { describe, expect, it } from "vitest";
import { applyReadingDragResistance, cosmicSpreads, isRingDrag, nearestRotation, readingArrivalPose, readingDragInputForPose, readingDragSensitivity, readingDragThresholds, readingIdleMotion, readingIdlePose, readingPresentationMotion, resumeReadingPose, ringDragDelta, selectOrbitalCard } from "@/lib/cosmic-experience";

describe("reading idle motion and drag", () => {
  const cycle = readingIdleMotion.swayMs + readingIdleMotion.turnMs;
  const delta = (from: number, to: number) => Math.atan2(Math.sin((to - from) * Math.PI / 180), Math.cos((to - from) * Math.PI / 180)) * 180 / Math.PI;
  const speed = (at: number) => delta(readingIdlePose(at - 0.1).yaw, readingIdlePose(at + 0.1).yaw) / 0.0002;
  it("starts turning before arrival and joins the existing moving idle pose", () => {
    const { arrivalMs, idleLeadMs } = readingPresentationMotion;
    expect(readingArrivalPose(0).yaw).toBeCloseTo(0);
    expect(readingArrivalPose(0).pitch).toBe(0);
    expect(readingArrivalPose(arrivalMs - 100).yaw).toBeGreaterThan(readingArrivalPose(arrivalMs - 300).yaw + 2);
    for (const after of [0, 100]) {
      const incoming = readingArrivalPose(arrivalMs + after), idle = readingIdlePose(idleLeadMs + after);
      expect(incoming.yaw).toBeCloseTo(idle.yaw, 8);
      expect(incoming.pitch).toBeCloseTo(idle.pitch, 8);
    }
  });
  it("keeps yaw and pitch velocity continuous as arrival hands over to idle", () => {
    const { arrivalMs, idleLeadMs } = readingPresentationMotion;
    for (const axis of ["yaw", "pitch"] as const) {
      const before = (readingArrivalPose(arrivalMs)[axis] - readingArrivalPose(arrivalMs - 0.1)[axis]) / 0.0001;
      const after = (readingIdlePose(idleLeadMs + 0.1)[axis] - readingIdlePose(idleLeadMs)[axis]) / 0.0001;
      expect(before).toBeGreaterThan(0);
      expect(before).toBeCloseTo(after, 2);
    }
  });
  it("speeds up the display by 30 percent with a 15-degree midpoint pitch", () => {
    expect(readingIdleMotion.swayMs * 1.3).toBeCloseTo(6000);
    expect(readingIdleMotion.turnMs).toBe(1000);
    expect(readingIdlePose(0)).toEqual({ yaw: -24, pitch: 0, turning: false });
    expect(readingIdlePose(readingIdleMotion.swayMs / 2).pitch).toBeCloseTo(15);
    expect(readingIdlePose(readingIdleMotion.swayMs).yaw).toBeCloseTo(24);
    expect(readingIdlePose(cycle)).toEqual(readingIdlePose(0));
  });
  it("accelerates into the turn without a stop or a velocity jump at either seam", () => {
    expect(speed(5800 / 1.3)).toBeGreaterThan(speed(3000 / 1.3) * 3);
    expect(speed(readingIdleMotion.swayMs + 500)).toBeGreaterThan(400);
    for (const seam of [readingIdleMotion.swayMs, cycle]) {
      expect(speed(seam - 0.2)).toBeCloseTo(39, 2);
      expect(speed(seam + 0.2)).toBeCloseTo(39, 2);
    }
  });
  it("keeps the entire cycle moving forward, with no angular snap at the wrap", () => {
    let total = 0;
    for (let index = 1; index <= 700; index++) {
      const step = delta(readingIdlePose((index - 1) * cycle / 700).yaw, readingIdlePose(index * cycle / 700).yaw);
      expect(step).toBeGreaterThan(0);
      expect(readingIdlePose(index * cycle / 700).pitch).toBeLessThanOrEqual(15);
      total += step;
    }
    expect(total).toBeCloseTo(360);
  });
  it("raises drag sensitivity by 60 percent with a soft threshold at 25 degrees in every direction", () => {
    expect(readingDragSensitivity / 0.18).toBeCloseTo(1.6);
    const leftUp = applyReadingDragResistance(-90, 90), rightDown = applyReadingDragResistance(90, -90);
    expect(leftUp.yaw).toBeLessThan(-25);
    expect(leftUp.pitch).toBeGreaterThan(25);
    expect(rightDown.yaw).toBeCloseTo(-leftUp.yaw);
    expect(rightDown.pitch).toBeCloseTo(-leftUp.pitch);
    expect(Math.abs(leftUp.yaw)).toBeLessThan(90);
    expect(applyReadingDragResistance(5, -4)).toEqual({ yaw: 5, pitch: -4 });
    expect(Object.values(readingDragThresholds)).toEqual([25, 25, 25, 25]);
  });
  it("increases resistance continuously without a hard stop or a re-grab jump", () => {
    const angle = (input: number) => applyReadingDragResistance(input, 0).yaw;
    expect((angle(25.001) - angle(25)) / 0.001).toBeCloseTo(1, 3);
    expect(angle(60) - angle(50)).toBeGreaterThan(angle(70) - angle(60));
    expect(angle(1000)).toBeGreaterThan(angle(100));
    expect(angle(100)).toBeGreaterThan(angle(70));
    for (const yaw of [-40, -25, 0, 25, 40]) {
      const input = readingDragInputForPose(yaw, -yaw);
      const pose = applyReadingDragResistance(input.yaw, input.pitch);
      expect(pose.yaw).toBeCloseTo(yaw, 8);
      expect(pose.pitch).toBeCloseTo(-yaw, 8);
    }
  });
  it("preserves the release pose and catches the original timeline even across a turn or loop", () => {
    for (const timeline of [100, readingIdleMotion.swayMs - 100, readingIdleMotion.swayMs + 450, cycle - 50, cycle * 3 + 150]) {
      for (const yaw of [-40, -25, 25, 40]) {
        expect(resumeReadingPose(0, timeline, yaw, -40).yaw).toBe(yaw);
        expect(resumeReadingPose(0, timeline, yaw, -40).pitch).toBe(-40);
        expect(resumeReadingPose(1, timeline, yaw, -40).yaw).toBeCloseTo(yaw, 3);
        for (const elapsed of [readingIdleMotion.returnMs, readingIdleMotion.returnMs + 500]) {
          const resumed = resumeReadingPose(elapsed, timeline, yaw, -40);
          const scheduled = readingIdlePose(timeline + elapsed);
          expect(delta(resumed.yaw, scheduled.yaw)).toBeCloseTo(0, 5);
          expect(resumed.pitch).toBeCloseTo(scheduled.pitch, 5);
        }
      }
    }
  });
});

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
