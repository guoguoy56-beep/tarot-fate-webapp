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

export type ReadingApiErrorCode =
  | "INVALID_REQUEST"
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
