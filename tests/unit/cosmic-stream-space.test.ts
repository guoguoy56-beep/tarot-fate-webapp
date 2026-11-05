import { describe, expect, it } from "vitest";
import { BoxGeometry, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry, Raycaster, Vector3 } from "three";
import { cameraTravelProgress, cosmicSpaceCamera, questionCamera, reverseCameraDurationMs } from "@/lib/cosmic-space-camera";
import { createDoubleSidedCard, spatialStream, spatialStreamPose } from "@/lib/cosmic-stream-space";

describe("double-sided stream and reverse camera", () => {
  it("reveals the opposite actual mesh without rotating or replacing the card", () => {
    const geometry = new PlaneGeometry(1, 116 / 68), edge = new BoxGeometry(1, 116 / 68, 0.02);
    const materials = [new MeshBasicMaterial(), new MeshBasicMaterial(), new MeshBasicMaterial()];
    const card = createDoubleSidedCard(geometry, edge, materials[0], materials[1], materials[2]);
    card.updateMatrixWorld(true);
    const before = card.matrixWorld.clone();
    const hit = (z: number) => new Raycaster(new Vector3(0, 0, z), new Vector3(0, 0, -Math.sign(z))).intersectObject(card)[0].object;
    expect(hit(5).name).toBe("back");
    expect(hit(-5).name).toBe("front");
    card.children[2].rotation.z = Math.PI; card.updateMatrixWorld(true);
    expect(hit(-5).name).toBe("front");
    expect(card.matrixWorld).toEqual(before);
    geometry.dispose(); edge.dispose(); materials.forEach((material) => material.dispose());
  });

  it("moves diagonally down while looking right into a stable overhead reverse shot", () => {
    let previousYaw = 0, previousY = 0;
    for (let ms = 0; ms <= reverseCameraDurationMs; ms += 30) {
      const reverse = cameraTravelProgress(ms), pose = cosmicSpaceCamera({ ring: 0, reading: 0, summary: 0, reverse });
      const direction = new Vector3(...pose.target).sub(new Vector3(...pose.position)).normalize();
      const yaw = Math.atan2(direction.x, -direction.z);
      expect(yaw).toBeGreaterThanOrEqual(previousYaw - 1e-8);
      expect(pose.position[1]).toBeLessThanOrEqual(previousY);
      expect(direction.y).toBeLessThanOrEqual(0);
      previousYaw = yaw; previousY = pose.position[1];
    }
    expect(previousYaw * 180 / Math.PI).toBeGreaterThan(145);
    expect(cameraTravelProgress(-1)).toBe(0); expect(cameraTravelProgress(5000)).toBe(1);
    expect(cameraTravelProgress(30)).toBeLessThan(0.00001);
    expect(1 - cameraTravelProgress(reverseCameraDurationMs - 30)).toBeLessThan(0.00001);
    const end = cosmicSpaceCamera({ ring: 0, reading: 0, summary: 0, reverse: 1 });
    expect(end.position).toEqual(questionCamera.position);
    const direction = new Vector3(...end.target).sub(new Vector3(...end.position)).normalize();
    expect(direction.distanceTo(new Vector3(...questionCamera.target).sub(new Vector3(...questionCamera.position)).normalize())).toBeLessThan(1e-9);
  });

  it("circulates all 78 identities on one continuous world path through every join", () => {
    for (const slot of [0, 36, 39, 75, 78]) {
      const time = slot / 78 * spatialStream.durationMs;
      const before = spatialStreamPose(0, time - 0.01, 1920, 1080), after = spatialStreamPose(0, time + 0.01, 1920, 1080);
      expect(before.position.distanceTo(after.position)).toBeLessThan(0.001);
      expect(Math.abs(before.size - after.size)).toBeLessThan(0.0001);
    }
    for (let index = 0; index < 78; index++) {
      const start = spatialStreamPose(index, 12345, 1920, 1080);
      expect(spatialStreamPose(index, 12345 + spatialStream.durationMs, 1920, 1080).position.distanceTo(start.position)).toBeLessThan(1e-8);
    }
  });

  it("keeps the home backs and question fronts in view at both desktop sizes", () => {
    for (const [width, height] of [[1920, 1080], [1280, 720]]) for (const reverse of [0, 1]) {
      const pose = cosmicSpaceCamera({ ring: 0, reading: 0, summary: 0, reverse });
      const camera = new PerspectiveCamera(pose.fov, width / height, 0.1, 300);
      camera.position.set(...pose.position); camera.lookAt(...pose.target); camera.updateMatrixWorld();
      for (let ms = 0; ms < spatialStream.durationMs; ms += 5000) {
        const visible = Array.from({ length: 78 }, (_, index) => spatialStreamPose(index, ms, width, height)).filter(({ position }) => {
          const screen = position.clone().project(camera);
          return position.clone().applyMatrix4(camera.matrixWorldInverse).z < 0 && Math.abs(screen.x) < 1 && Math.abs(screen.y) < 1;
        });
        expect(visible.length).toBeGreaterThan(20);
        expect(visible.every(({ position }) => reverse ? position.z > camera.position.z : position.z < camera.position.z)).toBe(true);
      }
    }
  });

  it("keeps the connecting bends out of the central foreground in both views", () => {
    for (const reverse of [0, 1]) {
      const pose = cosmicSpaceCamera({ ring: 0, reading: 0, summary: 0, reverse });
      const camera = new PerspectiveCamera(50, 16 / 9, 0.1, 300);
      camera.position.set(...pose.position); camera.lookAt(...pose.target); camera.updateMatrixWorld();
      for (const start of [36, 75]) for (let step = 0; step < 300; step++) {
        const card = spatialStreamPose(0, (start + step / 100) / 78 * spatialStream.durationMs, 1920, 1080);
        const screen = card.position.clone().project(camera), depth = -card.position.clone().applyMatrix4(camera.matrixWorldInverse).z;
        if (depth > 0 && Math.abs(screen.x) < 0.95 && Math.abs(screen.y) < 0.95) {
          expect(card.size * 116 / 68 / (2 * Math.tan(25 * Math.PI / 180) * depth), `bend ${start + step / 100}, view ${reverse}`).toBeLessThan(0.09);
        }
      }
    }
  });
});
