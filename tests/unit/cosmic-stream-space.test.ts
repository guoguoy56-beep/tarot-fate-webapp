import { describe, expect, it } from "vitest";
import { Euler, MeshBasicMaterial, PerspectiveCamera, Raycaster, Vector3 } from "three";
import { cameraTravelProgress, cosmicSpaceCamera, questionCamera, reverseCameraDurationMs } from "@/lib/cosmic-space-camera";
import { createCardEdgeGeometry, createCardFaceGeometry, createDoubleSidedCard, spatialStream, spatialStreamPose } from "@/lib/cosmic-stream-space";

describe("double-sided stream and reverse camera", () => {
  it("does not put a solid gold surface behind either card image", () => {
    const geometry = createCardEdgeGeometry();
    const normals = geometry.getAttribute("normal"), indices = geometry.getIndex()!;
    // Edge triangles must face sideways, never cover a front/back image when depth precision is low.
    for (const vertex of indices.array) expect(Math.abs(normals.getZ(vertex))).toBe(0);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox!.max.z - geometry.boundingBox!.min.z).toBeLessThan(0.005);
    expect(indices.count).toBeGreaterThan(24);
    geometry.dispose();
  });
  it("reveals the opposite actual mesh without rotating or replacing the card", () => {
    const geometry = createCardFaceGeometry(), edge = createCardEdgeGeometry();
    const materials = [new MeshBasicMaterial(), new MeshBasicMaterial(), new MeshBasicMaterial()];
    const card = createDoubleSidedCard(geometry, edge, materials[0], materials[1], materials[2]);
    card.updateMatrixWorld(true);
    const before = card.matrixWorld.clone();
    const hit = (z: number) => new Raycaster(new Vector3(0, 0, z), new Vector3(0, 0, -Math.sign(z))).intersectObject(card)[0].object;
    expect(hit(5).name).toBe("back");
    expect(hit(-5).name).toBe("front");
    // The clipped corners are real empty space on both sides, not a square backing mesh.
    for (const z of [-5, 5]) for (const x of [-0.49, 0.49]) for (const y of [-0.845, 0.845]) {
      expect(new Raycaster(new Vector3(x, y, z), new Vector3(0, 0, -Math.sign(z))).intersectObject(card)).toHaveLength(0);
    }
    expect(new Raycaster(new Vector3(1, 0, 0), new Vector3(-1, 0, 0)).intersectObject(card)[0].object.name).toBe("edge");
    card.children[2].rotation.z = Math.PI; card.updateMatrixWorld(true);
    expect(hit(-5).name).toBe("front");
    expect(card.matrixWorld).toEqual(before);
    geometry.dispose(); edge.dispose(); materials.forEach((material) => material.dispose());
  });

  it("moves diagonally down while looking right into a stable overhead reverse shot", () => {
    let previousYaw = 0, previousY = 0, previousZ = 24;
    let leftmostX = 0;
    for (let ms = 0; ms <= reverseCameraDurationMs; ms += 30) {
      const reverse = cameraTravelProgress(ms), pose = cosmicSpaceCamera({ ring: 0, reading: 0, summary: 0, reverse });
      const direction = new Vector3(...pose.target).sub(new Vector3(...pose.position)).normalize();
      const yaw = Math.atan2(direction.x, -direction.z);
      expect(yaw).toBeGreaterThanOrEqual(previousYaw - 1e-8);
      expect(pose.position[1]).toBeLessThanOrEqual(previousY);
      expect(pose.position[2]).toBeLessThanOrEqual(previousZ);
      leftmostX = Math.min(leftmostX, pose.position[0]);
      expect(direction.y).toBeLessThanOrEqual(0);
      previousYaw = yaw; previousY = pose.position[1]; previousZ = pose.position[2];
    }
    expect(previousYaw * 180 / Math.PI).toBeGreaterThan(145);
    expect(leftmostX).toBeLessThan(-2);
    expect(cameraTravelProgress(-1)).toBe(0); expect(cameraTravelProgress(5000)).toBe(1);
    expect(cameraTravelProgress(30)).toBeLessThan(0.00001);
    expect(1 - cameraTravelProgress(reverseCameraDurationMs - 30)).toBeLessThan(0.00001);
    const end = cosmicSpaceCamera({ ring: 0, reading: 0, summary: 0, reverse: 1 });
    expect(end.position).toEqual(questionCamera.position);
    const homeView = new PerspectiveCamera(50, 16 / 9);
    homeView.position.set(0, 0, 24); homeView.lookAt(0, 0, -36); homeView.updateMatrixWorld();
    const station = new Vector3(...end.position).project(homeView);
    expect((station.x + 1) / 2).toBeGreaterThan(0.8);
    expect((station.x + 1) / 2).toBeLessThan(0.88);
    expect((1 - station.y) / 2).toBeGreaterThan(0.8);
    expect((1 - station.y) / 2).toBeLessThan(0.9);
    const direction = new Vector3(...end.target).sub(new Vector3(...end.position)).normalize();
    expect(direction.distanceTo(new Vector3(...questionCamera.target).sub(new Vector3(...questionCamera.position)).normalize())).toBeLessThan(1e-9);
  });

  it("circulates all 78 identities on one continuous world path through every join", () => {
    for (const slot of [0, 36, 48, 60, 72, 78]) {
      const time = slot / 78 * spatialStream.durationMs;
      const before = spatialStreamPose(0, time - 0.01, 1920, 1080), after = spatialStreamPose(0, time + 0.01, 1920, 1080);
      expect(before.position.distanceTo(after.position)).toBeLessThan(0.001);
      expect(Math.abs(before.size - after.size)).toBeLessThan(0.0001);
      expect(Math.abs(before.pitch - after.pitch)).toBeLessThan(0.0001);
    }
    for (let index = 0; index < 78; index++) {
      const start = spatialStreamPose(index, 12345, 1920, 1080);
      expect(spatialStreamPose(index, 12345 + spatialStream.durationMs, 1920, 1080).position.distanceTo(start.position)).toBeLessThan(1e-8);
    }
  });

  it("keeps the home backs and the pitching question stream in view at both desktop sizes", () => {
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
        const fronts = visible.filter((card) => new Vector3(0, 0, -1).applyEuler(new Euler(card.pitch, 0, card.tilt))
          .dot(camera.position.clone().sub(card.position)) > 0).length;
        if (reverse) {
          expect(fronts).toBeGreaterThan(20);
          expect(visible.length - fronts).toBeGreaterThan(0);
        } else expect(fronts).toBe(0);
      }
    }
  });

  it("keeps the tiny return outside the central foreground in both views", () => {
    for (const reverse of [0, 1]) {
      const pose = cosmicSpaceCamera({ ring: 0, reading: 0, summary: 0, reverse });
      const camera = new PerspectiveCamera(50, 16 / 9, 0.1, 300);
      camera.position.set(...pose.position); camera.lookAt(...pose.target); camera.updateMatrixWorld();
      for (const start of [72, 75]) for (let step = 0; step < 300; step++) {
        const card = spatialStreamPose(0, (start + step / 100) / 78 * spatialStream.durationMs, 1920, 1080);
        const screen = card.position.clone().project(camera), depth = -card.position.clone().applyMatrix4(camera.matrixWorldInverse).z;
        if (depth > 0 && Math.abs(screen.x) < 0.95 && Math.abs(screen.y) < 0.95) {
          expect(card.size * 116 / 68 / (2 * Math.tan(25 * Math.PI / 180) * depth), `bend ${start + step / 100}, view ${reverse}`).toBeLessThan(0.09);
        }
      }
    }
  });

  it("keeps the continuous stream visible throughout the moving reverse shot", () => {
    const frames: { t: number; visible: number[] }[] = [];
    for (let ms = 0; ms <= reverseCameraDurationMs; ms += 100) {
      const reverse = cameraTravelProgress(ms), pose = cosmicSpaceCamera({ ring: 0, reading: 0, summary: 0, reverse });
      const camera = new PerspectiveCamera(pose.fov, 16 / 9, 0.1, 300);
      camera.position.set(...pose.position); camera.lookAt(...pose.target); camera.updateMatrixWorld();
      const visible = Array.from({ length: 78 }, (_, index) => {
        const card = spatialStreamPose(index, ms, 1920, 1080);
        const corners = [-0.5, 0.5].flatMap((x) => [-58 / 68, 58 / 68].map((y) => new Vector3(x, y, 0)
          .applyEuler(new Euler(card.pitch, 0, card.tilt)).multiplyScalar(card.size).add(card.position).project(camera)));
        const inView = Math.min(...corners.map((p) => p.x)) < 1 && Math.max(...corners.map((p) => p.x)) > -1
          && Math.min(...corners.map((p) => p.y)) < 1 && Math.max(...corners.map((p) => p.y)) > -1;
        return card.size > 0.03 && card.position.clone().applyMatrix4(camera.matrixWorldInverse).z < 0 && inView ? index : -1;
      }).filter((index) => index >= 0);
      frames.push({ t: ms, visible });
    }
    expect(Math.min(...frames.map((frame) => frame.visible.length))).toBeGreaterThan(5);
    // Keep actual original foreground identities through most of the move, then hand over to neighbors.
    const originalForeground = frames[0].visible.filter((index) => index >= 30 && index <= 35);
    for (const frame of frames.filter(({ t }) => t <= 2100)) {
      expect(frame.visible.filter((index) => originalForeground.includes(index)).length).toBeGreaterThan(0);
    }
    for (let index = 1; index < frames.length; index++) {
      expect(frames[index].visible.filter((id) => frames[index - 1].visible.includes(id)).length).toBeGreaterThan(2);
    }
  });

  it("continues at the home exit without a position or velocity jump and travels away after reversal", () => {
    const dt = 0.5, join = 36 / 78 * spatialStream.durationMs;
    const a = spatialStreamPose(0, join - dt, 1920, 1080), b = spatialStreamPose(0, join, 1920, 1080), c = spatialStreamPose(0, join + dt, 1920, 1080);
    const before = b.position.clone().sub(a.position).divideScalar(dt), after = c.position.clone().sub(b.position).divideScalar(dt);
    expect(before.distanceTo(after)).toBeLessThan(0.00001);
    const camera = new PerspectiveCamera(50, 16 / 9, 0.1, 300);
    camera.position.set(...questionCamera.position); camera.lookAt(...questionCamera.target); camera.updateMatrixWorld();
    const cards = [38, 48, 60, 69].map((slot) => spatialStreamPose(0, slot / 78 * spatialStream.durationMs, 1920, 1080));
    const projected = cards.map(({ position }) => position.clone().project(camera));
    expect(projected[0].x).toBeGreaterThan(0.5); expect(projected[0].y).toBeGreaterThan(0);
    expect(projected.at(-1)!.x).toBeLessThan(0); expect(projected.at(-1)!.y).toBeLessThan(0);
    for (let i = 1; i < projected.length; i++) expect(projected[i].x).toBeLessThan(projected[i - 1].x);
    const depths = cards.map(({ position }) => -position.clone().applyMatrix4(camera.matrixWorldInverse).z);
    for (let i = 1; i < depths.length; i++) expect(depths[i]).toBeGreaterThan(depths[i - 1]);
  });

  it("crosses the red guide's trough and crest before leaving the left edge, without a hook", () => {
    const camera = new PerspectiveCamera(50, 1850 / 959, 0.1, 300);
    camera.position.set(...questionCamera.position); camera.lookAt(...questionCamera.target); camera.updateMatrixWorld();
    const samples = Array.from({ length: 361 }, (_, index) => {
      const card = spatialStreamPose(0, (36 + index / 10) / 78 * spatialStream.durationMs, 1850, 959);
      const screen = card.position.clone().project(camera);
      return { x: (screen.x + 1) / 2, y: (1 - screen.y) / 2 };
    });
    for (let index = 1; index < samples.length; index++) expect(samples[index].x).toBeLessThan(samples[index - 1].x);
    for (const [x, y] of [[0.75, 0.327], [0.59, 0.438], [0.34, 0.394], [0.1, 0.496], [0, 0.61]]) {
      const nearest = samples.reduce((a, b) => Math.abs(a.x - x) < Math.abs(b.x - x) ? a : b);
      expect(Math.abs(nearest.y - y)).toBeLessThan(0.025);
    }
  });

  it("starts pitching after the first third and smoothly turns every face toward the ground", () => {
    let previous = 0;
    for (let slot = 36; slot <= 72; slot += 0.25) {
      const pose = spatialStreamPose(0, slot / 78 * spatialStream.durationMs, 1850, 959);
      const normal = new Vector3(0, 0, -1).applyEuler(new Euler(pose.pitch, 0, pose.tilt));
      if (slot <= 48) expect(Math.abs(pose.pitch)).toBe(0);
      expect(normal.y).toBeLessThanOrEqual(previous + 1e-9);
      expect(Math.abs(normal.x)).toBeLessThan(1e-9);
      previous = normal.y;
    }
    expect(previous).toBeLessThan(-0.9);
    for (const slot of [48, 60]) {
      const time = slot / 78 * spatialStream.durationMs, dt = 0.5;
      const a = spatialStreamPose(0, time - dt, 1850, 959), b = spatialStreamPose(0, time, 1850, 959), c = spatialStreamPose(0, time + dt, 1850, 959);
      expect(b.position.clone().sub(a.position).distanceTo(c.position.clone().sub(b.position))).toBeLessThan(0.00001);
    }
  });
});
