import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Scene, Vector3 } from "three";
import { CosmicRingEntry, ringEntryMotion } from "@/lib/cosmic-ring-entry";
import { spatialStreamPose } from "@/lib/cosmic-stream-space";
import { CosmicRingSpace } from "@/lib/cosmic-ring-space";
import { cosmicSpaceCamera } from "@/lib/cosmic-space-camera";
import { orbitMotion } from "@/lib/cosmic-experience";

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
          expect(next.position.distanceTo(previous.position)).toBeLessThan(0.12);
          expect(next.quaternion.angleTo(previous.quaternion)).toBeLessThan(0.02);
          expect(Math.abs(next.size - previous.size)).toBeLessThan(0.01);
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
      expect(new Vector3(...current.position).distanceTo(new Vector3(...previous.position))).toBeLessThan(1.8);
      previous = current;
    }
    expect(at(ringEntryMotion.cameraMs)).toEqual(at(ringEntryMotion.durationMs));
    const entry = new CosmicRingEntry(0);
    expect(entry.state(ringEntryMotion.cameraMs).entered).toBeGreaterThan(0);
    expect(entry.state(ringEntryMotion.cameraMs).entered).toBeLessThan(78);
  });
});
