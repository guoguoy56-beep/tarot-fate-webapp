import { CubicBezierCurve3, Euler, PerspectiveCamera, Quaternion, Vector3 } from "three";
import { orbitMotion } from "@/lib/cosmic-experience";
import { drawRingFrame } from "@/lib/cosmic-ring-space";
import { cosmicSpaceCamera } from "@/lib/cosmic-space-camera";
import { spatialStream, spatialStreamPose } from "@/lib/cosmic-stream-space";
import { diveCruisePoint, diveCruiseSlots, diveJunctionSlot } from "@/lib/cosmic-dive-path";

export const ringEntryMotion = { durationMs: 13000, arrivalMs: 11800, cameraMs: 9000, cruiseMs: 6000, entranceSlots: 48 } as const;
const step = Math.PI * 2 / 78, entrance = -Math.PI / 2, junction = diveJunctionSlot;
const sourceSpeed = 78 / spatialStream.durationMs, cruiseSpeed = 0.0075, arrivalSpeed = 0.01, idleSpeed = orbitMotion.idleSpeed / step;
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Extend the original stream beyond its visible exit; each identity follows this route once. */
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
    const cameraTime = Math.min(1, time / ringEntryMotion.cameraMs);
    const distance = this.firstGap + ringEntryMotion.entranceSlots + 77;
    let advance: number, speed: number;
    if (time < duration) {
      const cruising = time < ringEntryMotion.cruiseMs, cruiseEnd = this.firstGap + diveCruiseSlots;
      const from = cruising ? 0 : cruiseEnd, to = cruising ? cruiseEnd : distance;
      const span = cruising ? ringEntryMotion.cruiseMs : duration - ringEntryMotion.cruiseMs;
      const t = (time - (cruising ? 0 : ringEntryMotion.cruiseMs)) / span;
      const first = cruising ? sourceSpeed : cruiseSpeed, last = cruising ? cruiseSpeed : arrivalSpeed;
      advance = from + (t ** 3 - 2 * t * t + t) * first * span + (-2 * t ** 3 + 3 * t * t) * (to - from) + (t ** 3 - t * t) * last * span;
      speed = (3 * t * t - 4 * t + 1) * first + (-6 * t * t + 6 * t) * (to - from) / span + (3 * t * t - 2 * t) * last;
    } else {
      const settling = ringEntryMotion.durationMs - duration, dt = time - duration, t = Math.min(1, dt / settling);
      advance = distance + idleSpeed * dt + (arrivalSpeed - idleSpeed) * settling * (t - t ** 3 + t ** 4 / 2);
      speed = idleSpeed + (arrivalSpeed - idleSpeed) * (1 - smooth(t));
    }
    return { advance, speed: speed * step,
      rotation: entrance + (advance - this.firstGap - ringEntryMotion.entranceSlots - this.head) * step,
      entered: Math.min(78, Math.max(0, Math.floor(advance - this.firstGap - ringEntryMotion.entranceSlots + 1e-8) + 1)),
      camera: cameraTime ** 3 * (cameraTime * (6 * cameraTime - 15) + 10) };
  }

  private geometry(width: number, height: number) {
    if (this.path?.width === width && this.path.height === height) return this.path;
    const at = (slot: number) => spatialStreamPose(0, slot / 78 * spatialStream.durationMs, width, height);
    const start = at(junction), cruiseEnd = diveCruisePoint(1);
    const tangent = cruiseEnd.clone().sub(diveCruisePoint(1 - 0.00001)).divideScalar(0.00001 * diveCruiseSlots);
    const arcSlots = ringEntryMotion.entranceSlots - diveCruiseSlots;
    const frame = drawRingFrame(width, height, true), end = frame.center.clone().sub(frame.v);
    const pose = cosmicSpaceCamera({ ring: 1, reading: 0, summary: 0, dive: 1 }), view = new PerspectiveCamera();
    view.position.set(...pose.position); view.lookAt(...pose.target); view.updateMatrixWorld();
    const curve = new CubicBezierCurve3(cruiseEnd, cruiseEnd.clone().addScaledVector(tangent, arcSlots / 3),
      end.clone().addScaledVector(frame.u, -step * arcSlots / 3), end);
    return this.path = { width, height, curve, frame, quaternion: view.quaternion.clone(), size: start.size,
      start: new Quaternion().setFromEuler(new Euler(start.pitch, 0, start.tilt)) };
  }

  pose(index: number, elapsed: number, width: number, height: number) {
    const state = this.state(elapsed), distance = state.advance - this.gaps[index];
    if (distance < 0) {
      const pose = spatialStreamPose(index, this.streamTime + state.advance / sourceSpeed, width, height);
      return { ...pose, quaternion: new Quaternion().setFromEuler(new Euler(pose.pitch, 0, pose.tilt)), region: "stream" as const };
    }
    const path = this.geometry(width, height);
    if (distance < diveCruiseSlots) {
      const t = distance / diveCruiseSlots, quaternion = path.start.clone();
      // Bank gently about the card's own normal; retain its original pitch through the flight.
      quaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -9 * Math.PI / 180 * Math.sin(Math.PI * t) ** 2));
      return { position: diveCruisePoint(t), size: path.size, quaternion, region: "cruise" as const };
    }
    const t = Math.min(1, (distance - diveCruiseSlots) / (ringEntryMotion.entranceSlots - diveCruiseSlots));
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
