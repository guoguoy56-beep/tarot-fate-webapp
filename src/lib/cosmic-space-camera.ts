export interface SpaceCameraBlend { ring: number; reading: number; summary: number; reverse?: number }

export const reverseCameraDurationMs = 3600;
export const questionCamera = { position: [-9, -5, 32], target: [11, -22, 66], fov: 50 } as const;

export function cameraTravelProgress(elapsed: number) {
  const t = Math.max(0, Math.min(1, elapsed / reverseCameraDurationMs));
  return t * t * t * (t * (6 * t - 15) + 10);
}

/** One world-space camera follows the existing scene clock, including interrupted transitions. */
export function cosmicSpaceCamera(blend: SpaceCameraBlend): { position: readonly [number, number, number]; target: readonly [number, number, number]; fov: number } {
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  const ring = clamp(blend.ring), reading = clamp(blend.reading), summary = clamp(blend.summary);
  const arc = Math.sin(Math.PI * ring) * (1 - reading);
  const reverse = clamp(blend.reverse ?? 0);
  if (reverse > 0) {
    // Rotate the viewing direction, rather than lerping opposing look-at targets through zero.
    // Positive X is a rightward look from the home camera; the station moves diagonally down/left.
    const yaw = Math.atan2(20, -34) * reverse;
    const pitch = Math.atan2(-17, Math.hypot(20, 34)) * reverse;
    const position = [-9 * reverse, -5 * reverse, 24 + 8 * reverse] as const;
    // Temporary bridge to the established downstream camera; ordered entry replaces this in step 3.
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
