import { BufferGeometry, Group, MeshBasicMaterial, SRGBColorSpace, Texture, TextureLoader, Vector3 } from "three";
import { createCardEdgeGeometry, createCardFaceGeometry, createDoubleSidedCard, spatialStreamPose, type CosmicDeckEntry } from "@/lib/cosmic-stream-space";
import { cosmicCardBackSrc } from "@/lib/cosmic-assets";
import type { PerspectiveCamera, Scene } from "three";
import type { CosmicRingEntry } from "@/lib/cosmic-ring-entry";

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
    this.group.visible = this.available && opacity > 0.001;
    if (!this.group.visible) return { fronts: 0, backs: 0 };
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
    this.geometry.dispose(); this.edgeGeometry.dispose(); this.back.dispose(); this.edge.dispose();
    this.faces.forEach((material) => material.dispose()); this.textures.forEach((texture) => texture.dispose());
  }
}
