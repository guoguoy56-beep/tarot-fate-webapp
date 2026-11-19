import { describe, expect, it } from "vitest";
import { Matrix4, PerspectiveCamera, Scene, Vector3 } from "three";
import { CosmicRingSpace } from "@/lib/cosmic-ring-space";
import { cosmicSpaceCamera, type SpaceCameraBlend } from "@/lib/cosmic-space-camera";

const draw = { ring: 1, reading: 0, summary: 0 };
function setup(width = 1920, height = 1080) {
  const camera = new PerspectiveCamera(50, width / height, 0.1, 300);
  const scene = new Scene(), ring = new CosmicRingSpace(camera, scene);
  const layout = (blend: SpaceCameraBlend, rotation = 0) => {
    const pose = cosmicSpaceCamera(blend);
    camera.position.set(...pose.position); camera.lookAt(...pose.target); camera.fov = pose.fov;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    return ring.layout(blend, width, height, rotation);
  };
  return { camera, scene, ring, layout };
}

describe("world-space tarot orbit", () => {
  it("retains desktop framing and gives near cards genuine perspective enlargement", () => {
    for (const [w, h] of [[1920, 1080], [1280, 720], [1159, 668]]) {
      const { layout } = setup(w, h), cards = layout(draw);
      expect(Math.min(...cards.map((p) => p.x)) / w).toBeCloseTo(0.095, 2);
      expect(Math.max(...cards.map((p) => p.x)) / w).toBeCloseTo(0.905, 2);
      expect(Math.min(...cards.map((p) => p.y)) / h).toBeCloseTo(0.42, 2);
      expect(Math.max(...cards.map((p) => p.y)) / h).toBeCloseTo(0.78, 2);
      const front = cards.reduce((a, b) => a.depth > b.depth ? a : b);
      const back = cards.reduce((a, b) => a.depth < b.depth ? a : b);
      expect(front.scale).toBeGreaterThan(back.scale * 1.7);
    }
  });

  it("uses the scenery camera to project real scene anchors", () => {
    const { camera, scene, ring, layout } = setup();
    const initial = { ...layout(draw)[0] };
    expect(scene.getObjectByName("tarot-anchor-0")).toBe(ring.anchors[0]);
    const world = ring.anchors[0].getWorldPosition(new Vector3());
    camera.position.x += 0.5; camera.updateMatrixWorld();
    const moved = ring.layout(draw, 1920, 1080, 0)[0];
    expect(world.distanceTo(ring.anchors[0].getWorldPosition(new Vector3()))).toBeLessThan(1e-9);
    expect(Math.abs(moved.x - initial.x)).toBeGreaterThan(10);
    ring.dispose();
    expect(scene.getObjectByName("tarot-orbit")).toBeUndefined();
  });

  it("stays finite, ahead of the camera and continuous through every phase and reverse transition", () => {
    const { layout } = setup();
    let previous: { x: number; y: number }[] | undefined;
    const path = Array.from({ length: 301 }, (_, step) => {
      const t = step / 100;
      return { ring: Math.min(1, t), reading: Math.max(0, Math.min(1, t - 1)), summary: Math.max(0, t - 2) };
    });
    for (const blend of [...path, ...path.toReversed()]) {
      const cards = layout(blend, -0.4);
      cards.forEach((p, index) => {
        expect(Object.values(p).every(Number.isFinite)).toBe(true);
        expect(p.depth).toBeLessThan(-5);
        expect(p.scale).toBeGreaterThan(0.1);
        expect(p.scale).toBeLessThan(2);
        if (previous) expect(Math.hypot(p.x - previous[index].x, p.y - previous[index].y)).toBeLessThan(50);
      });
      previous = cards.map(({ x, y }) => ({ x, y }));
    }
  });

  it("maps drag rays back to the orbit with the same sign across all quadrants and the wrap", () => {
    const { ring, camera, layout } = setup();
    const cards = layout(draw, -0.4).map((p) => ({ ...p }));
    for (const anchor of [0, 19, 38, 58, 77]) {
      const next = (anchor + 1) % 78;
      expect(ring.dragDelta(cards[anchor], cards[next])).toBeCloseTo(2 * Math.PI / 78, 8);
      expect(ring.dragDelta(cards[next], cards[anchor])).toBeCloseTo(-2 * Math.PI / 78, 8);
    }
    const center = ring.group.getWorldPosition(new Vector3()).project(camera);
    const point = { x: (center.x + 1) * 960, y: (1 - center.y) * 540 };
    expect(ring.dragDelta(point, { x: point.x + 0.01, y: point.y + 0.01 })).toBe(0);
  });

  it("preserves anchors and returns exactly to a settled pose after subsequent layouts", () => {
    const { ring, layout } = setup();
    const blend = { ring: 1, reading: 1, summary: 0 };
    const nodes = [...ring.anchors], before = layout(blend, 2).map((p) => ({ ...p }));
    layout({ ring: 1, reading: 1, summary: 1 }, 4);
    expect(layout(blend, 2)).toEqual(before);
    expect(ring.anchors).toEqual(nodes);
    const transform = ring.trackTransform(0);
    const matrix = new Matrix4().fromArray(transform.slice(9, -1).split(",").map(Number));
    for (const anchor of [0, 19, 39, 58]) {
      const angle = anchor / 78 * Math.PI * 2 + 2;
      const projected = new Vector3(500 + Math.cos(angle) * 1000 / 2.55, 500 + Math.sin(angle) * 1000 / 2.55, 0).applyMatrix4(matrix);
      expect(projected.x).toBeCloseTo(before[anchor].x, 8);
      expect(projected.y).toBeCloseTo(before[anchor].y, 8);
    }
  });
});
