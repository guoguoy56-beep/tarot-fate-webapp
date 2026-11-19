import { describe, expect, it } from "vitest";
import { Matrix4, PerspectiveCamera, Vector4 } from "three";
import { cardBackClipMatrix } from "@/lib/cosmic-card-back-projection";

describe("shared card-back projection", () => {
  it("preserves the native card's center, dimensions and UV direction", () => {
    const matrix = cardBackClipMatrix({ x: 600, y: 400, scale: 1.5, yaw: 0, tilt: 0, perspective: 900, order: 0 }, 1200, 800);
    const pixel = (x: number, y: number) => {
      const p = new Vector4(x, y, 0, 1).applyMatrix4(matrix);
      return [(p.x / p.w + 1) * 600, (1 - p.y / p.w) * 400];
    };
    expect(pixel(0, 0)).toEqual([600, 400]);
    expect(pixel(-0.5, 116 / 68 / 2)[0]).toBeCloseTo(549);
    expect(pixel(-0.5, 116 / 68 / 2)[1]).toBeCloseTo(313);
    expect(pixel(0.5, -116 / 68 / 2)[0]).toBeCloseTo(651);
    expect(pixel(0.5, -116 / 68 / 2)[1]).toBeCloseTo(487);
  });

  it("keeps tilted card pixels fixed when the shared world camera moves", () => {
    const clip = cardBackClipMatrix({ x: 452, y: 630, scale: 0.86, yaw: 20, tilt: -12, perspective: 900, order: 30 }, 1480, 900);
    for (const position of [[0, 0, 24], [150, -80, 42]]) {
      const camera = new PerspectiveCamera(50, 1480 / 900, 0.1, 1000);
      camera.position.set(...position as [number, number, number]); camera.lookAt(0, 0, -36); camera.updateMatrixWorld();
      const world = new Matrix4().multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse).multiply(clip);
      const render = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(world);
      for (const [x, y] of [[-0.5, -0.85], [0.5, 0.85], [0, 0]]) {
        const expected = new Vector4(x, y, 0, 1).applyMatrix4(clip);
        const actual = new Vector4(x, y, 0, 1).applyMatrix4(render);
        expect(actual.x / actual.w).toBeCloseTo(expected.x / expected.w, 10);
        expect(actual.y / actual.w).toBeCloseTo(expected.y / expected.w, 10);
      }
    }
  });
});
