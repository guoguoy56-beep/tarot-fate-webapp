import { Vector3 } from "three";

/** Direction of a sky point: bearing 0 looks down -Z (home view), +90 toward +X; elevation up is positive. */
export function skyDirection(bearing: number, elevation: number) {
  const b = bearing * Math.PI / 180, e = elevation * Math.PI / 180;
  return new Vector3(Math.sin(b) * Math.cos(e), Math.sin(e), -Math.cos(b) * Math.cos(e));
}

/**
 * Tilted pole of the Colossal Blue Milky Way:
 * Using a tilted pole (-0.14, 0.975, -0.17) and a southern small-circle latitude (-0.23 rad)
 * makes the Milky Way sweep diagonally from lower-left to mid-right in the Home view (matching Image 2),
 * and naturally dip to -26°..-36° in the Reverse/Question view so the upper sky stays deep midnight-black
 * in every stage.
 */
export const galacticPole = new Vector3(-0.14, 0.975, -0.17).normalize();
export const galacticRef = new Vector3(0, 0, -1).sub(galacticPole.clone().multiplyScalar(-galacticPole.z)).normalize();
export const galacticEast = new Vector3().crossVectors(galacticPole, galacticRef).normalize();
export const galacticCenterLat = -0.23;

/** Smooth density modulation along the Colossal Blue Milky Way spine. */
export function milkyWayClump(lon: number, latOffset: number) {
  return 0.58 + 0.42 * Math.sin(lon * 2 + 0.5) * Math.cos(lon * 3 - latOffset * 9 + 0.9);
}

/**
 * Open star clusters (群星 / 疏散星团) naturally embedded along the Colossal Blue Milky Way
 * and its calm borders — rendered as organic pinpoint condensations rather than blob sprites.
 */
export const starCloudRegions = [
  { at: [-15, -15], spread: 0.055, stars: 52, blueBias: 0.84, angle: -0.32 },
  { at: [19, -17], spread: 0.060, stars: 56, blueBias: 0.86, angle: -0.24 },
  { at: [50, -19], spread: 0.058, stars: 54, blueBias: 0.85, angle: 0.20 },
  { at: [84, -21], spread: 0.052, stars: 46, blueBias: 0.82, angle: 0.25 },
  { at: [118, -24], spread: 0.054, stars: 48, blueBias: 0.84, angle: -0.22 },
  { at: [148, -16], spread: 0.058, stars: 54, blueBias: 0.86, angle: -0.28 },
  { at: [168, -19], spread: 0.062, stars: 58, blueBias: 0.85, angle: -0.20 },
  { at: [66, -28], spread: 0.055, stars: 50, blueBias: 0.84, angle: 0.28 },
  { at: [72, -46], spread: 0.055, stars: 48, blueBias: 0.84, angle: 0.28 },
] as const;

/**
 * Standout jewel-like beacon stars (matching the sparse standout stars in the 2nd reference image:
 * one primary ice-blue jewel star near the center, a few crisp secondary blue-white stars, and 1–2 warm stars).
 */
export const jewelStars = [
  // Home view
  { at: [-3, -2], size: 17.5, light: 1.42, color: [0.66, 0.84, 1.0] },
  { at: [14, 8], size: 10.5, light: 1.02, color: [0.72, 0.88, 1.0] },
  { at: [20, 19], size: 8.8, light: 0.88, color: [0.76, 0.90, 1.0] },
  { at: [-19, -15], size: 9.8, light: 0.94, color: [0.78, 0.90, 1.0] },
  { at: [-27, -18], size: 9.2, light: 0.90, color: [1.0, 0.78, 0.54] },
  { at: [11, -21], size: 9.5, light: 0.92, color: [0.74, 0.88, 1.0] },
  // Reverse turn (bearing 50..120)
  { at: [74, -14], size: 16.0, light: 1.32, color: [0.66, 0.84, 1.0] },
  { at: [98, -22], size: 10.5, light: 0.96, color: [0.76, 0.90, 1.0] },
  { at: [116, -10], size: 9.0, light: 0.86, color: [1.0, 0.82, 0.60] },
  // Question / Reverse view (bearing ~166, elev ~ -28)
  { at: [160, -22], size: 17.0, light: 1.38, color: [0.66, 0.84, 1.0] },
  { at: [178, -14], size: 10.2, light: 0.98, color: [0.74, 0.88, 1.0] },
  { at: [142, -34], size: 9.8, light: 0.92, color: [1.0, 0.80, 0.56] },
  { at: [186, -36], size: 9.5, light: 0.90, color: [0.76, 0.90, 1.0] },
  // Dive & Ring / Reading / Summary views (bearing ~35..80)
  { at: [48, -12], size: 16.5, light: 1.35, color: [0.66, 0.84, 1.0] },
  { at: [32, -20], size: 10.2, light: 0.95, color: [0.76, 0.90, 1.0] },
  { at: [64, -28], size: 9.8, light: 0.92, color: [1.0, 0.80, 0.56] },
  { at: [78, -48], size: 15.0, light: 1.25, color: [0.70, 0.88, 1.0] },
] as const satisfies readonly {
  at: readonly [number, number];
  size: number;
  light: number;
  color: readonly [number, number, number];
}[];

export const starMiniClusters = [
  [-16, 12], [8, 14], [-10, -14], [22, -12],
  [146, -16], [174, -26], [192, -18],
  [64, -34], [88, -44], [42, -18], [58, -28],
] as const satisfies readonly (readonly [number, number])[];

/** Soft, low-contrast slate-blue volumetric mist banks embedded inside the Colossal Blue Milky Way. */
export const skyNebulae = [
  { at: [14, -14], scale: [195, 58, 120], rotation: [0.15, -0.25, -0.18], tint: "#0d1f38", tint2: "#1d385c", seed: 1.3 },
  { at: [160, -30], scale: [195, 58, 120], rotation: [-0.18, 0.25, 0.20], tint: "#0d1f38", tint2: "#1d385c", seed: 3.9 },
  { at: [54, -22], scale: [200, 60, 125], rotation: [0.16, 0.20, -0.16], tint: "#0d1f38", tint2: "#1d385c", seed: 6.2 },
] as const;

export const skyNebulaDistance = 650;
