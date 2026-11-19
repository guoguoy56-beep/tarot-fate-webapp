import { PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer } from "three";
import { cosmicSpaceCamera, type SpaceCameraBlend } from "@/lib/cosmic-space-camera";
import { createCosmicStarfield } from "@/lib/cosmic-starfield";
import { createCosmicNebulae } from "@/lib/cosmic-nebula";
import { createCosmicGalacticBand } from "@/lib/cosmic-galactic-band";
import { createCosmicMeteors } from "@/lib/cosmic-meteors";
import { CosmicRingSpace } from "@/lib/cosmic-ring-space";
import { CosmicStreamMeshes } from "@/lib/cosmic-stream-meshes";
import type { CosmicDeckEntry } from "@/lib/cosmic-stream-space";
import { ringEntryMotion, type CosmicRingEntry } from "@/lib/cosmic-ring-entry";
import type { CardSurfaceProjection } from "@/lib/cosmic-card-back-projection";

export interface CosmicBackdrop {
  ring: CosmicRingSpace;
  readonly loadProgress: number;
  setDeck(deck: readonly CosmicDeckEntry[]): void;
  drawBacks(poses: readonly CardSurfaceProjection[], width: number, height: number): boolean;
  render(blend: SpaceCameraBlend, width: number, height: number, streamTime?: number, entry?: { queue: CosmicRingEntry; elapsed: number }, starTime?: number): void;
  dispose(): void;
}

/** One camera drives WebGL scenery and the projected native CSS3D card surfaces. */
export function createCosmicBackdrop(host: HTMLDivElement): CosmicBackdrop {
  const scene = new Scene();
  const camera = new PerspectiveCamera(50, 1, 0.1, 1000);
  const ring = new CosmicRingSpace(camera, scene);
  const updateCamera = (blend: SpaceCameraBlend, width: number, height: number) => {
    const pose = cosmicSpaceCamera(blend);
    camera.aspect = width / height;
    camera.position.set(...pose.position); camera.lookAt(...pose.target);
    camera.fov = pose.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    return pose;
  };
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("webgl2", { alpha: false, antialias: false });
  if (!context) {
    host.dataset.renderer = "fallback";
    host.dataset.streamReady = "true";
    return { ring, loadProgress: 1, setDeck: () => {}, drawBacks: () => false, render: (blend, width, height) => updateCamera({ ...blend, reverse: 0, dive: undefined }, width, height), dispose: () => ring.dispose() };
  }
  const renderer = new WebGLRenderer({ canvas, context, alpha: false, antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000);
  renderer.outputColorSpace = SRGBColorSpace;
  host.appendChild(canvas);
  let disposed = false, lost = false, dirty = true, lastKey = "", frames = 0;
  let baseDrawn = false;
  const stream = new CosmicStreamMeshes(scene, Math.min(8, renderer.capabilities.getMaxAnisotropy()), () => { dirty = true; });
  let width = 0, height = 0;
  const stars = createCosmicStarfield(renderer.getPixelRatio());
  stars.renderOrder = -20;
  scene.add(stars);
  const nebulae = createCosmicNebulae(scene);
  const galacticBand = createCosmicGalacticBand(scene);
  const meteors = createCosmicMeteors(scene);
  host.dataset.background = "procedural-stars-nebula";
  host.dataset.starCount = String(stars.geometry.getAttribute("position").count);
  host.dataset.nebulaCount = String(nebulae.clouds.length);
  const onLost = (event: Event) => { event.preventDefault(); lost = true; host.dataset.renderer = "fallback"; };
  const onRestored = () => { lost = false; dirty = true; lastKey = ""; };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);
  return {
    ring,
    get loadProgress() { return stream.loadProgress; },
    setDeck: (deck) => stream.setDeck(deck),
    drawBacks(poses, width, height) {
      if (disposed || lost || !stream.available || host.dataset.renderer !== "webgl") return false;
      if (!baseDrawn) renderer.render(scene, camera);
      baseDrawn = false;
      stream.drawBacks(renderer, camera, poses, width, height);
      host.dataset.cardBackSource = stream.cardBackSource;
      host.dataset.cardBackCount = String(poses.length);
      host.dataset.returningCards = poses.filter((pose) => pose.transform).map((pose) => `${pose.anchor}:${pose.order}`).join(",");
      return true;
    },
    render(blend, nextWidth, nextHeight, streamTime = 0, entry, starTime = 0) {
      baseDrawn = false;
      if (disposed || document.hidden || !nextWidth || !nextHeight) return;
      const fallback = lost || (stream.ready && !stream.available);
      const pose = updateCamera(fallback ? { ...blend, reverse: 0, dive: undefined } : blend, nextWidth, nextHeight);
      host.dataset.streamReady = String(stream.ready);
      if (!stream.ready || lost) return;
      const key = [...pose.position, ...pose.target, pose.fov, nextWidth, nextHeight, blend.ring < 0.999 ? streamTime : 0, entry?.elapsed ?? -1, starTime].map((value) => value.toFixed(4)).join(":");
      if (key === lastKey && !dirty) return;
      if (width !== nextWidth || height !== nextHeight) {
        width = nextWidth; height = nextHeight;
        renderer.setSize(width, height, false);
      }
      stars.material.uniforms.time.value = starTime / 1000;
      nebulae.update(starTime / 1000, camera);
      galacticBand.update(starTime / 1000);
      meteors.update(starTime / 1000);
      const visible = stream.update(streamTime, nextWidth, nextHeight, entry ? 1 : Math.max(0, 1 - blend.ring), camera, entry);
      renderer.render(scene, camera);
      baseDrawn = true;
      host.dataset.renderer = "webgl";
      host.dataset.cameraX = pose.position[0].toFixed(5);
      host.dataset.cameraY = pose.position[1].toFixed(5);
      host.dataset.cameraZ = pose.position[2].toFixed(5);
      host.dataset.cameraFov = pose.fov.toFixed(5);
      host.dataset.streamRenderer = stream.available ? "mesh" : "fallback";
      host.dataset.streamCount = String(stream.cards.length);
      host.dataset.visibleFronts = String(visible.fronts); host.dataset.visibleBacks = String(visible.backs);
      host.dataset.streamTime = streamTime.toFixed(2);
      host.dataset.ringEntered = String(entry?.queue.state(entry.elapsed).entered ?? (blend.ring === 1 ? 78 : 0));
      host.dataset.ringHandoff = String(entry ? Math.max(0, Math.min(1, (entry.elapsed - ringEntryMotion.arrivalMs) / (ringEntryMotion.durationMs - ringEntryMotion.arrivalMs))) : 1);
      host.dataset.cameraTarget = pose.target.map((value) => value.toFixed(5)).join(",");
      host.dataset.frames = String(++frames);
      host.dataset.starTime = (starTime / 1000).toFixed(3);
      lastKey = key;
      dirty = false;
    },
    dispose() {
      disposed = true;
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      stars.geometry.dispose(); stars.material.dispose(); nebulae.dispose(); galacticBand.dispose(); meteors.dispose(); stream.dispose();
      renderer.dispose();
      ring.dispose();
      canvas.remove();
      host.dataset.renderer = "fallback";
    },
  };
}
