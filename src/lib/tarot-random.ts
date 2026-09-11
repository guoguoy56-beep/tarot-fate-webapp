import type { CardOrientation } from "@/types/tarot";

export type RandomSource = () => number;

export function shuffleDeck<T>(source: readonly T[], random: RandomSource = Math.random): T[] {
  const shuffled = [...source];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export function randomOrientation(random: RandomSource = Math.random): CardOrientation {
  return random() > 0.5 ? "upright" : "reversed";
}
