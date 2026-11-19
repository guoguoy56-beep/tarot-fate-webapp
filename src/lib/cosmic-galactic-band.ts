import { CustomBlending, DoubleSide, Mesh, OneFactor, Scene, ShaderMaterial, SphereGeometry } from "three";
import { galacticCenterLat, galacticEast, galacticPole, galacticRef } from "@/lib/cosmic-sky-catalog";

const skyRadius = 880;

/**
 * Colossal Soft Blue Milky Way (巨型柔光蓝色银河):
 * - Uses the tilted galactic small-circle frame so the band sweeps diagonally across the lower half
 *   of the Home view (matching Image 2), continues unbroken across the 3.6s Reverse turn, and sits
 *   in the lower half of the Question and Ring views while keeping the upper sky deep midnight-black.
 * - Calibrated in linear space before sRGB conversion so the rendered tones match Image 2's
 *   deep nocturnal midnight-navy (#040811) -> dusty sapphire (#162844) -> silvery-blue cloud crests (#3a5272).
 */
export function createCosmicGalacticBand(scene: Scene) {
  const geometry = new SphereGeometry(1, 64, 32);
  const material = new ShaderMaterial({
    uniforms: {
      pole: { value: galacticPole.clone() },
      refAxis: { value: galacticRef.clone() },
      eastAxis: { value: galacticEast.clone() },
      centerLat: { value: galacticCenterLat },
      time: { value: 0 },
    },
    side: DoubleSide,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: OneFactor,
    blendSrcAlpha: OneFactor,
    blendDstAlpha: OneFactor,
    vertexShader: `
      varying vec3 worldDir;
      void main() {
        worldDir = normalize(position);
        vec3 viewPosition = mat3(viewMatrix) * (worldDir * ${skyRadius}.0);
        gl_Position = projectionMatrix * vec4(viewPosition, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 pole, refAxis, eastAxis;
      uniform float centerLat, time;
      varying vec3 worldDir;

      float hash3(vec3 p) {
        p = fract(p * vec3(0.1031, 0.1030, 0.0973));
        p += dot(p, p.yxz + 33.33);
        return fract((p.x + p.y) * p.z);
      }

      float noise3(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(hash3(i + vec3(0, 0, 0)), hash3(i + vec3(1, 0, 0)), f.x),
              mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
          mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x),
              mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y),
          f.z
        );
      }

      const mat3 octaveRot = mat3(
         0.00,  0.80,  0.60,
        -0.80,  0.36, -0.48,
        -0.60, -0.48,  0.64
      );

      float fbm(vec3 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 5; i++) {
          v += a * noise3(p);
          p = octaveRot * p * 2.05 + vec3(13.1, 7.7, 19.3);
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 d = normalize(worldDir);
        float gLat = asin(clamp(dot(d, pole), -1.0, 1.0));
        float gLon = atan(dot(d, eastAxis), dot(d, refAxis));

        // Domain-warped 3D FBM for soft, organic, non-repeating cloud banks
        vec3 p = d * 4.2 + vec3(time * 0.001, 0.0, -time * 0.0008);
        float w1 = fbm(p);
        float w2 = fbm(p * 1.7 + vec3(w1 * 1.5, -w1 * 1.2, 3.1));
        float detail = fbm(p * 3.5 + vec3(w2 * 1.9, w1 * 1.4, 6.7));

        float meander = 0.035 * sin(gLon * 2.0 + 0.4) + (w1 - 0.5) * 0.065;
        float cLat = gLat - centerLat - meander;

        // Asymmetric vertical profile: sharp transition into dark upper sky (cLat > 0), wide soft glow downward (cLat < 0)
        float upperWidth = cLat > 0.0 ? 0.16 : 0.34;
        float wideGlow = exp(-pow(cLat / upperWidth, 2.0));
        float midWidth = cLat > 0.0 ? 0.10 : 0.19;
        float midBand = exp(-pow(cLat / midWidth, 2.0));
        float coreBand = exp(-pow((cLat + 0.02) / 0.085, 2.0));

        // Soft cloud modulation
        float cloudBillow = smoothstep(0.26, 0.82, 0.52 * w2 + 0.48 * detail);
        float crestMask = pow(smoothstep(0.44, 0.86, 0.45 * w2 + 0.55 * detail), 1.65) * coreBand;

        // Dark interstellar dust lanes carving realistic cloud banks along the spine (like the bottom-center/right of Image 2)
        float riftCenter = -0.025 + (w1 - 0.5) * 0.055;
        float riftProfile = exp(-pow((cLat - riftCenter) / (0.032 + 0.024 * w2), 2.0));
        float dustRift = 1.0 - 0.68 * smoothstep(0.32, 0.74, detail) * riftProfile;

        // Fine unresolved star-sand stippling inside the Milky Way clouds
        float grain1 = noise3(d * 270.0);
        float grain2 = noise3(d * 540.0 + vec3(17.3, 9.1, 4.7));
        float starSand = (smoothstep(0.58, 0.94, grain1) * 0.65 + smoothstep(0.64, 0.96, grain2) * 0.85)
          * (midBand * 0.55 + crestMask * 1.2) * cloudBillow * dustRift;

        // Linear-space colors calibrated for SRGBColorSpace output so the result matches Image 2's deep nocturnal blue
        vec3 deepMidnight = vec3(0.0012, 0.0032, 0.0085);
        vec3 outerSapphire = vec3(0.0055, 0.0145, 0.0360);
        vec3 dustyCerulean = vec3(0.0160, 0.0340, 0.0720);
        vec3 silverBlueCrest = mix(vec3(0.0420, 0.0720, 0.1320), vec3(0.0680, 0.0740, 0.1050), smoothstep(0.52, 0.85, w1));
        vec3 sandTint = vec3(0.0950, 0.1450, 0.2350);

        float skyBaseMask = smoothstep(0.38, -0.45, gLat);
        vec3 color = deepMidnight * skyBaseMask
          + outerSapphire * wideGlow * (0.45 + 0.55 * cloudBillow) * (0.55 + 0.45 * dustRift)
          + dustyCerulean * midBand * cloudBillow * dustRift
          + silverBlueCrest * crestMask * dustRift
          + sandTint * starSand * 0.45;

        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new Mesh(geometry, material);
  mesh.renderOrder = -40;
  mesh.frustumCulled = false;
  scene.add(mesh);

  return {
    update(seconds: number) {
      material.uniforms.time.value = seconds;
    },
    dispose() {
      mesh.removeFromParent();
      material.dispose();
      geometry.dispose();
    },
  };
}
