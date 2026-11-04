import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Plane, Raycaster, Vector2, Vector3 } from "three";
import { cosmicPanoramaFrame, cosmicSpaceCamera } from "@/lib/cosmic-space-camera";

describe("continuous space camera", () => {
  it("travels forward into the ring and reading, then pulls back for the summary", () => {
    const home = cosmicSpaceCamera({ ring: 0, reading: 0, summary: 0 });
    const ring = cosmicSpaceCamera({ ring: 1, reading: 0, summary: 0 });
    const reading = cosmicSpaceCamera({ ring: 1, reading: 1, summary: 0 });
    const summary = cosmicSpaceCamera({ ring: 1, reading: 1, summary: 1 });
    expect(home.position[2]).toBeGreaterThan(ring.position[2]);
    expect(ring.position[2]).toBeGreaterThan(reading.position[2]);
    expect(summary.position[2]).toBeGreaterThan(reading.position[2]);
    expect(reading.fov).toBeLessThan(ring.fov);
    expect(summary.fov).toBeGreaterThan(reading.fov);
  });
  it("keeps interrupted blends finite, continuous and in front of the background", () => {
    for (let step = 0; step <= 100; step++) {
      const t = step / 100;
      const first = cosmicSpaceCamera({ ring: t, reading: 1 - t, summary: t * t });
      const next = cosmicSpaceCamera({ ring: t + 0.00001, reading: 1 - t, summary: t * t });
      expect([...first.position, ...first.target, first.fov].every(Number.isFinite)).toBe(true);
      expect(first.position[2]).toBeGreaterThan(first.target[2]);
      expect(first.fov).toBeGreaterThan(30);
      expect(first.fov).toBeLessThan(60);
      expect(new Vector3(...first.position).distanceTo(new Vector3(...next.position))).toBeLessThan(0.001);
    }
  });
  it("projects stronger parallax for near stars than distant stars", () => {
    const project = (ring: number, z: number) => {
      const pose = cosmicSpaceCamera({ ring, reading: 0, summary: 0 });
      const camera = new PerspectiveCamera(pose.fov, 16 / 9, 0.1, 300);
      camera.position.set(...pose.position);
      camera.lookAt(...pose.target);
      camera.updateMatrixWorld();
      return new Vector3(0, 0, z).project(camera);
    };
    const near = project(1, 0).distanceTo(project(0, 0));
    const far = project(1, -28).distanceTo(project(0, -28));
    expect(near).toBeGreaterThan(far * 1.5);
  });
  it("bounds phase inputs when a transition is interrupted at its endpoint", () => {
    expect(cosmicSpaceCamera({ ring: 2, reading: -1, summary: 3 })).toEqual(cosmicSpaceCamera({ ring: 1, reading: 0, summary: 1 }));
  });
  it("keeps the complete desktop viewport inside the image throughout the camera path", () => {
    for (const aspect of [1280 / 720, 1920 / 910, 1159 / 668]) {
      const image = cosmicPanoramaFrame(aspect);
      for (let step = 0; step <= 20; step++) {
        const t = step / 20;
        for (const blend of [{ ring: t, reading: 0, summary: 0 }, { ring: 1, reading: t, summary: 0 }, { ring: 1, reading: 1, summary: t }, { ring: t, reading: t, summary: 0 }, { ring: t, reading: t, summary: t }]) {
          const pose = cosmicSpaceCamera(blend), camera = new PerspectiveCamera(pose.fov, aspect, 0.1, 300);
          camera.position.set(...pose.position); camera.lookAt(...pose.target); camera.updateMatrixWorld();
          for (const x of [-1, 1]) for (const y of [-1, 1]) {
            const ray = new Raycaster();
            ray.setFromCamera(new Vector2(x, y), camera);
            const hit = ray.ray.intersectPlane(new Plane(new Vector3(0, 0, 1), -image.z), new Vector3());
            expect(hit).not.toBeNull();
            expect(Math.abs(hit!.x - image.x)).toBeLessThan(image.width / 2);
            expect(Math.abs(hit!.y - image.y)).toBeLessThan(image.height / 2);
          }
        }
      }
    }
  });
});
