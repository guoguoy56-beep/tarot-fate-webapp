import { describe, expect, it } from "vitest";
import { Matrix4, PerspectiveCamera, Scene, Vector3, Vector4 } from "three";
import { cardBackClipMatrix, type CardBackProjection } from "@/lib/cosmic-card-back-projection";
import { CosmicRingEntry, ringEntryMotion } from "@/lib/cosmic-ring-entry";
import { ringHandoffMatrix } from "@/lib/cosmic-ring-handoff";
import { CosmicRingSpace } from "@/lib/cosmic-ring-space";
import { cosmicSpaceCamera } from "@/lib/cosmic-space-camera";

const corners = [[-0.5, 116 / 68 / 2], [0.5, 116 / 68 / 2], [0.5, -116 / 68 / 2], [-0.5, -116 / 68 / 2]];
const pixels = (matrix: Matrix4, width: number, height: number) => corners.map(([x, y]) => {
  const p = new Vector4(x, y, 0, 1).applyMatrix4(matrix);
  return new Vector3((p.x / p.w + 1) * width / 2, (1 - p.y / p.w) * height / 2, 0);
});

function setup(width: number, height: number) {
  const pose = cosmicSpaceCamera({ ring: 1, reading: 0, summary: 0, dive: 1 });
  const camera = new PerspectiveCamera(pose.fov, width / height, 0.1, 1000);
  camera.position.set(...pose.position); camera.lookAt(...pose.target); camera.updateMatrixWorld();
  const ring = new CosmicRingSpace(camera, new Scene()), entry = new CosmicRingEntry(121234);
  const view = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const at = (index: number, time: number) => {
    const state = entry.state(time), card = entry.pose(index, time, width, height);
    const anchor = ring.layout({ ring: 1, reading: 0, summary: 0, dive: 1 }, width, height, state.rotation)[index];
    const cosine = Math.cos(index / 78 * Math.PI * 2 + state.rotation);
    const target: CardBackProjection = { x: anchor.x, y: anchor.y, scale: anchor.scale, yaw: cosine * 20, tilt: cosine * 12, perspective: 900, order: index };
    // Include the actual back surface offset rather than silently comparing the card group's centre plane.
    const source = new Matrix4().compose(card.position, card.quaternion, new Vector3().setScalar(card.size))
      .multiply(new Matrix4().makeTranslation(0, 0, 0.002));
    return { source, target };
  };
  return { camera, ring, view, at };
}

describe("complete ring surface handoff", () => {
  it("preserves every source corner at the start and matches every selectable corner at the end", () => {
    for (const [width, height] of [[1920, 1080], [1480, 711], [1280, 720]]) {
      const { camera, ring, view, at } = setup(width, height);
      for (let index = 0; index < 78; index++) {
        for (const [time, progress] of [[ringEntryMotion.arrivalMs, 0], [ringEntryMotion.durationMs, 1]]) {
          const { source, target } = at(index, time);
          const result = pixels(view.clone().multiply(ringHandoffMatrix(source, target, camera, width, height, progress)), width, height);
          const expected = pixels(progress === 0 ? view.clone().multiply(source) : cardBackClipMatrix(target, width, height), width, height);
          result.forEach((point, corner) => expect(point.distanceTo(expected[corner])).toBeLessThan(1e-7));
        }
      }
      ring.dispose();
    }
  });

  it("joins the live entry and draw motion without changing corner velocity at either seam", () => {
    const width = 1480, height = 711, dt = 0.001;
    const { camera, ring, view, at } = setup(width, height);
    const sample = (index: number, time: number) => {
      const { source, target } = at(index, time);
      if (time < ringEntryMotion.arrivalMs) return pixels(view.clone().multiply(source), width, height);
      if (time > ringEntryMotion.durationMs) return pixels(cardBackClipMatrix(target, width, height), width, height);
      const progress = (time - ringEntryMotion.arrivalMs) / (ringEntryMotion.durationMs - ringEntryMotion.arrivalMs);
      return pixels(view.clone().multiply(ringHandoffMatrix(source, target, camera, width, height, progress)), width, height);
    };
    for (const index of [0, 1, 20, 43, 44, 60, 77]) {
      for (const seam of [ringEntryMotion.arrivalMs, ringEntryMotion.durationMs]) {
        const before = sample(index, seam - dt), middle = sample(index, seam), after = sample(index, seam + dt);
        for (let corner = 0; corner < 4; corner++) {
          const incoming = middle[corner].clone().sub(before[corner]).divideScalar(dt);
          const outgoing = after[corner].clone().sub(middle[corner]).divideScalar(dt);
          expect(incoming.distanceTo(outgoing)).toBeLessThan(1e-5);
        }
      }
    }
    ring.dispose();
  });

  it("keeps intermediate corners finite and does not mutate the live source matrix", () => {
    const width = 1920, height = 1080;
    const { camera, ring, view, at } = setup(width, height);
    for (const progress of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      const time = ringEntryMotion.arrivalMs + (ringEntryMotion.durationMs - ringEntryMotion.arrivalMs) * progress;
      for (let index = 0; index < 78; index++) {
        const { source, target } = at(index, time), original = source.clone();
        const result = view.clone().multiply(ringHandoffMatrix(source, target, camera, width, height, progress));
        expect(source.equals(original)).toBe(true);
        for (const point of pixels(result, width, height)) expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true);
      }
    }
    ring.dispose();
  });
});
