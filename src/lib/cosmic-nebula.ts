import { BackSide, Color, CustomBlending, Mesh, OneFactor, OneMinusSrcAlphaFactor, PerspectiveCamera, Scene, ShaderMaterial, SphereGeometry, Vector3 } from "three";
import { skyDirection, skyNebulaDistance, skyNebulae } from "@/lib/cosmic-sky-catalog";

/** Soft, low-contrast slate-blue volumetric mist banks embedded along the Colossal Blue Milky Way. */
export function createCosmicNebulae(scene: Scene) {
  const geometry = new SphereGeometry(1, 24, 16);
  const layouts = [
    { position: [-115, 45, -270], scale: [88, 30, 56], rotation: [0.2, -0.3, -0.25], tint: "#183256", tint2: "#345680", seed: 0.7, far: false },
    { position: [540, -320, -120], scale: [92, 32, 58], rotation: [-0.3, 0.45, 0.3], tint: "#183256", tint2: "#365882", seed: 2.4, far: false },
    { position: [200, -135, 310], scale: [96, 32, 56], rotation: [0.15, -0.5, -0.2], tint: "#1a3458", tint2: "#385a84", seed: 4.1, far: false },
    { position: [-145, -155, 100], scale: [84, 28, 52], rotation: [-0.2, 0.3, 0.35], tint: "#183052", tint2: "#32547c", seed: 5.8, far: false },
    ...skyNebulae.map((nebula) => ({
      position: skyDirection(nebula.at[0], nebula.at[1]).multiplyScalar(skyNebulaDistance).toArray(),
      scale: nebula.scale, rotation: nebula.rotation, tint: nebula.tint, tint2: nebula.tint2, seed: nebula.seed, far: true,
    })),
  ] as const;
  const clouds = layouts.map((layout) => {
    const material = new ShaderMaterial({
      uniforms: { cameraLocal: { value: new Vector3() }, tint: { value: new Color(layout.tint) }, tint2: { value: new Color(layout.tint2) }, seed: { value: layout.seed }, time: { value: 0 } },
      side: BackSide, transparent: true, depthWrite: false, toneMapped: false,
      blending: CustomBlending, blendSrc: OneFactor, blendDst: OneMinusSrcAlphaFactor, blendSrcAlpha: OneFactor, blendDstAlpha: OneMinusSrcAlphaFactor,
      vertexShader: `
        varying vec3 localPosition;
        void main() {
          localPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 cameraLocal, tint, tint2;
        uniform float seed, time;
        varying vec3 localPosition;
        float lobe(vec3 p, vec3 center, vec3 shape) {
          vec3 q = (p - center) * shape;
          return exp(-2.6 * dot(q, q));
        }
        float density(vec3 p) {
          float edge = max(0.0, 1.0 - dot(p, p));
          vec3 q = p + 0.09 * sin(p.yzx * 3.6 + p.zxy * 1.7 + seed + time * 0.012);
          float body = lobe(q, vec3(-0.3, 0.05, 0.0), vec3(1.1, 1.8, 1.5));
          body += 0.7 * lobe(q, vec3(0.25, -0.18, 0.12), vec3(1.5, 2.1, 1.7));
          body += 0.45 * lobe(q, vec3(0.38, 0.25, -0.1), vec3(1.7, 2.3, 1.8));
          float folds = 0.65 + 0.35 * sin(q.x * 5.0 + q.z * 3.0 + sin(q.y * 4.0 + seed));
          return edge * edge * body * folds;
        }
        void main() {
          vec3 direction = normalize(localPosition - cameraLocal);
          float b = dot(cameraLocal, direction);
          float c = dot(cameraLocal, cameraLocal) - 1.0;
          float hit = b * b - c;
          if (hit <= 0.0) discard;
          float start = max(0.0, -b - sqrt(hit));
          float end = -b + sqrt(hit);
          if (end <= start) discard;
          float stepLength = (end - start) / 16.0;
          float opticalDepth = 0.0, hue = 0.0;
          for (int index = 0; index < 16; index++) {
            vec3 point = cameraLocal + direction * (start + (float(index) + 0.5) * stepLength);
            float slice = density(point) * stepLength;
            opticalDepth += slice;
            hue += slice * (0.5 + 0.5 * sin(point.x * 2.4 + point.y * 1.6 + seed));
          }
          float alpha = 1.0 - exp(-opticalDepth * 0.28);
          vec3 color = mix(tint, tint2, clamp(hue / max(opticalDepth, 1e-4), 0.0, 1.0));
          gl_FragColor = vec4(color * alpha * 0.05, alpha * 0.04);
          #include <colorspace_fragment>
        }
      `,
    });
    const cloud = new Mesh(geometry, material);
    cloud.position.set(layout.position[0], layout.position[1], layout.position[2]);
    cloud.scale.set(layout.scale[0], layout.scale[1], layout.scale[2]);
    cloud.rotation.set(layout.rotation[0], layout.rotation[1], layout.rotation[2]);
    cloud.renderOrder = -10;
    cloud.onBeforeRender = (_renderer, _scene, camera) => {
      camera.getWorldPosition(material.uniforms.cameraLocal.value);
      cloud.worldToLocal(material.uniforms.cameraLocal.value);
    };
    scene.add(cloud);
    return cloud;
  });
  return {
    clouds,
    update(seconds: number, camera?: PerspectiveCamera) {
      clouds.forEach((cloud, index) => {
        const layout = layouts[index];
        cloud.material.uniforms.time.value = seconds;
        if (layout.far) {
          if (camera) cloud.position.set(camera.position.x + layout.position[0], camera.position.y + layout.position[1], camera.position.z + layout.position[2]);
          cloud.updateMatrixWorld();
          return;
        }
        cloud.position.x = layout.position[0] + (Math.sin(seconds * 0.012 + layout.seed) - Math.sin(layout.seed)) * 2;
        cloud.position.y = layout.position[1] + (Math.cos(seconds * 0.01 + layout.seed) - Math.cos(layout.seed)) * 0.8;
      });
    },
    dispose() {
      clouds.forEach((cloud) => { cloud.removeFromParent(); cloud.material.dispose(); });
      geometry.dispose();
    },
  };
}
