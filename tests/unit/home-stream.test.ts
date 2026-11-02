import { describe, expect, it } from "vitest";
import { homeCardStream, homeStreamPose } from "@/lib/cosmic-experience";

describe("homepage continuous card stream", () => {
  const at = (progress: number) => {
    if (progress === 1) return homeStreamPose(0, homeCardStream.durationMs);
    let low = 0;
    let high: number = homeCardStream.durationMs;
    for (let step = 0; step < 45; step++) {
      const middle = (low + high) / 2;
      if (homeStreamPose(0, middle).progress < progress) low = middle;
      else high = middle;
    }
    return homeStreamPose(0, low);
  };

  it("emerges small and transparent from the distant vortex", () => {
    expect(at(0)).toMatchObject({ x: 0.845, y: 0.155, opacity: 0 });
    expect(at(0).scale * 116).toBeCloseTo(1);
    expect(at(0.05).opacity).toBe(1);
    expect(at(0.05).scale * 116).toBeLessThan(5);
  });

  it("follows the cover-cropped vortex across desktop aspect ratios without moving the exit", () => {
    const standard = homeStreamPose(0, 0, 1920 / 1080);
    const reference = homeStreamPose(0, 0, 1920 / 910);
    const wide = homeStreamPose(0, 0, 2560 / 1080);
    expect(standard.y).toBeGreaterThan(reference.y);
    expect(wide.y).toBeLessThan(reference.y);
    for (const aspect of [1920 / 1080, 1920 / 910, 1159 / 668, 2560 / 1080]) {
      const source = homeStreamPose(0, 0, aspect);
      expect(source.x).toBeGreaterThan(0.8);
      expect(source.x).toBeLessThan(0.9);
      expect(source.y).toBeGreaterThan(0.05);
      expect(source.y).toBeLessThan(0.25);
      const end = homeStreamPose(0, homeCardStream.durationMs - 0.01, aspect);
      expect(end.x).toBeCloseTo(0.99, 5);
      expect(end.y).toBeCloseTo(1.9, 5);
    }
  });

  it("moves downward and grows through two lateral bends, clear of the title", () => {
    let previous = at(0);
    for (let step = 1; step < 1000; step++) {
      const next = at(step / 1000);
      expect(next.y).toBeGreaterThan(previous.y);
      expect(next.scale).toBeGreaterThan(previous.scale);
      expect(next.x).toBeGreaterThan(0.56 - 1e-12);
      previous = next;
    }
    expect(at(0.25).x).toBeLessThan(at(0).x);
    expect(at(0.5).x).toBeGreaterThan(at(0.25).x);
    expect(at(0.75).x).toBeLessThan(at(0.5).x);
    expect(at(0.75).scale).toBeGreaterThan(3.6);
  });

  it.each([0.25, 0.5, 0.75])("passes the bend at %s without a position or speed discontinuity", (progress) => {
    const before = at(progress - 0.00001);
    const middle = at(progress);
    const after = at(progress + 0.00001);
    for (const axis of ["x", "y"] as const) {
      expect(Math.abs(after[axis] - before[axis])).toBeLessThan(0.0001);
      expect((middle[axis] - before[axis]) / 0.00001).toBeCloseTo((after[axis] - middle[axis]) / 0.00001, 3);
    }
  });

  it.each([[1920, 1080], [1280, 720], [1159, 668], [2560, 1080]])(
    "fully exits below a %i×%i screen before reappearing invisibly at the source",
    (width, height) => {
      const end = at(0.999999);
      const angle = end.tilt * Math.PI / 180;
      const halfHeight = (116 * Math.abs(Math.cos(angle)) + 68 * Math.abs(Math.sin(angle)))
        * end.scale * Math.min(width / 1440, height / 900) / 2;
      expect(end.y * height - halfHeight).toBeGreaterThan(height);
      expect(at(1).opacity).toBe(0);
    },
  );

  it("replenishes evenly and repeats without resetting the group together", () => {
    const spacingMs = homeCardStream.durationMs / homeCardStream.count;
    for (let index = 0; index < homeCardStream.count; index++) {
      const initial = homeStreamPose(index, 731);
      for (const cycles of [1, 12]) {
        const repeated = homeStreamPose(index, 731 + cycles * homeCardStream.durationMs);
        for (const key of ["x", "y", "scale", "opacity", "tilt"] as const) expect(repeated[key]).toBeCloseTo(initial[key], 9);
      }
      const following = homeStreamPose((index + 1) % homeCardStream.count, 0);
      const advanced = homeStreamPose(index, spacingMs);
      expect(advanced.x).toBeCloseTo(following.x);
      expect(advanced.y).toBeCloseTo(following.y);
    }
  });

  it("keeps many visible distant cards and fewer, separated foreground cards throughout the loop", () => {
    for (let step = 0; step < 40; step++) {
      const time = homeCardStream.durationMs * step / 40;
      const poses = Array.from({ length: homeCardStream.count }, (_, index) => homeStreamPose(index, time));
      expect(poses.filter((pose) => pose.progress < 0.5 && pose.opacity > 0.9).length).toBeGreaterThanOrEqual(26);
      expect(poses.filter((pose) => pose.progress >= 0.1 && pose.progress < 0.5).length).toBeGreaterThanOrEqual(13);
      expect(poses.filter((pose) => pose.progress >= 0.65 && pose.progress < 0.9).length).toBeLessThanOrEqual(4);
    }
  });

  it("bends toward the right again as the large foreground card leaves below", () => {
    expect(at(0.9).x - at(0.75).x).toBeGreaterThan(0.2);
    expect(at(0.8).x).toBeGreaterThan(at(0.75).x);
    expect(at(0.9).tilt).toBeGreaterThan(30);
  });

  it("turns clockwise gently through the foreground and is still turning when it exits", () => {
    let previous = homeStreamPose(0, 0);
    const interval = homeCardStream.durationMs / 4000;
    for (let step = 1; step < 4000; step++) {
      const next = homeStreamPose(0, step * interval);
      const degreesPerSecond = (next.tilt - previous.tilt) / (interval / 1000);
      expect(Math.abs(degreesPerSecond)).toBeLessThan(8);
      if (previous.progress >= 0.62) expect(degreesPerSecond).toBeGreaterThan(0);
      previous = next;
    }
    expect(previous.tilt).toBeGreaterThan(50);
  });
});
