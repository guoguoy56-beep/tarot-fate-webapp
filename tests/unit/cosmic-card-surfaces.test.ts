import { describe, expect, it, vi } from "vitest";
import { Matrix4, PerspectiveCamera, Scene, Texture, TextureLoader, Vector4, type WebGLRenderer } from "three";
import { tarotCards } from "@/data/tarotCards";
import { cardBackClipMatrix, cardSurfaceClipMatrix, type CardSurfaceProjection } from "@/lib/cosmic-card-back-projection";
import { CosmicStreamMeshes } from "@/lib/cosmic-stream-meshes";
import { CosmicRingEntry, ringEntryMotion } from "@/lib/cosmic-ring-entry";
import { CosmicRingSpace } from "@/lib/cosmic-ring-space";
import { cosmicSpaceCamera } from "@/lib/cosmic-space-camera";

describe("returning card surfaces", () => {
  const base = { anchor: 0, x: 600, y: 400, scale: 2.8, yaw: 15, tilt: -8, perspective: 480, order: 20 };

  it("matches the resting back exactly and keeps an inner flip's CSS-pixel perspective", () => {
    const back = cardBackClipMatrix(base, 1200, 800);
    const surface = cardSurfaceClipMatrix(base, 1200, 800);
    surface.elements.forEach((value, index) => expect(value).toBeCloseTo(back.elements[index], 10));
    const flip = new Matrix4().makeRotationY(Math.PI / 3);
    const flipped = cardSurfaceClipMatrix({ ...base, yaw: 0, tilt: 0, transform: flip.elements }, 1200, 800);
    const p = new Vector4(0.5, 0, 0, 1).applyMatrix4(flipped);
    // A 34px half-width turns before its outer XY scale; CSS scale does not magnify local Z.
    const z = -34 * Math.sin(Math.PI / 3), x = 34 * Math.cos(Math.PI / 3) * base.scale;
    expect((p.x / p.w + 1) * 600).toBeCloseTo(base.x + x / (1 - z / base.perspective), 8);
  });

  it("sorts a returning face and its glow between farther and nearer backs without replacing its identity", () => {
    const load = vi.spyOn(TextureLoader.prototype, "load").mockImplementation((_path, onLoad) => {
      const texture = new Texture<HTMLImageElement>(); onLoad?.(texture); return texture;
    });
    const stream = new CosmicStreamMeshes(new Scene(), 1, () => {});
    stream.setDeck(tarotCards.map((card) => ({ card, orientation: "upright" as const })));
    const camera = new PerspectiveCamera(50, 1.5, 0.1, 1000);
    camera.position.z = 24; camera.updateMatrixWorld();
    let returningNode: object | undefined;
    const renderer = { autoClear: true, render: vi.fn((scene: Scene) => {
      const nodes = scene.children.filter((node) => node.visible).sort((a, b) => a.renderOrder - b.renderOrder);
      expect(nodes.map((node) => node.userData.anchor)).toEqual([0, 1, 2]);
      expect(nodes.map((node) => node.renderOrder)).toEqual([10, 20, 30]);
      const returned = nodes[1];
      if (returningNode) expect(returned).toBe(returningNode); else returningNode = returned;
      expect(returned.userData.cardId).toBe(tarotCards[1].id);
      expect(returned.children[0].visible).toBe(true);
      expect(returned.children[2].visible).toBe(true);
      expect(returned.children[2].scale.x).toBeCloseTo(66 / 68, 10);
      expect(returned.children[2].scale.y).toBeCloseTo(114 / 116, 10);
      for (const node of nodes) for (const mesh of node.children) {
        const material = (mesh as import("three").Mesh).material as import("three").Material;
        expect(material.transparent).toBe(true);
        expect(material.depthTest).toBe(false);
      }
    }) } as unknown as WebGLRenderer;
    const poses: CardSurfaceProjection[] = [
      { ...base, anchor: 2, order: 30 },
      { ...base, anchor: 1, order: 20, glow: true, transform: new Matrix4().makeRotationY(2).elements },
      { ...base, anchor: 0, order: 10 },
    ];
    try {
      stream.drawBacks(renderer, camera, poses, 1200, 800);
      stream.drawBacks(renderer, camera, [...poses].reverse(), 1200, 800);
      expect(renderer.autoClear).toBe(true);
      expect((stream.cards[1].children[2] as import("three").Mesh<import("three").BufferGeometry, import("three").MeshBasicMaterial>).material.depthTest).toBe(true);
    } finally { stream.dispose(); load.mockRestore(); }
  });

  it("hands the actual entry meshes to the selectable surfaces with every corner aligned", () => {
    const load = vi.spyOn(TextureLoader.prototype, "load").mockImplementation((_path, onLoad) => {
      const texture = new Texture<HTMLImageElement>(); onLoad?.(texture); return texture;
    });
    const width = 1480, height = 711;
    const scene = new Scene(), view = cosmicSpaceCamera({ ring: 1, reading: 0, summary: 0, dive: 1 });
    const camera = new PerspectiveCamera(view.fov, width / height, 0.1, 1000);
    camera.position.set(...view.position); camera.lookAt(...view.target); camera.updateMatrixWorld();
    const stream = new CosmicStreamMeshes(scene, 1, () => {}), ring = new CosmicRingSpace(camera, scene);
    stream.setDeck(tarotCards.map((card) => ({ card, orientation: "upright" as const })));
    const queue = new CosmicRingEntry(123456), time = ringEntryMotion.durationMs;
    const state = queue.state(time), anchors = ring.layout({ ring: 1, reading: 0, summary: 0, dive: 1 }, width, height, state.rotation);
    const poses = anchors.map((anchor, index) => {
      const cosine = Math.cos(index / 78 * Math.PI * 2 + state.rotation);
      return { ...anchor, anchor: index, yaw: cosine * 20, tilt: cosine * 12, perspective: 900, order: index };
    });
    const renderer = { autoClear: true, render: (layer: Scene) => {
      layer.updateMatrixWorld(true);
      for (const node of layer.children) {
        const back = node.children[1], expected = cardBackClipMatrix(poses[node.userData.anchor], width, height);
        const actual = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(back.matrixWorld);
        for (const [x, y] of [[-.5, -116 / 136], [.5, -116 / 136], [.5, 116 / 136], [-.5, 116 / 136]]) {
          const a = new Vector4(x, y, 0, 1).applyMatrix4(actual), e = new Vector4(x, y, 0, 1).applyMatrix4(expected);
          expect(a.x / a.w).toBeCloseTo(e.x / e.w, 8);
          expect(a.y / a.w).toBeCloseTo(e.y / e.w, 8);
        }
      }
    } } as unknown as WebGLRenderer;
    try {
      stream.update(0, width, height, 1, camera, { queue, elapsed: time }); scene.updateMatrixWorld(true);
      expect(stream.group.visible).toBe(false);
      stream.drawBacks(renderer, camera, poses, width, height);
      stream.update(0, width, height, 0, camera);
      stream.drawBacks(renderer, camera, poses, width, height);
    } finally { ring.dispose(); stream.dispose(); load.mockRestore(); }
  });
});
