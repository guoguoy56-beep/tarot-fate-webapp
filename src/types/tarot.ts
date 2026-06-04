export type ArcanaType = "major" | "minor";

export type TarotSuit = "wands" | "cups" | "swords" | "pentacles" | null;

export type SpreadPosition = "past" | "present" | "future";

export type CardOrientation = "upright" | "reversed";

export interface TarotCardData {
  id: string;
  nameCn: string;
  nameEn: string;
  arcana: ArcanaType;
  suit: TarotSuit;
  number: number;
  uprightKeywords: string[];
  reversedKeywords: string[];
  meaning: string;
  image: string;
}

export interface DrawnCard {
  position: SpreadPosition;
  cardId: string;
  orientation: CardOrientation;
}

export interface PlacedCard extends DrawnCard {
  order: number;
}
