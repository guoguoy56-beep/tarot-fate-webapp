import { CubicBezierCurve3, Euler, PerspectiveCamera, Quaternion, Vector3 } from "three";
import { orbitMotion } from "@/lib/cosmic-experience";
import { drawRingFrame } from "@/lib/cosmic-ring-space";
import { cosmicSpaceCamera } from "@/lib/cosmic-space-camera";
import { spatialStream, spatialStreamPose } from "@/lib/cosmic-stream-space";

export const ringEntryMotion = { durationMs: 7600, arrivalMs: 6400, cameraMs: 4400, entranceSlots: 18 } as const;
const step = Math.PI * 2 / 78, entrance = -Math.PI / 2, junction = 60;
const sourceSpeed = 78 / spatialStream.durationMs, arrivalSpeed = 0.01, idleSpeed = orbitMotion.idleSpeed / step;
const smooth = (t: number) => t * t * (3 - 2 * t);

/** A finite queue branches from the live stream; each identity traverses the same entrance once. */
export class CosmicRingEntry {
  private readonly gaps: number[];
  private readonly head: number;
  private readonly firstGap: number;
  private path?: { width: number; height: number; curve: CubicBezierCurve3; frame: ReturnType<typeof drawRingFrame>; quaternion: Quaternion; size: number; start: Quaternion };

  constructor(readonly streamTime: number) {
    const phase = streamTime / spatialStream.durationMs * 78;
    this.gaps = Array.from({ length: 78 }, (_, index) => ((junction - index - phase) % 78 + 78) % 78);
    this.firstGap = Math.min(...this.gaps); this.head = this.gaps.indexOf(this.firstGap);
  }

  state(elapsed: number) {
    const time = Math.max(0, elapsed), duration = ringEntryMotion.arrivalMs;
    const distance = this.firstGap + ringEntryMotion.entranceSlots + 77;
    let advance: number, speed: number;
    if (time < duration) {
      const t = time / duration;
      advance = (t ** 3 - 2 * t * t + t) * sourceSpeed * duration + (-2 * t ** 3 + 3 * t * t) * distance + (t ** 3 - t * t) * arrivalSpeed * duration;
      speed = (3 * t * t - 4 * t + 1) * sourceSpeed + (-6 * t * t + 6 * t) * distance / duration + (3 * t * t - 2 * t) * arrivalSpeed;
    } else {
      const settling = ringEntryMotion.durationMs - duration, dt = time - duration, t = Math.min(1, dt / settling);
      advance = distance + idleSpeed * dt + (arrivalSpeed - idleSpeed) * settling * (t - t ** 3 + t ** 4 / 2);
      speed = idleSpeed + (arrivalSpeed - idleSpeed) * (1 - smooth(t));
    }
    return { advance, speed: speed * step,
      rotation: entrance + (advance - this.firstGap - ringEntryMotion.entranceSlots - this.head) * step,
      entered: Math.min(78, Math.max(0, Math.floor(advance - this.firstGap - ringEntryMotion.entranceSlots + 1e-8) + 1)),
      camera: smooth(Math.min(1, time / ringEntryMotion.cameraMs)) };
  }

  private geometry(width: number, height: number) {
    if (this.path?.width === width && this.path.height === height) return this.path;
    const at = (slot: number) => spatialStreamPose(0, slot / 78 * spatialStream.durationMs, width, height);
    const start = at(junction), tangent = at(junction + 0.001).position.sub(start.position).divideScalar(0.001);
    const frame = drawRingFrame(width, height, true), end = frame.center.clone().sub(frame.v);
    const pose = cosmicSpaceCamera({ ring: 1, reading: 0, summary: 0, dive: 1 }), view = new PerspectiveCamera();
    view.position.set(...pose.position); view.lookAt(...pose.target); view.updateMatrixWorld();
    const curve = new CubicBezierCurve3(start.position, start.position.clone().addScaledVector(tangent, ringEntryMotion.entranceSlots / 3),
      end.clone().addScaledVector(frame.u, -step * ringEntryMotion.entranceSlots / 3), end);
    return this.path = { width, height, curve, frame, quaternion: view.quaternion.clone(), size: start.size,
      start: new Quaternion().setFromEuler(new Euler(start.pitch, 0, start.tilt)) };
  }

  pose(index: number, elapsed: number, width: number, height: number) {
    const state = this.state(elapsed), distance = state.advance - this.gaps[index];
    if (distance < 0) {
      const pose = spatialStreamPose(index, this.streamTime + state.advance / sourceSpeed, width, height);
      return { ...pose, quaternion: new Quaternion().setFromEuler(new Euler(pose.pitch, 0, pose.tilt)), region: "stream" as const };
    }
    const path = this.geometry(width, height), t = Math.min(1, distance / ringEntryMotion.entranceSlots);
    const angle = entrance + (distance - ringEntryMotion.entranceSlots) * step;
    const cosine = Math.cos(angle);
    const ringQuaternion = path.quaternion.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), cosine * 20 * Math.PI / 180))
      .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -cosine * 12 * Math.PI / 180));
    if (distance < ringEntryMotion.entranceSlots) {
      const quaternion = path.start.clone().slerp(ringQuaternion, smooth(t));
      quaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -9 * Math.PI / 180 * Math.sin(Math.PI * t) ** 2));
      return { position: path.curve.getPoint(t), size: path.size + (path.frame.cardSize * 68 - path.size) * smooth(t), quaternion, region: "approach" as const };
    }
    return { position: path.frame.center.clone().addScaledVector(path.frame.u, Math.cos(angle)).addScaledVector(path.frame.v, Math.sin(angle)),
      size: path.frame.cardSize * 68, quaternion: ringQuaternion, region: "ring" as const };
  }
}
