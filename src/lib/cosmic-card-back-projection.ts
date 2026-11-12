import { Matrix4 } from "three";

export interface CardBackProjection {
  x: number; y: number; scale: number; yaw: number; tilt: number; perspective: number; order: number;
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
