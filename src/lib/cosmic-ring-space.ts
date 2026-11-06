import { Group, Matrix4, Object3D, PerspectiveCamera, Plane, Raycaster, Scene, Vector2, Vector3 } from "three";
import { cosmicSpaceCamera, type SpaceCameraBlend } from "@/lib/cosmic-space-camera";
import { ringDragDelta, type homeStreamPose } from "@/lib/cosmic-experience";
import { homeStreamWorldPose } from "@/lib/cosmic-home-space";

interface Frame { center: Vector3; u: Vector3; v: Vector3; cardSize: number }
export interface RingCardProjection { x: number; y: number; scale: number; depth: number }

function ringFrame(blend: SpaceCameraBlend, width: number, height: number, cx: number, cy: number, rx: number, ry: number, size: number): Frame {
  const pose = cosmicSpaceCamera(blend);
  const view = new PerspectiveCamera(pose.fov, width / height, 0.1, 1000);
  view.position.set(...pose.position); view.lookAt(...pose.target); view.updateMatrixWorld();
  const focal = height / (2 * Math.tan(pose.fov * Math.PI / 360));
  const distance = 20, depthRatio = 0.28;
  const x = (cx - 0.5) * width / focal, y = (cy - 0.5) * height / focal;
  const a = rx * width / focal, b = ry * height / focal;
  const center = new Vector3(x * distance, (-y + b * depthRatio) * distance, -distance).applyMatrix4(view.matrixWorld);
  const u = new Vector3(a * distance * Math.sqrt(1 - depthRatio ** 2), 0, 0).applyQuaternion(view.quaternion);
  const v = new Vector3(-x * distance * depthRatio, (y * depthRatio - b) * distance, distance * depthRatio).applyQuaternion(view.quaternion);
  return { center, u, v, cardSize: size * distance / focal };
}

export const drawRingFrame = (width: number, height: number, continuous = false) => ringFrame({ ring: 1, reading: 0, summary: 0, ...(continuous ? { dive: 1 } : {}) }, width, height, 0.5, 0.6, 0.405, 0.18, 0.64);

/** World-space anchors share the backdrop camera; native card surfaces keep their CSS3D poses. */
export class CosmicRingSpace {
  readonly group = new Group();
  readonly anchors = Array.from({ length: 78 }, (_, anchor) => {
    const node = new Object3D();
    node.name = `tarot-anchor-${anchor}`;
    return node;
  });
  private width = 0;
  private height = 0;
  private continuous = false;
  private frames: Frame[] = [];
  private cardSize = 0;
  private readonly point = new Vector3();
  private readonly normal = new Vector3();
  private readonly inverse = new Matrix4();
  private readonly ray = new Raycaster();
  private readonly plane = new Plane();
  private readonly projected: RingCardProjection[] = this.anchors.map(() => ({ x: 0, y: 0, scale: 0, depth: 0 }));

  constructor(private readonly camera: PerspectiveCamera, scene: Scene) {
    this.group.name = "tarot-orbit";
    this.group.matrixAutoUpdate = false;
    this.group.add(...this.anchors);
    scene.add(this.group);
  }

  private frame(blend: SpaceCameraBlend, cx: number, cy: number, rx: number, ry: number, size: number): Frame {
    return ringFrame({ ...blend, ...(this.continuous ? { dive: 1 } : {}) }, this.width, this.height, cx, cy, rx, ry, size);
  }

