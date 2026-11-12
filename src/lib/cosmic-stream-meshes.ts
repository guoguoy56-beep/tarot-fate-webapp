import { BufferGeometry, DoubleSide, Group, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, Scene, ShaderMaterial, SRGBColorSpace, Texture, TextureLoader, Vector3 } from "three";
import { cardSurfaceClipMatrix, cardSurfaceShowsBack, type CardSurfaceProjection } from "@/lib/cosmic-card-back-projection";
import { createCardEdgeGeometry, createCardFaceGeometry, createDoubleSidedCard, spatialStreamPose, type CosmicDeckEntry } from "@/lib/cosmic-stream-space";
import { cosmicCardBackSrc } from "@/lib/cosmic-assets";
import type { PerspectiveCamera, WebGLRenderer } from "three";
import type { CosmicRingEntry } from "@/lib/cosmic-ring-entry";
import { ringEntryMotion } from "@/lib/cosmic-ring-entry";
import { ringHandoffMatrix } from "@/lib/cosmic-ring-handoff";

export class CosmicStreamMeshes {
  readonly group = new Group();
  readonly cards: Group[] = [];
  readonly geometry = createCardFaceGeometry();
  readonly edgeGeometry = createCardEdgeGeometry();
  private readonly back = new MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  private readonly edge = new MeshBasicMaterial({ color: 0x96774b, toneMapped: false });
  private readonly faces = new Map<string, MeshBasicMaterial>();
  private readonly textures: Texture[] = [];
  private readonly loader = new TextureLoader();
  private disposed = false;
  private pending = 0;
  private failed = false;
  private readonly point = new Vector3();
  private readonly direction = new Vector3();
  private readonly normal = new Vector3();
  private readonly backScene = new Scene();
  private readonly projectedCards = new Map<number, Group>();
  private handoff: number | null = null;
  private readonly glowGeometry = new PlaneGeometry(1.65, 116 / 68 + 0.65);
  private readonly glowMaterial = new ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, toneMapped: false, side: DoubleSide,
    vertexShader: `varying vec2 point; void main() { point = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec2 point;
      void main() {
        vec2 q = abs(point) - vec2(0.425, 116.0 / 136.0 - 0.075);
        float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.075;
        float edge = 1.0 - smoothstep(0.015, 0.03, abs(d));
        float halo = exp(-max(d, 0.0) * 16.0) * 0.32;
        gl_FragColor = vec4(1.0, 0.72, 0.3, max(edge, halo));
        #include <colorspace_fragment>
      }`,
  });

  drawBacks(renderer: WebGLRenderer, camera: PerspectiveCamera, poses: readonly CardSurfaceProjection[], width: number, height: number) {
    // Returning faces and ring backs share one painter order, including their highlights.
    const worldFromClip = new Matrix4().multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse);
    this.projectedCards.forEach((node) => { node.visible = false; });
    poses.forEach((pose) => {
      let node = this.projectedCards.get(pose.anchor);
      const source = this.cards[pose.anchor];
      const material = (source.children[2] as Mesh<BufferGeometry, MeshBasicMaterial>).material;
      if (!node) {
        node = new Group(); node.matrixAutoUpdate = false;
        node.add(new Mesh(this.glowGeometry, this.glowMaterial), new Mesh(this.geometry, this.back), new Mesh(this.geometry, material));
        node.children.forEach((mesh, index) => { mesh.frustumCulled = false; mesh.renderOrder = index; });
        this.projectedCards.set(pose.anchor, node); this.backScene.add(node);
      }
      node.visible = true;
      const clip = cardSurfaceClipMatrix(pose, width, height);
      if (this.handoff !== null) {
        node.matrix.copy(ringHandoffMatrix(source.children[1].matrixWorld, pose, camera, width, height, this.handoff));
      } else node.matrix.copy(worldFromClip).multiply(clip);
      node.renderOrder = pose.order;
      node.userData = { ...source.userData, order: pose.order, returning: Boolean(pose.transform) };
      node.children[0].visible = Boolean(pose.glow);
      const backFacing = !pose.transform || cardSurfaceShowsBack(clip);
      node.children[1].visible = backFacing;
      const front = node.children[2] as Mesh<BufferGeometry, MeshBasicMaterial>;
      front.visible = !backFacing; front.material = material;
      front.rotation.set(0, Math.PI, source.userData.orientation === "reversed" ? Math.PI : 0);
      // Native front images sit inside the 1px border of the 68x116 CSS card.
      front.scale.set(66 / 68, 114 / 116, 1);
    });
    const materials = [this.back, ...this.faces.values()];
    const states = materials.map((material) => ({ material, depthTest: material.depthTest, depthWrite: material.depthWrite, transparent: material.transparent, opacity: material.opacity, side: material.side }));
    const autoClear = renderer.autoClear;
    materials.forEach((material) => { material.depthTest = false; material.depthWrite = false; material.transparent = true; material.opacity = 1; material.side = DoubleSide; });
    renderer.autoClear = false;
    try { renderer.render(this.backScene, camera); }
    finally {
      states.forEach(({ material, ...state }) => Object.assign(material, state));
      renderer.autoClear = autoClear;
    }
  }

  constructor(scene: Scene, private readonly anisotropy: number, private readonly changed: () => void) {
    this.group.name = "continuous-tarot-stream";
    scene.add(this.group);
    this.back.map = this.load(cosmicCardBackSrc);
  }

  private load(path: string) {
    this.pending++;
    const done = () => { this.pending--; this.changed(); };
    const texture = this.loader.load(path, (loaded) => { if (this.disposed) loaded.dispose(); done(); }, undefined,
      () => { this.failed = true; done(); });
    texture.colorSpace = SRGBColorSpace; texture.anisotropy = this.anisotropy;
    this.textures.push(texture);
    return texture;
  }

  get ready() { return this.cards.length === 78 && this.pending === 0; }
  get available() { return this.ready && !this.failed; }
  get cardBackSource(): string { return (this.back.map?.image as HTMLImageElement | undefined)?.currentSrc ?? ""; }

  setDeck(deck: readonly CosmicDeckEntry[]) {
    deck.forEach(({ card, orientation }, index) => {
      let material = this.faces.get(card.id);
      if (!material) {
        material = new MeshBasicMaterial({ map: this.load(card.image), toneMapped: false });
        this.faces.set(card.id, material);
      }
      const node = this.cards[index] ?? createDoubleSidedCard(this.geometry, this.edgeGeometry, this.back, material, this.edge);
      if (!this.cards[index]) { this.cards[index] = node; this.group.add(node); }
      const front = node.children[2] as import("three").Mesh<BufferGeometry, MeshBasicMaterial>;
      front.material = material;
      front.rotation.z = orientation === "reversed" ? Math.PI : 0;
      node.userData = { anchor: index, cardId: card.id, orientation };
      node.name = `stream-card-${index}`;
    });
    this.changed();
  }

  update(elapsed: number, width: number, height: number, opacity: number, camera: PerspectiveCamera, entry?: { queue: CosmicRingEntry; elapsed: number }) {
    this.handoff = entry && entry.elapsed >= ringEntryMotion.arrivalMs
      ? Math.min(1, (entry.elapsed - ringEntryMotion.arrivalMs) / (ringEntryMotion.durationMs - ringEntryMotion.arrivalMs)) : null;
    const visible = this.available && opacity > 0.001;
    this.group.visible = visible && this.handoff === null;
    if (!visible) return { fronts: 0, backs: 0 };
    for (const material of [this.back, this.edge, ...this.faces.values()]) {
      if (material.transparent !== (opacity < 0.999)) { material.transparent = opacity < 0.999; material.needsUpdate = true; }
      material.opacity = opacity;
    }
    let fronts = 0, backs = 0;
    this.cards.forEach((node, index) => {
      const pose = entry ? entry.queue.pose(index, entry.elapsed, width, height) : spatialStreamPose(index, elapsed, width, height);
      node.position.copy(pose.position); node.scale.setScalar(pose.size);
      if ("quaternion" in pose) node.quaternion.copy(pose.quaternion);
      else node.rotation.set(pose.pitch, 0, pose.tilt);
      this.point.copy(pose.position).project(camera);
      this.direction.copy(pose.position).applyMatrix4(camera.matrixWorldInverse);
      if (this.direction.z < 0 && Math.abs(this.point.x) < 1 && Math.abs(this.point.y) < 1) {
        this.normal.set(0, 0, -1).applyQuaternion(node.quaternion);
        this.direction.copy(camera.position).sub(pose.position);
        if (this.normal.dot(this.direction) > 0) fronts++; else backs++;
      }
    });
    return { fronts, backs };
  }

  dispose() {
    this.disposed = true;
    this.group.removeFromParent(); this.group.clear();
    this.backScene.clear();
    this.projectedCards.clear(); this.glowGeometry.dispose(); this.glowMaterial.dispose();
    this.geometry.dispose(); this.edgeGeometry.dispose(); this.back.dispose(); this.edge.dispose();
    this.faces.forEach((material) => material.dispose()); this.textures.forEach((texture) => texture.dispose());
  }
}
