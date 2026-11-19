import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Scene, Vector3 } from "three";
import { CosmicRingEntry, ringEntryMotion } from "@/lib/cosmic-ring-entry";
import { spatialStream, spatialStreamPose } from "@/lib/cosmic-stream-space";
import { CosmicRingSpace } from "@/lib/cosmic-ring-space";
import { cosmicSpaceCamera } from "@/lib/cosmic-space-camera";
import { orbitMotion } from "@/lib/cosmic-experience";
import { diveCruisePoint, diveCruiseSlots, diveGuidePoint, diveJunctionSlot } from "@/lib/cosmic-dive-path";

describe("continuous dive and ordered ring entry", () => {
  it("starts all 78 cards at their actual moving stream poses, even across a loop", () => {
    for (const clock of [0, 12000, 227499]) {
      const entry = new CosmicRingEntry(clock);
      for (let index = 0; index < 78; index++) {
        const actual = spatialStreamPose(index, clock, 1920, 1080), next = entry.pose(index, 0, 1920, 1080);
        expect(next.position.distanceTo(actual.position)).toBeLessThan(1e-8);
        expect(next.size).toBeCloseTo(actual.size, 8);
      }
    }
  });
  it("feeds each identity through one entrance in its original cyclic order, with no simultaneous collapse", () => {
    const entry = new CosmicRingEntry(9821), order: number[] = [];
    const seen = new Set<number>();
    let previous = 0;
    for (let time = 0; time <= ringEntryMotion.arrivalMs; time += 20) {
      const state = entry.state(time);
      expect(state.entered).toBeGreaterThanOrEqual(previous);
      expect(state.entered - previous).toBeLessThanOrEqual(1);
      previous = state.entered;
      for (let index = 0; index < 78; index++) {
        if (entry.pose(index, time, 1920, 1080).region === "ring" && !seen.has(index)) { order.push(index); seen.add(index); }
      }
    }
    expect(entry.state(ringEntryMotion.arrivalMs).entered).toBe(78);
    expect(order).toHaveLength(78);
    for (let i = 1; i < order.length; i++) expect(order[i]).toBe((order[i - 1] + 77) % 78);
  });
  it("joins the path and circle continuously, without moving or flipping a card on arrival", () => {
    const entry = new CosmicRingEntry(3210);
    for (let index = 0; index < 78; index++) {
      let previous = entry.pose(index, 0, 1920, 1080);
      for (let time = 0.5; time < ringEntryMotion.durationMs; time += 0.5) {
        const next = entry.pose(index, time, 1920, 1080);
        if (next.region !== previous.region) {
          // Locate the join itself, rather than confusing a faster card with a position jump.
          let left = time - 0.5, right = time;
          for (let i = 0; i < 18; i++) {
            const middle = (left + right) / 2;
            if (entry.pose(index, middle, 1920, 1080).region === previous.region) left = middle; else right = middle;
          }
          const at = (left + right) / 2, dt = 0.001;
          const a = entry.pose(index, at - dt, 1920, 1080), b = entry.pose(index, at, 1920, 1080), c = entry.pose(index, at + dt, 1920, 1080);
          expect(c.position.distanceTo(a.position)).toBeLessThan(0.001);
          expect(c.quaternion.angleTo(a.quaternion)).toBeLessThan(0.0001);
          expect(Math.abs(c.size - a.size)).toBeLessThan(0.0001);
          const incoming = b.position.clone().sub(a.position).divideScalar(dt), outgoing = c.position.clone().sub(b.position).divideScalar(dt);
          expect(incoming.distanceTo(outgoing)).toBeLessThan(0.001);
        }
        previous = next;
      }
    }
  });
  it("settles the complete ring into the existing idle speed and matches the selectable anchors", () => {
    const entry = new CosmicRingEntry(121234), end = entry.state(ringEntryMotion.durationMs);
    expect(end.entered).toBe(78);
    const next = entry.state(ringEntryMotion.durationMs + 100);
    expect((next.rotation - end.rotation) / 100).toBeCloseTo(orbitMotion.idleSpeed, 8);
    expect(entry.state(ringEntryMotion.durationMs - 0.1).speed).toBeCloseTo(orbitMotion.idleSpeed, 8);
    for (const [width, height] of [[1920, 1080], [1280, 720]]) {
      const pose = cosmicSpaceCamera({ ring: 1, reading: 0, summary: 0, dive: 1 });
      const camera = new PerspectiveCamera(50, width / height, 0.1, 1000);
      camera.position.set(...pose.position); camera.lookAt(...pose.target); camera.updateMatrixWorld();
      const ring = new CosmicRingSpace(camera, new Scene());
      const anchors = ring.layout({ ring: 1, reading: 0, summary: 0, dive: 1 }, width, height, end.rotation);
      for (let index = 0; index < 78; index++) {
        const card = entry.pose(index, ringEntryMotion.durationMs, width, height), screen = card.position.clone().project(camera);
        expect((screen.x + 1) * width / 2).toBeCloseTo(anchors[index].x, 6);
        expect((1 - screen.y) * height / 2).toBeCloseTo(anchors[index].y, 6);
        const depth = -card.position.clone().applyMatrix4(camera.matrixWorldInverse).z;
        expect(card.size / 68 * height / (2 * Math.tan(25 * Math.PI / 180)) / depth).toBeCloseTo(anchors[index].scale, 6);
        const back = new Vector3(0, 0, 1).applyQuaternion(card.quaternion);
        expect(back.dot(camera.position.clone().sub(card.position))).toBeGreaterThan(0);
      }
      ring.dispose();
    }
  });
  it("moves the camera continuously down the stream and stops before the ring finishes filling", () => {
    const first = cosmicSpaceCamera({ ring: 0, reading: 0, summary: 0, reverse: 1 });
    const at = (time: number) => cosmicSpaceCamera({ ring: 1, reading: 0, summary: 0, dive: new CosmicRingEntry(0).state(time).camera });
    expect(new Vector3(...at(0).position).distanceTo(new Vector3(...first.position))).toBeLessThan(1e-8);
    let previous = at(0);
    for (let time = 20; time <= ringEntryMotion.cameraMs; time += 20) {
      const current = at(time);
      expect(current.position[1]).toBeLessThanOrEqual(previous.position[1]);
      // The longer downstream route peaks below 120 world units/s, with no position jumps.
      expect(new Vector3(...current.position).distanceTo(new Vector3(...previous.position))).toBeLessThan(2.4);
      const direction = new Vector3(...current.target).sub(new Vector3(...current.position)).normalize();
      const before = new Vector3(...previous.target).sub(new Vector3(...previous.position)).normalize();
      expect(direction.angleTo(before)).toBeLessThan(0.08);
      previous = current;
    }
    expect(at(ringEntryMotion.cameraMs)).toEqual(at(ringEntryMotion.durationMs));
    const entry = new CosmicRingEntry(0);
    expect(entry.state(ringEntryMotion.cameraMs).entered).toBeGreaterThan(0);
    expect(entry.state(ringEntryMotion.cameraMs).entered).toBeLessThan(78);
  });

  it("keeps the original pitch through the long flight and stands up only on the final entrance arc", () => {
    const entry = new CosmicRingEntry(0);
    const source = spatialStreamPose(0, diveJunctionSlot / 78 * spatialStream.durationMs, 1920, 1080);
    const normal = new Vector3(0, 0, 1).applyAxisAngle(new Vector3(1, 0, 0), source.pitch);
    let samples = 0, firstEntry = Infinity, firstUpright = Infinity;
    for (let time = 0; time <= ringEntryMotion.arrivalMs; time += 20) {
      const card = entry.pose(69, time, 1920, 1080);
      if (card.region === "cruise") {
        expect(new Vector3(0, 0, 1).applyQuaternion(card.quaternion).dot(normal)).toBeCloseTo(1, 9);
        samples++;
      }
      if (card.region === "approach") firstUpright = Math.min(firstUpright, time);
      if (card.region === "ring") firstEntry = Math.min(firstEntry, time);
    }
    expect(samples).toBeGreaterThan(150);
    expect(firstUpright).toBeGreaterThan(5000);
    expect(firstEntry).toBeGreaterThan(6000); expect(firstEntry).toBeLessThan(8000);
    expect(diveCruiseSlots).toBeLessThan(ringEntryMotion.entranceSlots);
  });

  it("frames the same forward route down-left then up-left, without revealing a second large stream", () => {
    const entry = new CosmicRingEntry(0);
    const ringPose = cosmicSpaceCamera({ ring: 1, reading: 0, summary: 0, dive: 1 });
    const ringView = new PerspectiveCamera(50, 16 / 9, 0.1, 1000);
    ringView.position.set(...ringPose.position); ringView.lookAt(...ringPose.target); ringView.updateMatrixWorld();
    const incoming = diveCruisePoint(1).project(ringView);
    expect((incoming.x + 1) / 2).toBeLessThan(0.2);
    expect((1 - incoming.y) / 2).toBeLessThan(0.25);
    for (const [time, below] of [[3000, true], [6000, false]] as const) {
      const state = entry.state(time), pose = cosmicSpaceCamera({ ring: 1, reading: 0, summary: 0, dive: state.camera });
      const camera = new PerspectiveCamera(50, 16 / 9, 0.1, 1000);
      camera.position.set(...pose.position); camera.lookAt(...pose.target); camera.updateMatrixWorld();
      const screen = diveGuidePoint(state.camera).project(camera);
      expect((screen.x + 1) / 2).toBeCloseTo(0.23, 4);
      if (below) expect((1 - screen.y) / 2).toBeGreaterThan(0.6);
      else expect((1 - screen.y) / 2).toBeLessThan(0.4);
    }
    for (let time = 6500; time <= ringEntryMotion.cameraMs; time += 100) {
      const state = entry.state(time), pose = cosmicSpaceCamera({ ring: 1, reading: 0, summary: 0, dive: state.camera });
      const camera = new PerspectiveCamera(50, 16 / 9, 0.1, 1000);
      camera.position.set(...pose.position); camera.lookAt(...pose.target); camera.updateMatrixWorld();
      for (let index = 0; index < 78; index++) {
        const card = entry.pose(index, time, 1920, 1080);
        if (card.region !== "stream" || card.size < 0.03) continue;
        const projected = card.position.clone().project(camera);
        const depth = -card.position.clone().applyMatrix4(camera.matrixWorldInverse).z;
        expect(depth > 0 && Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1).toBe(false);
      }
    }
  });
});