  layout(blend: SpaceCameraBlend, width: number, height: number, rotation: number, homePoses?: readonly ReturnType<typeof homeStreamPose>[]): readonly RingCardProjection[] {
    if (width !== this.width || height !== this.height || this.continuous !== (blend.dive !== undefined)) {
      this.width = width; this.height = height;
      this.continuous = blend.dive !== undefined;
      this.frames = [
        this.frame({ ring: 1, reading: 0, summary: 0 }, 0.5, 0.6, 0.405, 0.18, 0.64),
        this.frame({ ring: 1, reading: 1, summary: 0 }, 0.34, 0.38, 0.34, 0.25, 0.83),
        this.frame({ ring: 1, reading: 1, summary: 1 }, 0.5, 0.45, 0.26, 0.18, 0.64),
      ];
    }
    const [draw, reading, summary] = this.frames;
    const center = draw.center.clone().lerp(reading.center, blend.reading).lerp(summary.center, blend.summary);
    const u = draw.u.clone().lerp(reading.u, blend.reading).lerp(summary.u, blend.summary);
    const v = draw.v.clone().lerp(reading.v, blend.reading).lerp(summary.v, blend.summary);
    this.normal.crossVectors(u, v).normalize();
    this.group.matrix.makeBasis(u, v, this.normal).setPosition(center);
    this.inverse.copy(this.group.matrix).invert();
    this.plane.setFromNormalAndCoplanarPoint(this.normal, center);
    this.cardSize = (draw.cardSize + (reading.cardSize - draw.cardSize) * blend.reading) * (1 - blend.summary) + summary.cardSize * blend.summary;
    const sizes = this.anchors.map((node, index) => {
      const angle = index / this.anchors.length * Math.PI * 2 + rotation;
      node.position.set(Math.cos(angle), Math.sin(angle), 0);
      if (!homePoses || blend.ring === 1) return this.cardSize;
      const home = homeStreamWorldPose(homePoses[index % homePoses.length], width, height);
      // Blend in world space, before the one shared camera projects either end of the journey.
      this.point.copy(node.position).applyMatrix4(this.group.matrix);
      node.position.copy(home.position.lerp(this.point, blend.ring)).applyMatrix4(this.inverse);
      return home.size + (this.cardSize - home.size) * blend.ring;
    });
    this.group.updateMatrixWorld(true);
    const focal = height / (2 * Math.tan(this.camera.fov * Math.PI / 360));
    this.anchors.forEach((node, index) => {
      node.getWorldPosition(this.point);
      const depth = -this.point.clone().applyMatrix4(this.camera.matrixWorldInverse).z;
      this.point.project(this.camera);
      Object.assign(this.projected[index], { x: (this.point.x + 1) * width / 2, y: (1 - this.point.y) * height / 2, scale: focal * sizes[index] / depth, depth: -depth });
    });
    return this.projected;
  }

  dragDelta(previous: { x: number; y: number }, next: { x: number; y: number }): number {
    const local = (screen: { x: number; y: number }) => {
      this.ray.setFromCamera(new Vector2(screen.x / this.width * 2 - 1, 1 - screen.y / this.height * 2), this.camera);
      const hit = this.ray.ray.intersectPlane(this.plane, new Vector3());
      return hit?.applyMatrix4(this.inverse);
    };
    const a = local(previous), b = local(next);
    return a && b ? ringDragDelta(a, b, { cx: 0, cy: 0, rx: 1, ry: 1 }) : 0;
  }

  /** A CSS homography places the decorative track on the same world plane as the anchors. */
  trackTransform(rotation: number): string {
    const local = new Matrix4().makeRotationZ(rotation * 0.15)
      .multiply(new Matrix4().makeScale(2.55 / 1000, 2.55 / 1000, 1))
      .multiply(new Matrix4().makeTranslation(-500, -500, 0));
    const viewport = new Matrix4().set(this.width / 2, 0, 0, this.width / 2, 0, -this.height / 2, 0, this.height / 2, 0, 0, 0, 0, 0, 0, 0, 1);
    const matrix = viewport.multiply(this.camera.projectionMatrix).multiply(this.camera.matrixWorldInverse).multiply(this.group.matrixWorld).multiply(local);
    return `matrix3d(${matrix.elements.join(",")})`;
  }

  dispose() { this.group.removeFromParent(); this.group.clear(); }
}
