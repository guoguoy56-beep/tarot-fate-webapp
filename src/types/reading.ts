import type { CardOrientation, SpreadPosition } from "./tarot";

export interface ReadingCardPayload {
  position: SpreadPosition;
  nameCn: string;
  nameEn: string;
  orientation: CardOrientation;
  uprightKeywords: string[];
  reversedKeywords: string[];
  meaning: string;
}

export interface ReadingRequest {
  question: string;
  cards: ReadingCardPayload[];
}

export interface ReadingResponse {
  past: string;
  present: string;
  future: string;
  summary: string;
}

export interface ReadingRecord {
  id: string;
  question: string;
  createdAt: string;
  spread: {
    position: SpreadPosition;
    cardId: string;
    orientation: CardOrientation;
    interpretation: string;
  }[];
  summary: string;
}
