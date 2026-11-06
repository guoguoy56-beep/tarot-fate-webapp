import { CubicBezierCurve3, Vector3 } from "three";

export const diveStation = { position: [350, -195, -30], target: [390, -220, -75], fov: 50 } as const;
export const diveJunctionSlot = 69.84;
export const diveCruiseSlots = 36;

const first = new Vector3(18.6162, -30.8645, 39.9415), second = new Vector3(53.0809, -38.8436, 56.5302);
const firstTangent = new Vector3(10.9341, -10.6822, 20.6788), secondTangent = new Vector3(56.8366, -11.7374, 15.0111);
export const questionStreamBend = new CubicBezierCurve3(first, first.clone().addScaledVector(firstTangent, 1 / 3), second.clone().addScaledVector(secondTangent, -1 / 3), second);
export const questionStreamTail = new CubicBezierCurve3(second, second.clone().addScaledVector(secondTangent, 1 / 3), new Vector3(130.8105, -56.7360, 59.2217), new Vector3(166.8064, -107.5271, 37.8373));

const junctionT = (diveJunctionSlot - 60) / 12;
const start = questionStreamTail.getPoint(junctionT);
const tangent = questionStreamTail.getPoint(junctionT + 0.00001 / 12).sub(start).divideScalar(0.00001);
const middle = new Vector3(240, -170, -32), middleTangent = new Vector3(20, -10, -13), end = new Vector3(355.7, -197.9, -81.3);
const cruise = [new CubicBezierCurve3(start, start.clone().addScaledVector(tangent, diveCruiseSlots / 6), middle.clone().sub(middleTangent), middle),
  new CubicBezierCurve3(middle, middle.clone().add(middleTangent), end.clone().add(new Vector3(-18, 8, 8)), end)];
const eyes = [new CubicBezierCurve3(new Vector3(16, -9.5, -6), new Vector3(25, -16, 22), new Vector3(65, -25, 55), new Vector3(112, -48, 56)),
  new CubicBezierCurve3(new Vector3(112, -48, 56), new Vector3(159, -71, 57), new Vector3(260, -135, 20), new Vector3(...diveStation.position))];
const point = (curves: readonly CubicBezierCurve3[], t: number) => t < 0.5 ? curves[0].getPoint(t * 2) : curves[1].getPoint((t - 0.5) * 2);

export const diveCruisePoint = (t: number) => point(cruise, Math.max(0, Math.min(1, t)));
export const cameraEyePoint = (t: number) => point(eyes, Math.max(0, Math.min(1, t)));

/** The camera looks ahead on this same route, first down-left and then up-left in the viewport. */
export function diveGuidePoint(t: number) {
  if (t <= 0.5) {
    const slot = 50 + (diveJunctionSlot - 50) * t * 2;
    return slot < 60 ? questionStreamBend.getPoint((slot - 48) / 12) : questionStreamTail.getPoint((slot - 60) / 12);
  }
  const u = (t - 0.5) * 2, ratio = (diveJunctionSlot - 50) / diveCruiseSlots;
  return diveCruisePoint(ratio * u + (1 - ratio) * u * u);
}
