import { BufferGeometry, Float32BufferAttribute, Mesh, Scene, ShaderMaterial } from "three";

/** A few rare shooting stars: each slot repeats on its own period with a re-rolled path. */
export function createCosmicMeteors(scene: Scene) {
  // [direction x, y, z, period, offset, duration] — directions cover the headings used by the experience.
  const slots = [
    [0.05, 0.2, -0.97, 9, 1.5, 1.0], [0.45, 0.25, -0.86, 13.5, 6, 0.9], [-0.4, 0.3, -0.86, 17, 11, 1.1],
    [0.9, 0.15, -0.4, 15, 3, 1.0], [-0.85, 0.25, -0.45, 19, 8, 1.1], [0.3, -0.1, -0.95, 21, 14, 0.9],
  ];
  const positions: number[] = [], base: number[] = [], timing: number[] = [], indices: number[] = [];
  slots.forEach((slot, index) => {
    for (const [u, v] of [[0, -1], [0, 1], [1, -1], [1, 1]]) {
      positions.push(u, v, 0); base.push(slot[0], slot[1], slot[2]); timing.push(slot[3], slot[4], slot[5]);
    }
    const first = index * 4;
    indices.push(first, first + 1, first + 2, first + 1, first + 3, first + 2);
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("base", new Float32BufferAttribute(base, 3));
  geometry.setAttribute("timing", new Float32BufferAttribute(timing, 3));
  geometry.setIndex(indices);
  const material = new ShaderMaterial({
    uniforms: { time: { value: 0 } },
    transparent: true, depthWrite: false, toneMapped: false,
    vertexShader: `
      uniform float time;
      attribute vec3 base, timing;
      varying vec2 corner;
      varying float fade;
      float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
      void main() {
        float shifted = time + timing.y, cycle = floor(shifted / timing.x);
        float t = (shifted - cycle * timing.x) / timing.z;
        corner = position.xy; fade = 0.0;
        if (time <= 0.0 || t >= 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
        float h1 = hash(cycle * 3.1 + timing.y), h2 = hash(cycle * 7.7 + timing.y * 1.3 + 2.0), h3 = hash(cycle * 5.3 + timing.y * 0.7 + 4.0);
        vec3 start = normalize(base + vec3(h1 - 0.5, (h2 - 0.5) * 0.5, 0.0) * 0.7);
        vec3 axisX = normalize(cross(start, vec3(0.0, 1.0, 0.0))), axisY = cross(axisX, start);
        float angle = -0.5 - h3 * 0.7, side = h1 > 0.5 ? 1.0 : -1.0;
        vec3 move = normalize(axisX * cos(angle) * side + axisY * sin(angle));
        vec3 head = normalize(start + move * 0.35 * t), tail = normalize(start + move * 0.35 * max(0.0, t - 0.3));
        vec3 headView = mat3(viewMatrix) * head * 880.0, tailView = mat3(viewMatrix) * tail * 880.0;
        if (headView.z > -1.0 || tailView.z > -1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
        vec3 normal = cross(headView - tailView, headView);
        vec3 offset = normal / max(length(normal), 1e-6) * 1.6;
        vec3 point = mix(tailView, headView, position.x) + offset * position.y * position.x;
        gl_Position = projectionMatrix * vec4(point, 1.0);
        fade = sin(3.14159265 * t);
      }
    `,
    fragmentShader: `
      varying vec2 corner;
      varying float fade;
      void main() {
        float trail = pow(corner.x, 2.2) * (1.0 - smoothstep(0.3, 1.0, abs(corner.y)));
        vec3 color = mix(vec3(0.7, 0.82, 1.0), vec3(1.0), smoothstep(0.7, 1.0, corner.x));
        gl_FragColor = vec4(color, trail * fade * 0.9);
        #include <colorspace_fragment>
      }
    `,
  });
  const meteors = new Mesh(geometry, material);
  meteors.renderOrder = -15; meteors.frustumCulled = false;
  scene.add(meteors);
  return {
    update(seconds: number) { material.uniforms.time.value = seconds; },
    dispose() { meteors.removeFromParent(); geometry.dispose(); material.dispose(); },
  };
}
