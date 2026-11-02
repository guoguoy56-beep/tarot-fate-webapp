import type { CardOrientation } from "@/types/tarot";

export const cosmicSpreads = [
  { id: "single", name: "单牌", subtitle: "一束微光，照见此刻", slots: ["核心提示"] },
  { id: "yes-no", name: "是非牌", subtitle: "换个角度，看见倾向", slots: ["倾向与提醒"] },
  { id: "timeline", name: "过去现在未来", subtitle: "沿时间的线索，寻找方向", slots: ["过去", "现在", "未来"] },
  { id: "three", name: "三牌阵", subtitle: "从处境出发，走向行动", slots: ["现状", "阻碍", "建议"] },
  { id: "cross", name: "十字牌阵", subtitle: "交汇的线索，完整的视角", slots: ["现状", "阻力", "根源", "建议", "走向"] },
  { id: "lovers", name: "恋人十字牌阵", subtitle: "在彼此之间，理解关系", slots: ["我方状态", "对方表现", "关系现状", "阻碍", "发展"] },
  { id: "crush", name: "暗恋牌阵", subtitle: "轻轻靠近，未说出口的心意", slots: ["我的心意", "对方可观察信号", "距离与阻碍", "行动建议"] },
  { id: "heart", name: "心之声", subtitle: "让安静的内心，有所回应", slots: ["表层感受", "深层需要", "未表达的担忧", "自我建议"] },
] as const;

export type CosmicSpread = (typeof cosmicSpreads)[number];
export interface OrbitalSelection { anchor: number; cardId: string; orientation: CardOrientation }

/** The angle belongs to the ring; a selection keeps its original deck anchor. */
export function selectOrbitalCard(
  selected: readonly OrbitalSelection[], card: OrbitalSelection, count: number,
): OrbitalSelection[] {
  if (selected.length >= count || selected.some((item) => item.anchor === card.anchor || item.cardId === card.cardId)) {
    return [...selected];
  }
  return [...selected, card];
}

export function nearestRotation(rotation: number, anchor: number, count: number, foreground = 2): number {
  const turn = Math.PI * 2;
  const target = foreground - anchor / count * turn;
  return rotation + Math.atan2(Math.sin(target - rotation), Math.cos(target - rotation));
}

export function isRingDrag(start: { x: number; y: number }, point: { x: number; y: number }): boolean {
  return Math.hypot(point.x - start.x, point.y - start.y) > 7;
}

export interface RingProjection { cx: number; cy: number; rx: number; ry: number }

/** Follow the pointer around the projected ellipse, on either side of the ring. */
export function ringDragDelta(
  previous: { x: number; y: number }, next: { x: number; y: number }, ring: RingProjection,
): number {
  if (ring.rx <= 0 || ring.ry <= 0) return 0;
  const from = { x: (previous.x - ring.cx) / ring.rx, y: (previous.y - ring.cy) / ring.ry };
  const to = { x: (next.x - ring.cx) / ring.rx, y: (next.y - ring.cy) / ring.ry };
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distanceSquared = dx * dx + dy * dy;
  const closest = distanceSquared ? Math.max(0, Math.min(1, -(from.x * dx + from.y * dy) / distanceSquared)) : 0;
  // Crossing the center has no defined angular direction; resume on the next valid segment.
  if (Math.hypot(from.x + dx * closest, from.y + dy * closest) < 0.15) return 0;
  return Math.atan2(from.x * to.y - from.y * to.x, from.x * to.x + from.y * to.y);
}

// Angular speeds are radians per millisecond; one velocity is carried across scene phases.
export const orbitMotion = {
  travelSpeed: 0.00035,
  shuffleSpeed: 0.00065,
  idleSpeed: 0.00006,
  settleMs: 650,
  maxReleaseSpeed: 0.002,
} as const;

/** Integrate the easing curve exactly, so speed and angle stay continuous at any frame rate. */
export function advanceOrbitMotion(speed: number, target: number, deltaMs: number) {
  const duration = Math.max(0, deltaMs);
  const blend = -Math.expm1(-duration / orbitMotion.settleMs);
  return {
    speed: speed + (target - speed) * blend,
    angle: target * duration + (speed - target) * orbitMotion.settleMs * blend,
  };
}

export const homeCardStream = { count: 36, durationMs: 105_000 } as const;

// Follow the user's red-line guide: left from the vortex, right, then left into the foreground.
// Adjacent cubic segments share their end tangent; the last segment continues below the screen.
const homeStreamPath = [
  [[0.845, 0.155], [0.85, 0.205], [0.65, 0.155], [0.647, 0.285]],
  [[0.647, 0.285], [0.644, 0.415], [0.884, 0.315], [0.884, 0.475]],
  [[0.884, 0.475], [0.884, 0.635], [0.56, 0.665], [0.56, 0.87]],
  [[0.56, 0.87], [0.56, 1.075], [0.90, 1.40], [0.99, 1.90]],
] as const;

/** Normalized screen position; the loop resets only after the card has left the bottom. */
export function homeStreamPose(index: number, elapsedMs: number, aspectRatio = 1920 / 910) {
  const phase = (index / homeCardStream.count + elapsedMs / homeCardStream.durationMs) % 1;
  // Spend more time in the distance, then open the spacing gradually toward the viewer.
  const progress = 0.2 * phase + 0.8 * phase ** 4;
  const segment = Math.min(3, Math.floor(progress * 4));
  const t = progress * 4 - segment;
  const u = 1 - t;
  const points = homeStreamPath[segment];
  const coordinate = (axis: 0 | 1) => u ** 3 * points[0][axis] + 3 * u ** 2 * t * points[1][axis]
    + 3 * u * t ** 2 * points[2][axis] + t ** 3 * points[3][axis];
  // Keep the source on the existing cover-cropped panorama when desktop aspect ratios differ.
  const panoramaAspect = 1672 / 941;
  const sourceX = 0.308 * 1.2544 * (Math.max(1, panoramaAspect / aspectRatio) - 1);
  const sourceY = 0.224 * 1.2544 * (Math.max(1, (1920 / 910) / panoramaAspect) - Math.max(1, aspectRatio / panoramaAspect));
  const sourceWeight = (1 - progress) ** 3;
  const turn = Math.max(0, (progress - 0.55) / 0.45);
  const clockwise = 64 * turn ** 2 * (3 - 2 * turn);
  // Start with a one-pixel long edge, then smoothly restore the existing foreground scale.
  const emergence = Math.min(1, progress / 0.5);
  const minimumScale = 1 / 116 + (0.12 - 1 / 116) * emergence * (2 - emergence);
  return {
    progress,
    x: coordinate(0) + sourceX * sourceWeight,
    y: coordinate(1) + sourceY * sourceWeight,
    scale: minimumScale + 8.8 * progress ** 3.2,
    tilt: -6 + 12 * Math.sin(progress * Math.PI * 2) + clockwise,
    opacity: Math.min(1, phase / 0.025),
  };
}
