import type { CardOrientation, SpreadPosition } from "./tarot";

export interface ReadingCardPayload {
  cardId: string;
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

export type ReadingRequestErrorCode =
  | "INVALID_REQUEST"
  | "INVALID_CARD_COUNT"
  | "INVALID_CARD_ID"
  | "UNKNOWN_CARD"
  | "INVALID_CARD_POSITION"
  | "DUPLICATE_CARD_POSITION"
  | "INVALID_CARD_ORIENTATION"
  | "DUPLICATE_CARD";

export type ReadingApiErrorCode =
  | ReadingRequestErrorCode
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
