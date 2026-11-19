import { Matrix4 } from "three";

export interface CardBackProjection {
  x: number; y: number; scale: number; yaw: number; tilt: number; perspective: number; order: number;
}

export interface CardSurfaceProjection extends CardBackProjection {
  anchor: number;
  transform?: readonly number[];
  glow?: boolean;
}

/** Match the native card's centered CSS transform without changing its hit area. */
export function cardBackClipMatrix(pose: CardBackProjection, width: number, height: number) {
  const perspective = new Matrix4();
  perspective.elements[11] = -1 / pose.perspective;
  return new Matrix4().set(2 / width, 0, 0, -1, 0, -2 / height, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1)
    .multiply(new Matrix4().makeTranslation(pose.x, pose.y, 0))
    .multiply(perspective)
    .multiply(new Matrix4().makeRotationY(pose.yaw * Math.PI / 180))
    .multiply(new Matrix4().makeRotationZ(pose.tilt * Math.PI / 180))
    .multiply(new Matrix4().makeScale(68 * pose.scale, -68 * pose.scale, 1));
}

/** CSS pose/flip matrices act inside the card's outer scale, in CSS pixels. */
export function cardSurfaceClipMatrix(pose: CardSurfaceProjection, width: number, height: number) {
  const matrix = cardBackClipMatrix({ ...pose, scale: 1 }, width, height)
    .multiply(new Matrix4().makeScale(1 / 68, -1 / 68, 1))
    .multiply(new Matrix4().makeScale(pose.scale, pose.scale, 1));
  if (pose.transform) matrix.multiply(new Matrix4().fromArray(pose.transform));
  return matrix.multiply(new Matrix4().makeScale(68, -68, 1));
}

/** Projected surfaces are flat in clip Z; decide their side before numerical world-matrix determinants. */
export function cardSurfaceShowsBack(matrix: Matrix4) {
  const m = matrix.elements, w = m[15];
  return (m[0] * w - m[12] * m[3]) * (m[5] * w - m[13] * m[7])
    - (m[4] * w - m[12] * m[7]) * (m[1] * w - m[13] * m[3]) >= 0;
}
