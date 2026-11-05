import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Scene, Vector3 } from "three";
import { homeCardStream, homeStreamPose } from "@/lib/cosmic-experience";
import { homeStreamWorldPose } from "@/lib/cosmic-home-space";
import { CosmicRingSpace } from "@/lib/cosmic-ring-space";
import { cosmicSpaceCamera, type SpaceCameraBlend } from "@/lib/cosmic-space-camera";

function setCamera(camera: PerspectiveCamera, blend: SpaceCameraBlend) {
  const pose = cosmicSpaceCamera(blend);
  camera.position.set(...pose.position); camera.lookAt(...pose.target); camera.fov = pose.fov;
  camera.updateProjectionMatrix(); camera.updateMatrixWorld();
}
const home = { ring: 0, reading: 0, summary: 0 };

describe("home stream in the continuous 3D scene", () => {
  it("retains the approved S path, pixel emergence and foreground sizes throughout a complete loop", () => {
    for (const [width, height] of [[1920, 1080], [1280, 720], [1159, 668]]) {
      const camera = new PerspectiveCamera(50, width / height, 0.1, 300);
      setCamera(camera, home);
      for (let time = 0; time <= homeCardStream.durationMs; time += 7000) {
        for (let index = 0; index < homeCardStream.count; index++) {
          const pose = homeStreamPose(index, time, width / height);
          const world = homeStreamWorldPose(pose, width, height);
          const distance = -world.position.clone().applyMatrix4(camera.matrixWorldInverse).z;
          const projected = world.position.clone().project(camera);
          expect((projected.x + 1) / 2).toBeCloseTo(pose.x, 10);
          expect((1 - projected.y) / 2).toBeCloseTo(pose.y, 10);
          const scale = height / (2 * Math.tan(camera.fov * Math.PI / 360)) * world.size / distance;
          expect(scale).toBeCloseTo(pose.scale * Math.min(width / 1440, height / 900), 10);
          expect(distance).toBeGreaterThan(5.9);
        }
      }
    }
  });

  it("starts at the nebula and travels toward the viewer in world space", () => {
    const poses = Array.from({ length: 100 }, (_, step) => homeStreamWorldPose(homeStreamPose(0, step / 100 * homeCardStream.durationMs), 1920, 1080));
    expect(poses[0].position.z).toBe(-36);
    expect(poses.at(-1)!.position.z).toBeGreaterThan(15);
    for (let index = 1; index < poses.length; index++) expect(poses[index].position.z).toBeGreaterThan(poses[index - 1].position.z);
  });

  it("produces real camera parallax without moving the calibrated path with the camera", () => {
    const camera = new PerspectiveCamera(50, 16 / 9, 0.1, 300);
    setCamera(camera, home);
    const far = homeStreamWorldPose(homeStreamPose(0, 0), 1920, 1080).position;
    const near = homeStreamWorldPose(homeStreamPose(35, 0), 1920, 1080).position;
    const before = [far.clone().project(camera), near.clone().project(camera)];
    camera.position.x += 0.5; camera.updateMatrixWorld();
    const after = [far.clone().project(camera), near.clone().project(camera)];
    expect(Math.abs(after[1].x - before[1].x)).toBeGreaterThan(Math.abs(after[0].x - before[0].x) * 4);
    expect(homeStreamWorldPose(homeStreamPose(35, 0), 1920, 1080).position).toEqual(near);
  });

  it("gathers the same 78 anchors between world endpoints before projecting them", () => {
    const camera = new PerspectiveCamera(50, 16 / 9, 0.1, 300), ring = new CosmicRingSpace(camera, new Scene());
    const poses = Array.from({ length: 36 }, (_, index) => homeStreamPose(index, 62000, 16 / 9));
    const nodes = [...ring.anchors];
    setCamera(camera, { ...home, ring: 1 });
    ring.layout({ ...home, ring: 1 }, 1920, 1080, -0.4, poses);
    const ends = ring.anchors.map((node) => node.getWorldPosition(new Vector3()));
    for (let step = 0; step <= 100; step++) {
      const blend = { ...home, ring: step / 100 };
      setCamera(camera, blend);
      const cards = ring.layout(blend, 1920, 1080, -0.4, poses);
      ring.anchors.forEach((node, index) => {
        const start = homeStreamWorldPose(poses[index % 36], 1920, 1080).position;
        expect(node.getWorldPosition(new Vector3()).distanceTo(start.lerp(ends[index], blend.ring))).toBeLessThan(1e-9);
        expect(cards[index].depth).toBeLessThan(-5);
        expect(Object.values(cards[index]).every(Number.isFinite)).toBe(true);
      });
    }
    expect(ring.anchors).toEqual(nodes);
  });

  it("returns to the identical home pose after reading and summary without replacing anchors", () => {
    const camera = new PerspectiveCamera(50, 16 / 9, 0.1, 300), ring = new CosmicRingSpace(camera, new Scene());
    const poses = Array.from({ length: 36 }, (_, index) => homeStreamPose(index, 24000, 16 / 9));
    setCamera(camera, home);
    const before = ring.layout(home, 1920, 1080, -0.4, poses).map((p) => ({ ...p }));
    const summary = { ring: 1, reading: 1, summary: 1 };
    setCamera(camera, summary); ring.layout(summary, 1920, 1080, 2, poses);
    setCamera(camera, home);
    expect(ring.layout(home, 1920, 1080, 2, poses)).toEqual(before);
  });

  it("keeps card projection continuous and in front of the camera while returning from reading or summary", () => {
    const camera = new PerspectiveCamera(50, 16 / 9, 0.1, 300), ring = new CosmicRingSpace(camera, new Scene());
    const poses = Array.from({ length: 36 }, (_, index) => homeStreamPose(index, 81000, 16 / 9));
    for (const hasSummary of [false, true]) {
      let previous: Array<{ x: number; y: number }> | undefined;
      for (let step = 100; step >= 0; step--) {
        const t = step / 100, blend = { ring: t, reading: t, summary: hasSummary ? t : 0 };
        setCamera(camera, blend);
        const cards = ring.layout(blend, 1920, 1080, 2, poses);
        cards.forEach((card, index) => {
          expect(Object.values(card).every(Number.isFinite)).toBe(true);
          expect(card.depth).toBeLessThan(-1);
          if (previous) expect(Math.hypot(card.x - previous[index].x, card.y - previous[index].y)).toBeLessThan(160);
        });
        previous = cards.map(({ x, y }) => ({ x, y }));
      }
    }
  });
});
