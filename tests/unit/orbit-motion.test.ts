import { describe, expect, it } from "vitest";
import { advanceOrbitMotion, orbitMotion } from "@/lib/cosmic-experience";

describe("continuous orbital velocity", () => {
  it("decelerates from shuffle to idle continuously without stopping or overshooting", () => {
    let speed: number = orbitMotion.shuffleSpeed;
    for (let frame = 0; frame < 180; frame++) {
      const next = advanceOrbitMotion(speed, orbitMotion.idleSpeed, 1000 / 60);
      expect(next.speed).toBeLessThan(speed);
      expect(next.speed).toBeGreaterThan(orbitMotion.idleSpeed);
      expect(next.angle).toBeGreaterThan(next.speed * 1000 / 60);
      expect(next.angle).toBeLessThan(speed * 1000 / 60);
      if (frame === 0) expect(next.speed).toBeGreaterThan(speed * 0.95);
      speed = next.speed;
    }
    expect(speed - orbitMotion.idleSpeed).toBeLessThan(0.00001);
  });
  it("has the same trajectory at different frame rates", () => {
    const advance = (frames: number) => {
      let speed = -0.0015;
      let angle = 0;
      for (let frame = 0; frame < frames; frame++) {
        const next = advanceOrbitMotion(speed, -orbitMotion.idleSpeed, 1500 / frames);
        speed = next.speed;
        angle += next.angle;
      }
      return { speed, angle };
    };
    for (const frames of [15, 45, 90, 180]) {
      expect(advance(frames).speed).toBeCloseTo(advance(1).speed, 12);
      expect(advance(frames).angle).toBeCloseTo(advance(1).angle, 12);
    }
  });
  it.each([-1, 1])("settles a fling in direction %s without reversing", (direction) => {
    let speed = orbitMotion.maxReleaseSpeed * direction;
    for (let frame = 0; frame < 240; frame++) {
      const next = advanceOrbitMotion(speed, orbitMotion.idleSpeed * direction, 1000 / 60);
      expect(next.speed * direction).toBeGreaterThan(orbitMotion.idleSpeed);
      expect(next.angle * direction).toBeGreaterThan(0);
      expect(Math.abs(next.speed)).toBeLessThan(Math.abs(speed));
      speed = next.speed;
    }
    expect(Math.abs(speed - orbitMotion.idleSpeed * direction)).toBeLessThan(0.000005);
  });
  it("maintains constant settled speed", () => {
    const next = advanceOrbitMotion(orbitMotion.idleSpeed, orbitMotion.idleSpeed, 80);
    expect(next.speed).toBe(orbitMotion.idleSpeed);
    expect(next.angle).toBeCloseTo(orbitMotion.idleSpeed * 80, 12);
  });
  it("starts smoothly from rest", () => {
    const next = advanceOrbitMotion(0, orbitMotion.travelSpeed, 16);
    expect(next.speed).toBeGreaterThan(0);
    expect(next.speed).toBeLessThan(orbitMotion.travelSpeed * 0.05);
    expect(next.angle).toBeGreaterThan(0);
    expect(next.angle).toBeLessThan(next.speed * 16);
  });
  it("does not advance at zero or negative elapsed time", () => {
    for (const delta of [0, -16]) expect(advanceOrbitMotion(0.001, orbitMotion.idleSpeed, delta)).toEqual({ speed: 0.001, angle: 0 });
  });
});
