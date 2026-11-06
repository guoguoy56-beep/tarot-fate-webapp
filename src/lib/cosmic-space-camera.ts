import { Matrix4, PerspectiveCamera, Quaternion, Vector3 } from "three";
import { cameraEyePoint, diveGuidePoint, diveStation } from "@/lib/cosmic-dive-path";

export interface SpaceCameraBlend { ring: number; reading: number; summary: number; reverse?: number; dive?: number }

export const reverseCameraDurationMs = 3600;
export const questionCamera = { position: [16, -9.5, -6], target: [26, -33, 36], fov: 50 } as const;

const stationMatrix = (position: readonly number[], target: readonly number[]) => {
  const view = new PerspectiveCamera();
  view.position.set(position[0], position[1], position[2]); view.lookAt(target[0], target[1], target[2]); view.updateMatrixWorld();
  return view.matrixWorld;
};
// Move the established reading/summary space downstream as a rigid whole, retaining its framing.
const downstream = new Matrix4().multiplyMatrices(stationMatrix(diveStation.position, diveStation.target), stationMatrix([4, 1, 6], [1, -1, -36]).invert());
const questionHeading = new Quaternion().setFromRotationMatrix(stationMatrix(questionCamera.position, questionCamera.target));
const ringHeading = new Quaternion().setFromRotationMatrix(stationMatrix(diveStation.position, diveStation.target));

function diveCamera(t: number) {
  const smooth = (value: number) => { const x = Math.max(0, Math.min(1, value)); return x * x * (3 - 2 * x); };
  const eye = cameraEyePoint(t), guide = diveGuidePoint(t);
  const y = 0.7 - 0.4 * smooth((t - 0.1) / 0.65), tangent = Math.tan(25 * Math.PI / 180);
  const ray = new Vector3(-0.54 * tangent * 16 / 9, (1 - 2 * y) * tangent, -1).normalize();
  // Solve yaw/pitch with world-up intact: a lookAt camera does not retain quaternion roll.
  const direction = guide.clone().sub(eye).normalize(), depth = -ray.z;
  const pitch = Math.asin(Math.max(-1, Math.min(1, direction.y / Math.hypot(depth, ray.y)))) - Math.atan2(ray.y, depth);
  const yaw = Math.atan2(direction.x, -direction.z) - Math.atan2(ray.x, depth * Math.cos(pitch) - ray.y * Math.sin(pitch));
  const forward = new Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  const view = new PerspectiveCamera(50); view.position.copy(eye); view.lookAt(eye.clone().add(forward)); view.updateMatrixWorld();
  const heading = view.quaternion.clone();
  heading.slerpQuaternions(questionHeading, heading.clone(), smooth(t / 0.14));
  heading.slerp(ringHeading, smooth((t - 0.8) / 0.2));
  const target = eye.clone().add(new Vector3(0, 0, -40).applyQuaternion(heading));
  return { position: eye.toArray() as [number, number, number], target: target.toArray() as [number, number, number], fov: 50 };
}

export function cameraTravelProgress(elapsed: number) {
  const t = Math.max(0, Math.min(1, elapsed / reverseCameraDurationMs));
  return t * t * t * (t * (6 * t - 15) + 10);
}

/** One world-space camera follows the existing scene clock, including interrupted transitions. */
export function cosmicSpaceCamera(blend: SpaceCameraBlend): { position: readonly [number, number, number]; target: readonly [number, number, number]; fov: number } {
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  if (blend.dive !== undefined) {
    const dive = clamp(blend.dive);
    if (dive < 1) return diveCamera(dive);
    const base = cosmicSpaceCamera({ ...blend, dive: undefined, reverse: 0 });
    return { position: new Vector3(...base.position).applyMatrix4(downstream).toArray() as [number, number, number],
      target: new Vector3(...base.target).applyMatrix4(downstream).toArray() as [number, number, number], fov: base.fov };
  }
  const ring = clamp(blend.ring), reading = clamp(blend.reading), summary = clamp(blend.summary);
  const arc = Math.sin(Math.PI * ring) * (1 - reading);
  const reverse = clamp(blend.reverse ?? 0);
  if (reverse > 0) {
    // Rotate the viewing direction, rather than lerping opposing look-at targets through zero.
    // Positive X is a rightward look from the home camera, following the outgoing foreground stream.
    const yaw = Math.atan2(10, -42) * Math.sin(reverse * Math.PI / 2);
    const pitch = Math.atan2(-23.5, Math.hypot(10, 42)) * reverse ** 2;
    const t = reverse, u = 1 - t;
    // Move forward/down to the doorway-side station, bowing left of the foreground cards.
    const position = [3 * u * u * t * -7 + 3 * u * t * t * -5 + t ** 3 * 16,
      3 * u * u * t * -1 + 3 * u * t * t * -9 + t ** 3 * -9.5,
      u ** 3 * 24 + 3 * u * u * t * 18 + t ** 3 * -6] as const;
    // Legacy/fallback interpolation; the continuous dive uses the path above.
    const base = cosmicSpaceCamera({ ...blend, reverse: 0 });
    const weight = 1 - ring;
    const point = base.position.map((value, axis) => value * ring + position[axis] * weight) as [number, number, number];
    const dx = base.target[0] - base.position[0], dy = base.target[1] - base.position[1], dz = base.target[2] - base.position[2];
    const heading = yaw * weight + Math.atan2(dx, -dz) * ring;
    const elevation = pitch * weight + Math.atan2(dy, Math.hypot(dx, dz)) * ring;
    return { position: point, target: [point[0] + Math.sin(heading) * Math.cos(elevation) * 40,
      point[1] + Math.sin(elevation) * 40, point[2] - Math.cos(heading) * Math.cos(elevation) * 40] as const, fov: base.fov };
  }
  return {
    position: [4 * ring + 20 * reading - 9 * summary + 4 * arc, ring + 2 * reading + 4 * summary + 1.5 * arc, 24 - 18 * ring - 14 * reading + 11 * summary] as const,
    target: [ring + 27 * reading - 12 * summary, -ring - 9 * reading + 9 * summary, -36] as const,
    fov: 50 - 8 * reading + 5 * summary,
  };
}

/** Original 6% overscan and 1.12 home scale, expressed as a stationary world-space image. */
export function cosmicPanoramaFrame(aspect: number) {
  const viewHeight = 2 * 60 * Math.tan(25 * Math.PI / 180);
  const viewWidth = viewHeight * aspect;
  const height = Math.max(viewHeight, viewWidth / (1672 / 941)) * 1.2544;
  return { width: height * 1672 / 941, height, x: -viewWidth * 0.0336, y: viewHeight * 0.0336, z: -36 };
}
