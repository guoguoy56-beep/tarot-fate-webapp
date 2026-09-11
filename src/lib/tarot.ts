import { tarotCards } from "@/data/tarotCards";
import { shuffleDeck } from "@/lib/tarot-random";
import type { RandomSource } from "@/lib/tarot-random";
import type { CardOrientation, TarotCardData } from "@/types/tarot";

export function drawRandomDeck(random: RandomSource = Math.random): TarotCardData[] {
  return shuffleDeck(tarotCards, random);
}

export { randomOrientation } from "@/lib/tarot-random";

export function positionLabel(position: string): string {
  const labels: Record<string, string> = {
    past: "过去",
    present: "现在",
    future: "未来",
  };

  return labels[position] ?? position;
}

export function orientationLabel(orientation: CardOrientation): string {
  return orientation === "upright" ? "正位" : "逆位";
}
