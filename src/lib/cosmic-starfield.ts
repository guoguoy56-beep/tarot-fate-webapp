import { BufferGeometry, CustomBlending, Float32BufferAttribute, OneFactor, Points, ShaderMaterial, Vector3 } from "three";
import { cameraEyePoint } from "@/lib/cosmic-dive-path";
import {
  galacticCenterLat,
  galacticEast,
  galacticPole,
  galacticRef,
  jewelStars,
  milkyWayClump,
  skyDirection,
} from "@/lib/cosmic-sky-catalog";

/**
 * Starfield modeled after the 2nd reference image (wide-field blue Milky Way astrophotography):
 * - 95%+ of stars are ultra-fine 1–2.8px pinpoints forming a delicate, vast night sky and dense Milky Way star-sand
 * - A small number of crisp secondary stars (3.5–6.5px)
 * - Only 1–2 standout ice-blue jewel stars (15–19px soft sapphire glow around a tight white core) per viewport
 */
export function createCosmicStarfield(pixelRatio: number) {
  let seed = 271828;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const gaussian = () => (random() + random() + random() + random() - 2) * 0.75;

  const positions: number[] = [];
  const sizes: number[] = [];
  const lights: number[] = [];
  const phases: number[] = [];
  const colors: number[] = [];
  const parallax: number[] = [];

  const pickFieldColor = (blueWeight: number): readonly [number, number, number] => {
    const roll = random();
    if (roll < blueWeight) {
      return random() < 0.55 ? [0.68, 0.84, 1.0] : [0.80, 0.90, 1.0];
    }
    if (roll < blueWeight + 0.14) {
      return [1.0, 0.80, 0.58];
    }
    return [0.92, 0.95, 1.0];
  };

  const pushStar = (pos: Vector3, layerParallax: number, size: number, light: number, color: readonly [number, number, number]) => {
    positions.push(pos.x, pos.y, pos.z);
    parallax.push(layerParallax);
    sizes.push(size);
    lights.push(light);
    // Only a subset of distant (layerParallax === 0) and smaller (size < 3.6) stars twinkle;
    // nearer stars and larger/jewel stars stay steady.
    const canTwinkle = layerParallax === 0 && size < 3.6 && random() < 0.6;
    const phaseOffset = random() * Math.PI * 2;
    const angularSpeed = canTwinkle ? (Math.PI * 2 * 1.8) / (1.35 + random() * 2.4) : 0;
    const twinkleDepth = canTwinkle ? 0.82 + random() * 0.16 : 0;
    phases.push(phaseOffset, angularSpeed, twinkleDepth);
    colors.push(color[0], color[1], color[2]);
  };

  // 1. Calm, sparse all-sky background & route parallax stars (mostly fine 1.4–2.8px pinpoints, upper sky sparser)
  for (const [farCount, middleCount, nearCount] of [[900, 160, 40], [500, 90, 20], [750, 130, 35]]) {
    for (let index = 0; index < farCount + middleCount + nearCount; index++) {
      const layer = index < farCount ? 0 : index < farCount + middleCount ? 1 : 2;
      const y = random() * 2 - 1;
      const azimuth = random() * Math.PI * 2;
      const distance = random();
      const ring = Math.sqrt(1 - y * y);
      const dir = new Vector3(ring * Math.cos(azimuth), y, ring * Math.sin(azimuth));

      // Upper sky is calmer and sparser, just like the upper half of the 2nd reference image
      if (layer === 0 && y > 0.08 && random() < 0.52) {
        continue;
      }

      const radius = layer === 0 ? 800 + distance * 120 : layer === 1 ? 300 + distance * 160 : 85 + distance * 90;
      const center =
        layer === 0
          ? null
          : cameraEyePoint(layer === 1 ? (index - farCount) / middleCount : (index - farCount - middleCount) / nearCount);
      const pos = new Vector3(dir.x * radius + (center?.x ?? 0), dir.y * radius + (center?.y ?? 0), dir.z * radius + (center?.z ?? 0));

      const tier = random();
      const size = tier < 0.92 ? 1.4 + random() * 1.4 : tier < 0.99 ? 3.2 + random() * 2.4 : 6.2 + random() * 2.6;
      const light = tier < 0.92 ? 0.18 + random() * 0.24 : tier < 0.99 ? 0.46 + random() * 0.24 : 0.76 + random() * 0.20;
      pushStar(pos, layer === 0 ? 0 : 1, size, light, pickFieldColor(0.58));
    }
  }

  // 2. Dense carpet of fine pinpoint stars embedded along the Colossal Blue Milky Way (aligned with the tilted galactic frame)
  for (let i = 0; i < 4200; i++) {
    const lon = (random() * 2 - 1) * Math.PI;
    const meander = 0.035 * Math.sin(lon * 2 + 0.4);
    // Asymmetric spread matching the shader: tighter toward the dark upper sky, wider into the lower blue band
    const rawGauss = gaussian();
    const beltScale = rawGauss > 0 ? (i % 3 === 0 ? 0.065 : 0.13) : (i % 3 === 0 ? 0.10 : 0.24);
    const latOffset = rawGauss * beltScale;
    if (random() > 0.25 + 0.75 * milkyWayClump(lon, latOffset)) {
      continue;
    }

    // Carve out a subtle dark dust lane near the center of the spine so star-sand matches the shader's dust rift
    if (Math.abs(latOffset + 0.025) < 0.024 && random() < 0.58) {
      continue;
    }

    const gLat = Math.max(-1.48, Math.min(1.48, galacticCenterLat + meander + latOffset));
    const cosL = Math.cos(gLat);
    const sinL = Math.sin(gLat);
    const dir = galacticRef
      .clone()
      .multiplyScalar(Math.cos(lon) * cosL)
      .addScaledVector(galacticEast, Math.sin(lon) * cosL)
      .addScaledVector(galacticPole, sinL)
      .normalize();
    const radius = 810 + random() * 105;

    const tier = random();
    const size = tier < 0.945 ? 1.25 + random() * 1.4 : tier < 0.993 ? 3.0 + random() * 2.1 : 5.6 + random() * 2.4;
    const light = tier < 0.945 ? 0.18 + random() * 0.28 : tier < 0.993 ? 0.48 + random() * 0.26 : 0.76 + random() * 0.22;
    pushStar(dir.multiplyScalar(radius), 0, size, light, pickFieldColor(0.74));
  }

  // 3. Curated jewel beacon stars & crisp secondary stars (matching the sparse standout stars in Image 2)
  for (const jewel of jewelStars) {
    const dir = skyDirection(jewel.at[0], jewel.at[1]);
    pushStar(dir.multiplyScalar(840), 0, jewel.size, jewel.light, jewel.color);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("size", new Float32BufferAttribute(sizes, 1));
  geometry.setAttribute("light", new Float32BufferAttribute(lights, 1));
  geometry.setAttribute("phase", new Float32BufferAttribute(phases, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setAttribute("parallax", new Float32BufferAttribute(parallax, 1));

  const material = new ShaderMaterial({
    uniforms: { time: { value: 0 }, pixelRatio: { value: pixelRatio } },
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: OneFactor,
    blendSrcAlpha: OneFactor,
    blendDstAlpha: OneFactor,
    vertexShader: `
      uniform float time, pixelRatio;
      attribute float size, light, parallax;
      attribute vec3 phase;
      varying float intensity, vSize;
      varying vec3 tint;
      void main() {
        vec4 view = parallax < 0.5
          ? vec4(mat3(viewMatrix) * position, 1.0)
          : modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * view;
        float perspectiveSize = mix(1.0, clamp(320.0 / max(1.0, -view.z), 0.85, 1.25), parallax);
        float wave = 0.5 + 0.5 * sin(time * phase.y + phase.x);
        float shimmer = 0.5 + 0.5 * sin(time * phase.y * 2.13 + phase.x * 1.73 + 1.2);
        float sparkle = pow(wave, 1.55) * (0.68 + 0.32 * shimmer);
        float sizePulse = mix(1.0, mix(0.84, 1.28, sparkle), phase.z);
        vSize = min(size * perspectiveSize * sizePulse, 22.0);
        gl_PointSize = vSize * pixelRatio;
        float twinkleFactor = mix(1.0, mix(0.08, 2.05, sparkle), phase.z);
        intensity = light * twinkleFactor;
        intensity *= mix(1.0, smoothstep(28.0, 64.0, length(view.xyz)), parallax);
        tint = color;
      }
    `,
    fragmentShader: `
      varying float intensity, vSize;
      varying vec3 tint;
      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float radius = length(uv) * 2.0;
        if (radius > 1.0) discard;

        // Small stars (< 4px) stay crisp pinpoints; jewel stars (10–20px) get a tight white core + soft sapphire halo
        float isJewel = smoothstep(5.0, 14.0, vSize);
        float coreFalloff = mix(6.5, 32.0, isJewel);
        float core = exp(-coreFalloff * radius * radius);
        float corona = exp(-10.5 * radius * radius) * isJewel;
        float halo = exp(-3.5 * radius * radius) * smoothstep(1.0, 0.45, radius) * isJewel;

        float whiteMix = clamp(core * (0.65 + 0.32 * isJewel) + corona * 0.25, 0.0, 1.0);
        vec3 starColor = mix(tint, vec3(0.98, 0.99, 1.0), whiteMix);
        float energy = (core * 1.15 + corona * 0.48 + halo * 0.28) * intensity;

        gl_FragColor = vec4(starColor * energy, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });

  const stars = new Points(geometry, material);
  // The far layer moves with the camera in the shader, outside the CPU geometry bounds.
  stars.frustumCulled = false;
  return stars;
}
