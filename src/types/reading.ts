import type { CardOrientation, SpreadPosition } from "./tarot";

export type CosmicSpreadId =
  | "single"
  | "yes-no"
  | "timeline"
  | "three"
  | "cross"
  | "lovers"
  | "crush"
  | "heart";

export interface ReadingCardSelection {
  cardId: string;
  position: SpreadPosition;
  orientation: CardOrientation;
}

export interface ReadingRequest {
  question: string;
  cards: ReadingCardSelection[];
}

export interface CosmicReadingCardSelection {
  cardId: string;
  position: string;
  orientation: CardOrientation;
}

export interface CosmicReadingRequest {
  spreadId: CosmicSpreadId;
  question: string;
  cards: CosmicReadingCardSelection[];
}

export interface TrustedReadingCard extends ReadingCardSelection {
  nameCn: string;
  nameEn: string;
  uprightKeywords: string[];
  reversedKeywords: string[];
  meaning: string;
}

export interface TrustedReadingRequest {
  question: string;
  cards: TrustedReadingCard[];
}

export interface TrustedCosmicReadingCard extends CosmicReadingCardSelection {
  nameCn: string;
  nameEn: string;
  uprightKeywords: string[];
  reversedKeywords: string[];
  meaning: string;
}

export interface TrustedCosmicReadingRequest {
  spreadId: CosmicSpreadId;
  spreadName: string;
  spreadSubtitle: string;
  question: string;
  cards: TrustedCosmicReadingCard[];
}

export interface ReadingResponse {
  past: string;
  present: string;
  future: string;
  summary: string;
}

export interface CosmicReadingSummary {
  overview: string;
  connectionTitle: string;
  connection: string;
  actions: string[];
  reflection: string;
}

export interface CosmicReadingResponse {
  cards: Array<{
    position: string;
    interpretation: string;
  }>;
  summary: CosmicReadingSummary;
}

export type ReadingRequestErrorCode =
  | "INVALID_REQUEST"
  | "INVALID_SPREAD"
  | "QUESTION_TOO_LONG"
  | "REQUEST_TOO_LARGE"
  | "INVALID_CARD_COUNT"
  | "INVALID_CARD_ID"
  | "UNKNOWN_CARD"
  | "INVALID_CARD_POSITION"
  | "DUPLICATE_CARD_POSITION"
  | "INVALID_CARD_ORIENTATION"
  | "DUPLICATE_CARD";

export type ReadingApiErrorCode =
  | ReadingRequestErrorCode
  | "DEEPSEEK_DISABLED"
  | "DEEPSEEK_NOT_CONFIGURED"
  | "DEEPSEEK_AUTH_FAILED"
  | "DEEPSEEK_INSUFFICIENT_BALANCE"
  | "DEEPSEEK_RATE_LIMITED"
  | "DEEPSEEK_TIMEOUT"
  | "DEEPSEEK_UPSTREAM_ERROR"
  | "DEEPSEEK_INVALID_RESPONSE"
  | "INTERNAL_ERROR";

export interface ReadingApiError {
  error: {
    code: ReadingApiErrorCode;
    message: string;
    retryable: boolean;
  };
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
