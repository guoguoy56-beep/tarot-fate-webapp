import { tarotCards } from "@/data/tarotCards";
import type { CardOrientation, TarotCardData } from "@/types/tarot";

export function drawRandomDeck(): TarotCardData[] {
  return [...tarotCards]
    .map((card) => ({ card, seed: Math.random() }))
    .sort((a, b) => a.seed - b.seed)
    .map((item) => item.card);
}

export function randomOrientation(): CardOrientation {
  return Math.random() > 0.5 ? "upright" : "reversed";
}

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
