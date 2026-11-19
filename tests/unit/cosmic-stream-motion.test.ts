import { describe, expect, it, vi } from "vitest";
import { PerspectiveCamera, Scene, Texture, TextureLoader, Vector3 } from "three";
import { tarotCards } from "@/data/tarotCards";
import { reverseStreamExtraTime } from "@/lib/cosmic-experience";
import { cameraTravelProgress, cosmicSpaceCamera, reverseCameraDurationMs } from "@/lib/cosmic-space-camera";
import { CosmicStreamMeshes } from "@/lib/cosmic-stream-meshes";
import { spatialStreamPose } from "@/lib/cosmic-stream-space";

describe("visible card flow during the reverse shot", () => {
  it("advances continuously and matches the original idle velocity at both ends", () => {
    const duration = reverseCameraDurationMs;
    const flow = (time: number) => time + reverseStreamExtraTime(time, duration);
    expect(flow(0)).toBe(0);
    let previous = 0;
    for (let time = 20; time <= duration; time += 20) {
      expect(flow(time)).toBeGreaterThan(previous);
      previous = flow(time);
    }
    const rate = (time: number) => (flow(time + 0.1) - flow(time)) / 0.1;
    expect(rate(0)).toBeCloseTo(1, 6);
    expect(rate(duration / 2)).toBeCloseTo(6, 6);
    expect(rate(duration)).toBeCloseTo(1, 6);
  });

  it("moves the actual 78 mesh transforms while the camera is turning, preserving their identities", () => {
    const loader = vi.spyOn(TextureLoader.prototype, "load").mockImplementation((_path, onLoad) => {
      const texture = new Texture<HTMLImageElement>(); onLoad?.(texture); return texture;
    });
    const scene = new Scene(), camera = new PerspectiveCamera(50, 16 / 9, 0.1, 1000);
    const stream = new CosmicStreamMeshes(scene, 1, () => {});
    try {
      stream.setDeck(tarotCards.map((card) => ({ card, orientation: "upright" as const })));
      const identities = stream.cards.map((node) => ({ ...node.userData }));
      let previous: Vector3 | undefined;
      for (const elapsed of [0, 450, 900, 1800, 2700, 3150, 3600]) {
        const pose = cosmicSpaceCamera({ ring: 0, reading: 0, summary: 0, reverse: cameraTravelProgress(elapsed) });
        camera.position.set(...pose.position); camera.lookAt(...pose.target); camera.updateMatrixWorld();
        const clock = elapsed + reverseStreamExtraTime(elapsed, reverseCameraDurationMs);
        stream.update(clock, 1920, 1080, 1, camera);
        const position = stream.cards[30].getWorldPosition(new Vector3());
        if (previous) expect(position.distanceTo(previous)).toBeGreaterThan(0.01);
        expect(position.distanceTo(spatialStreamPose(30, clock, 1920, 1080).position)).toBeLessThan(1e-8);
        expect(stream.cards.map((node) => node.userData)).toEqual(identities);
        expect(stream.group.visible).toBe(true);
        previous = position;
      }
    } finally { stream.dispose(); loader.mockRestore(); }
  });
});
