import { BoxGeometry, CubicBezierCurve3, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry, Vector3 } from "three";
import { homeCardStream, homeStreamPose } from "@/lib/cosmic-experience";
import { homeStreamWorldPose } from "@/lib/cosmic-home-space";
import { questionCamera } from "@/lib/cosmic-space-camera";
import type { CardOrientation, TarotCardData } from "@/types/tarot";

export interface CosmicDeckEntry { card: TarotCardData; orientation: CardOrientation }
export const spatialStream = { count: 78, durationMs: homeCardStream.durationMs * 78 / 36 } as const;

const reference = new PerspectiveCamera(questionCamera.fov);
reference.position.set(...questionCamera.position); reference.lookAt(...questionCamera.target); reference.updateMatrixWorld();
const questionRight = new Vector3(1, 0, 0).applyQuaternion(reference.quaternion);
const questionUp = new Vector3(0, 1, 0).applyQuaternion(reference.quaternion);

function home(phase: number, width: number, height: number) {
  const pose = homeStreamPose(0, Math.min(phase, 0.99999999) * homeCardStream.durationMs, width / height);
  const world = homeStreamWorldPose(pose, width, height);
  return { position: world.position, size: world.size * 68, tilt: -pose.tilt * Math.PI / 180 };
}

function question(phase: number, aspect: number) {
  const p = 0.3 * phase + 0.7 * phase ** 2;
  // Two gentle bends, fixed in world space using the question camera as a composition reference.
  // The active camera never participates in this calculation or in a card's orientation.
  const points = p < 0.5
    ? [[0.86, 0.27], [0.70, 0.34], [0.26, 0.36], [0.40, 0.67]]
    : [[0.40, 0.67], [0.54, 0.98], [-0.02, 0.97], [-0.20, 1.65]];
  const t = p < 0.5 ? p * 2 : (p - 0.5) * 2, u = 1 - t;
  const value = (axis: number) => u ** 3 * points[0][axis] + 3 * u ** 2 * t * points[1][axis] + 3 * u * t ** 2 * points[2][axis] + t ** 3 * points[3][axis];
  const distance = 90 - 80 * p, view = 2 * Math.tan(questionCamera.fov * Math.PI / 360) * distance;
  const position = new Vector3((value(0) - 0.5) * view * aspect, (0.5 - value(1)) * view, -distance).applyMatrix4(reference.matrixWorld);
  return { position, size: 2.2, tilt: (8 - 35 * p * p) * Math.PI / 180 };
}

/** A single circulating queue: home leg → offscreen bend → reverse-view leg → return bend. */
export function spatialStreamPose(index: number, elapsedMs: number, width: number, height: number) {
  const slot = ((index + elapsedMs / spatialStream.durationMs * 78) % 78 + 78) % 78;
  if (slot < 36) return home(slot / 36, width, height);
  if (slot >= 39 && slot < 75) return question((slot - 39) / 36, width / height);
  const outgoing = slot < 39;
  const a = outgoing ? home(1, width, height) : question(1, width / height);
  const b = outgoing ? question(0, width / height) : home(0, width, height);
  const t = (slot - (outgoing ? 36 : 75)) / 3;
  const curve = new CubicBezierCurve3(a.position,
    outgoing ? a.position.clone().addScaledVector(questionRight, 140).addScaledVector(questionUp, -65)
      : a.position.clone().addScaledVector(questionRight, -140).addScaledVector(questionUp, -100),
    outgoing ? b.position.clone().addScaledVector(questionRight, 85).addScaledVector(questionUp, 40)
      : b.position.clone().add(new Vector3(100, 100, -60)), b.position);
  return { position: curve.getPoint(t), size: a.size + (b.size - a.size) * t, tilt: a.tilt + (b.tilt - a.tilt) * t };
}

/** Separate outward-facing surfaces: camera position alone determines which side is visible. */
export function createDoubleSidedCard(faceGeometry: PlaneGeometry, edgeGeometry: BoxGeometry,
  backMaterial: MeshBasicMaterial, frontMaterial: MeshBasicMaterial, edgeMaterial: MeshBasicMaterial) {
  const card = new Group();
  const back = new Mesh(faceGeometry, backMaterial); back.name = "back"; back.position.z = 0.012;
  const front = new Mesh(faceGeometry, frontMaterial); front.name = "front";
  front.position.z = -0.012; front.rotation.y = Math.PI;
  const edge = new Mesh(edgeGeometry, edgeMaterial); edge.name = "edge";
  card.add(edge, back, front);
  return card;
}
