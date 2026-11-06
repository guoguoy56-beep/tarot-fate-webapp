import { BufferGeometry, CubicBezierCurve3, ExtrudeGeometry, Group, Mesh, MeshBasicMaterial, Shape, ShapeGeometry, Vector3 } from "three";
import { homeCardStream, homeStreamPose } from "@/lib/cosmic-experience";
import { homeStreamWorldPose } from "@/lib/cosmic-home-space";
import { questionStreamBend, questionStreamTail } from "@/lib/cosmic-dive-path";
import type { CardOrientation, TarotCardData } from "@/types/tarot";

export interface CosmicDeckEntry { card: TarotCardData; orientation: CardOrientation }
export const spatialStream = { count: 78, durationMs: homeCardStream.durationMs * 78 / 36 } as const;

const cardHeight = 116 / 68, cardRadius = 0.075, cardThickness = 0.004;
const downwardPitch = -72 * Math.PI / 180;
const smoothStep = (value: number) => value * value * (3 - 2 * value);

function cardOutline() {
  // Follow the rounded gold frame of card-back-v2, leaving its printed border intact.
  const shape = new Shape(), x = 0.5, y = cardHeight / 2, r = cardRadius;
  shape.moveTo(-x + r, -y);
  shape.lineTo(x - r, -y); shape.absarc(x - r, -y + r, r, -Math.PI / 2, 0);
  shape.lineTo(x, y - r); shape.absarc(x - r, y - r, r, 0, Math.PI / 2);
  shape.lineTo(-x + r, y); shape.absarc(-x + r, y - r, r, Math.PI / 2, Math.PI);
  shape.lineTo(-x, -y + r); shape.absarc(-x + r, -y + r, r, Math.PI, Math.PI * 1.5);
  shape.closePath();
  return shape;
}

export function createCardFaceGeometry() {
  const geometry = new ShapeGeometry(cardOutline(), 8);
  const positions = geometry.getAttribute("position"), uv = geometry.getAttribute("uv");
  for (let index = 0; index < positions.count; index++) {
    uv.setXY(index, positions.getX(index) + 0.5, positions.getY(index) / cardHeight + 0.5);
  }
  return geometry;
}

export function createCardEdgeGeometry() {
  const geometry = new ExtrudeGeometry(cardOutline(), { depth: cardThickness, bevelEnabled: false, steps: 1, curveSegments: 8 });
  geometry.translate(0, 0, -cardThickness / 2);
  // Keep only the thin perimeter: caps would compete with the image surfaces at a distance.
  const normals = geometry.getAttribute("normal");
  geometry.setIndex(Array.from({ length: normals.count }, (_, vertex) => vertex).filter((vertex) => normals.getZ(vertex) === 0));
  geometry.clearGroups();
  return geometry;
}

function home(phase: number, width: number, height: number) {
  const pose = homeStreamPose(0, Math.min(phase, 0.99999999) * homeCardStream.durationMs, width / height);
  const world = homeStreamWorldPose(pose, width, height);
  return { position: world.position, size: world.size * 68, tilt: -pose.tilt * Math.PI / 180, pitch: 0 };
}

let cachedPath: { width: number; height: number; curves: CubicBezierCurve3[]; size: number; tilt: number } | undefined;
function continuation(width: number, height: number) {
  if (cachedPath?.width === width && cachedPath.height === height) return cachedPath;
  const exit = home(1, width, height);
  const tangent = exit.position.clone().sub(home(1 - 0.0001, width, height).position).divideScalar(0.0001);
  // Fixed world anchors trace the guide's shallow trough, crest and left-hand exit.
  // Shared tangents keep the cards moving smoothly across all three segments.
  const first = new Vector3(18.6162, -30.8645, 39.9415);
  const end = new Vector3(166.8064, -107.5271, 37.8373);
  const firstTangent = new Vector3(10.9341, -10.6822, 20.6788);
  const curves = [
    new CubicBezierCurve3(exit.position, exit.position.clone().addScaledVector(tangent, 1 / 9), first.clone().addScaledVector(firstTangent, -1 / 3), first),
    questionStreamBend,
    questionStreamTail,
    // Recycle only after the distant card has diminished to a point. The return is outside the composition.
    new CubicBezierCurve3(end, new Vector3(350, -250, 180), home(0, width, height).position.clone().add(new Vector3(120, 100, -70)), home(0, width, height).position),
  ];
  return cachedPath = { width, height, curves, size: exit.size, tilt: exit.tilt };
}

/** One world path from the nebula through the home foreground and onward into the distance. */
export function spatialStreamPose(index: number, elapsedMs: number, width: number, height: number) {
  const slot = ((index + elapsedMs / spatialStream.durationMs * 78) % 78 + 78) % 78;
  if (slot < 36) return home(slot / 36, width, height);
  const path = continuation(width, height);
  if (slot < 72) {
    const progress = (slot - 36) / 36;
    const segment = Math.min(2, Math.floor(progress * 3)), t = progress * 3 - segment;
    const disappear = Math.max(0, (progress - 0.94) / 0.06);
    const size = path.size * (1 - smoothStep(disappear));
    const straighten = Math.min(1, progress / 0.35);
    // Start pitching one third into the outgoing path; the front normal turns toward -Y.
    const pitch = downwardPitch * smoothStep(Math.max(0, (progress - 1 / 3) / (2 / 3)));
    return { position: path.curves[segment].getPoint(t), size, tilt: path.tilt * (1 - smoothStep(straighten)), pitch };
  }
  const t = (slot - 72) / 6;
  const source = home(0, width, height), reset = smoothStep(t);
  return { position: path.curves[3].getPoint(t), size: source.size * t ** 4, tilt: source.tilt * reset, pitch: downwardPitch * (1 - reset) };
}

/** Separate outward-facing surfaces reveal their actual side as the card or camera moves. */
export function createDoubleSidedCard(faceGeometry: BufferGeometry, edgeGeometry: BufferGeometry,
  backMaterial: MeshBasicMaterial, frontMaterial: MeshBasicMaterial, edgeMaterial: MeshBasicMaterial) {
  const card = new Group();
  const back = new Mesh(faceGeometry, backMaterial); back.name = "back"; back.position.z = cardThickness / 2;
  const front = new Mesh(faceGeometry, frontMaterial); front.name = "front";
  front.position.z = -cardThickness / 2; front.rotation.y = Math.PI;
  const edge = new Mesh(edgeGeometry, edgeMaterial); edge.name = "edge";
  card.add(edge, back, front);
  return card;
}
