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
