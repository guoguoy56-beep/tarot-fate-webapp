import { Matrix4, type PerspectiveCamera } from "three";
import { cardBackClipMatrix, type CardBackProjection } from "@/lib/cosmic-card-back-projection";

/** Match the complete entry surface to its selectable CSS projection, including off-axis perspective. */
export function ringHandoffMatrix(sourceModelMatrix: Matrix4, target: CardBackProjection, camera: PerspectiveCamera, width: number, height: number, progress: number) {
  const sourceClip = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(sourceModelMatrix);
  const targetClip = cardBackClipMatrix(target, width, height);
  // Equivalent homogeneous matrices need the same normalization before their entries can be blended.
  sourceClip.multiplyScalar(1 / sourceClip.elements[15]);
  targetClip.multiplyScalar(1 / targetClip.elements[15]);
  const t = Math.max(0, Math.min(1, progress));
  const blend = t ** 3 * (t * (6 * t - 15) + 10);
  sourceClip.elements.forEach((value, index, elements) => {
    elements[index] = value + (targetClip.elements[index] - value) * blend;
  });
  return new Matrix4().multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse).multiply(sourceClip);
}
