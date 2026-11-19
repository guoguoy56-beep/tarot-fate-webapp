import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { cosmicSpaceCamera, type SpaceCameraBlend } from "@/lib/cosmic-space-camera";
import { skyDirection, skyNebulae, starCloudRegions, starMiniClusters } from "@/lib/cosmic-sky-catalog";
import { createCosmicStarfield } from "@/lib/cosmic-starfield";

const skyPoints = () => [
  ...starCloudRegions.map((item) => item.at),
  ...starMiniClusters,
  ...skyNebulae.map((item) => item.at),
].map(([bearing, elevation]) => skyDirection(bearing, elevation));

/** Objects whose centre lies inside the frustum, with the same rotation-only view the far sky layer uses. */
function visibleCount(blend: SpaceCameraBlend) {
  const pose = cosmicSpaceCamera(blend);
  const camera = new PerspectiveCamera(pose.fov, 16 / 9, 0.1, 1000);
  camera.lookAt(new Vector3(...pose.target).sub(new Vector3(...pose.position)));
  camera.updateMatrixWorld();
  return skyPoints().filter((direction) => {
    const point = direction.clone().multiplyScalar(500).project(camera);
    return point.z < 1 && Math.abs(point.x) < 0.95 && Math.abs(point.y) < 0.95;
  }).length;
}

describe("sky catalog coverage", () => {
  it("keeps unit directions", () => {
    for (const direction of skyPoints()) expect(direction.length()).toBeCloseTo(1, 6);
  });

  it("shows multiple star clusters and nurseries in every settled stage", () => {
    const stages: [string, SpaceCameraBlend][] = [
      ["home", { ring: 0, reading: 0, summary: 0 }],
      ["ring", { ring: 1, reading: 0, summary: 0, dive: 1 }],
      ["reading", { ring: 1, reading: 1, summary: 0, dive: 1 }],
      ["summary", { ring: 1, reading: 1, summary: 1, dive: 1 }],
    ];
    for (const [name, blend] of stages) expect(visibleCount(blend), name).toBeGreaterThanOrEqual(3);
  });

  it("keeps star clusters in view throughout the outbound turn and the dive", () => {
    const samples: SpaceCameraBlend[] = [
      { ring: 0, reading: 0, summary: 0, reverse: 0.5 },
      { ring: 0, reading: 0, summary: 0, reverse: 1 },
      ...Array.from({ length: 11 }, (_, index) => ({ ring: 0, reading: 0, summary: 0, dive: Math.min(index / 10, 0.999) })),
    ];
    for (const blend of samples) expect(visibleCount(blend), JSON.stringify(blend)).toBeGreaterThanOrEqual(2);
  });

  it("twinkles only a subset of distant small stars while keeping near and large stars steady", () => {
    const stars = createCosmicStarfield(1);
    const size = stars.geometry.getAttribute("size");
    const parallax = stars.geometry.getAttribute("parallax");
    const phase = stars.geometry.getAttribute("phase");
    let distantSmallTwinkling = 0;
    let distantSmallSteady = 0;

    for (let i = 0; i < size.count; i++) {
      const s = size.getX(i);
      const p = parallax.getX(i);
      const depth = phase.getZ(i);
      if (p > 0.5 || s >= 3.6) {
        expect(depth).toBe(0);
      } else if (depth > 0) {
        expect(depth).toBeGreaterThanOrEqual(0.82);
        distantSmallTwinkling++;
      } else {
        distantSmallSteady++;
      }
    }

    expect(distantSmallTwinkling).toBeGreaterThan(1500);
    expect(distantSmallSteady).toBeGreaterThan(1000);
  });
});
