import { PerspectiveCamera, Vector3 } from "three";
import { cosmicSpaceCamera } from "@/lib/cosmic-space-camera";
import type { homeStreamPose } from "@/lib/cosmic-experience";

// Calibrate against the home view, never the moving camera. This keeps the S path stationary in world space.
const pose = cosmicSpaceCamera({ ring: 0, reading: 0, summary: 0 });
const reference = new PerspectiveCamera(pose.fov);
reference.position.set(...pose.position); reference.lookAt(...pose.target); reference.updateMatrixWorld();

/** Preserve the approved home framing while assigning each point a real distance from the viewer. */
export function homeStreamWorldPose(home: ReturnType<typeof homeStreamPose>, width: number, height: number) {
  const focal = height / (2 * Math.tan(reference.fov * Math.PI / 360));
  // Emerge at the nebula plane, then approach to six world units; stay clear of the near clipping plane.
  const distance = 60 - 54 * home.progress;
  const position = new Vector3((home.x - 0.5) * width * distance / focal, (0.5 - home.y) * height * distance / focal, -distance)
    .applyMatrix4(reference.matrixWorld);
  // Emergence grows the physical card as well as its perspective, retaining the one-pixel source.
  const size = home.scale * Math.min(width / 1440, height / 900) * distance / focal;
  return { position, size };
}
