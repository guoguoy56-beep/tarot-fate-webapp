export interface SpaceCameraBlend { ring: number; reading: number; summary: number }

/** One world-space camera follows the existing scene clock, including interrupted transitions. */
export function cosmicSpaceCamera(blend: SpaceCameraBlend) {
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  const ring = clamp(blend.ring), reading = clamp(blend.reading), summary = clamp(blend.summary);
  const arc = Math.sin(Math.PI * ring) * (1 - reading);
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
