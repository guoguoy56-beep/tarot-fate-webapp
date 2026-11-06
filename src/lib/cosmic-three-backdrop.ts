import { AdditiveBlending, BackSide, BufferGeometry, CanvasTexture, Float32BufferAttribute, Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry, Points, PointsMaterial, Scene, SphereGeometry, SRGBColorSpace, TextureLoader, WebGLRenderer } from "three";
import { cosmicPanoramaFrame, cosmicSpaceCamera, type SpaceCameraBlend } from "@/lib/cosmic-space-camera";
import { CosmicRingSpace } from "@/lib/cosmic-ring-space";
import { CosmicStreamMeshes } from "@/lib/cosmic-stream-meshes";
import type { CosmicDeckEntry } from "@/lib/cosmic-stream-space";
import type { CosmicRingEntry } from "@/lib/cosmic-ring-entry";

export interface CosmicBackdrop {
  ring: CosmicRingSpace;
  setDeck(deck: readonly CosmicDeckEntry[]): void;
  render(blend: SpaceCameraBlend, width: number, height: number, streamTime?: number, entry?: { queue: CosmicRingEntry; elapsed: number }): void;
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
    return { ring, setDeck: () => {}, render: (blend, width, height) => updateCamera({ ...blend, reverse: 0, dive: undefined }, width, height), dispose: () => ring.dispose() };
  }
  const renderer = new WebGLRenderer({ canvas, context, alpha: false, antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x060916);
  renderer.outputColorSpace = SRGBColorSpace;
  host.appendChild(canvas);
  const planeGeometry = new PlaneGeometry(1, 1);
  const planeMaterial = new MeshBasicMaterial({ toneMapped: false });
  const panorama = new Mesh(planeGeometry, planeMaterial);
  panorama.position.z = -36;
  scene.add(panorama);
  let disposed = false, ready = false, backgroundFailed = false, lost = false, dirty = true, lastKey = "", frames = 0;
  const stream = new CosmicStreamMeshes(scene, Math.min(8, renderer.capabilities.getMaxAnisotropy()), () => { dirty = true; });
  let width = 0, height = 0;
  const texture = new TextureLoader().load("/assets/cosmic/cosmic-panorama-v1.png", (loaded) => {
    if (disposed) { loaded.dispose(); return; }
    ready = true;
    dirty = true;
  }, undefined, () => { if (!disposed) { backgroundFailed = true; host.dataset.renderer = "fallback"; } });
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  planeMaterial.map = texture;

  // A quiet surrounding shell makes the reverse side readable during the camera graybox.
  // Formal flowing nebula volumes replace this placeholder in step 4.
  const shellGeometry = new SphereGeometry(450, 32, 16);
  const shellMaterial = new MeshBasicMaterial({ map: texture, color: 0x544864, side: BackSide, toneMapped: false });
  const shell = new Mesh(shellGeometry, shellMaterial);
  scene.add(shell);

  // Soft, low-contrast stars at three actual depths; no extra asset or ambient movement.
  const dot = document.createElement("canvas");
  dot.width = dot.height = 32;
  const paint = dot.getContext("2d")!;
  const glow = paint.createRadialGradient(16, 16, 0, 16, 16, 16);
  glow.addColorStop(0, "#ffffff"); glow.addColorStop(0.22, "#ffffffcc"); glow.addColorStop(1, "#ffffff00");
  paint.fillStyle = glow; paint.fillRect(0, 0, 32, 32);
  const dotTexture = new CanvasTexture(dot);
  dotTexture.colorSpace = SRGBColorSpace;
  let seed = 271828;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const layers = [[380, -34, -20, 1.4, 0.28], [180, -20, 3, 1.8, 0.34], [90, 3, 22, 2.4, 0.4], [250, 35, 140, 1.8, 0.36]] as const;
  const stars = layers.map(([count, near, far, size, opacity]) => {
    const vertices = Array.from({ length: count }, () => [(random() - 0.35) * 130, (random() - 0.5) * 85, near + random() * (far - near)]).flat();
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    const material = new PointsMaterial({ map: dotTexture, color: 0xe4d5eb, size, sizeAttenuation: false, transparent: true, opacity, depthWrite: false, blending: AdditiveBlending, toneMapped: false });
    const points = new Points(geometry, material);
    scene.add(points);
    return points;
  });
  const onLost = (event: Event) => { event.preventDefault(); lost = true; host.dataset.renderer = "fallback"; };
  const onRestored = () => { lost = false; dirty = true; lastKey = ""; };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);
  return {
    ring,
    setDeck: (deck) => stream.setDeck(deck),
    render(blend, nextWidth, nextHeight, streamTime = 0, entry) {
      if (disposed || !nextWidth || !nextHeight) return;
      const fallback = lost || backgroundFailed || (stream.ready && !stream.available);
      const pose = updateCamera(fallback ? { ...blend, reverse: 0, dive: undefined } : blend, nextWidth, nextHeight);
      host.dataset.streamReady = String(stream.ready && (ready || backgroundFailed));
      if (!ready || !stream.ready || lost) return;
      const key = [...pose.position, ...pose.target, pose.fov, nextWidth, nextHeight, blend.ring < 0.999 ? streamTime : 0, entry?.elapsed ?? -1].map((value) => value.toFixed(4)).join(":");
      if (key === lastKey && !dirty) return;
      if (width !== nextWidth || height !== nextHeight) {
        width = nextWidth; height = nextHeight;
        renderer.setSize(width, height, false);
        // Match the existing home cover-crop so the stream still starts inside the vortex.
        const image = cosmicPanoramaFrame(camera.aspect);
        panorama.scale.set(image.width, image.height, 1);
        panorama.position.set(image.x, image.y, image.z);
      }
      const visible = stream.update(streamTime, nextWidth, nextHeight, entry ? 1 : Math.max(0, 1 - blend.ring), camera, entry);
      renderer.render(scene, camera);
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
      host.dataset.cameraTarget = pose.target.map((value) => value.toFixed(5)).join(",");
      host.dataset.frames = String(++frames);
      lastKey = key;
      dirty = false;
    },
    dispose() {
      disposed = true;
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      stars.forEach((points) => { points.geometry.dispose(); points.material.dispose(); });
      dotTexture.dispose(); texture.dispose(); planeGeometry.dispose(); planeMaterial.dispose();
      shellGeometry.dispose(); shellMaterial.dispose(); stream.dispose();
      renderer.dispose();
      ring.dispose();
      canvas.remove();
      host.dataset.renderer = "fallback";
    },
  };
}
