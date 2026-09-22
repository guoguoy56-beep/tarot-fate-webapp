import type { ReadingApiError, ReadingApiErrorCode, ReadingResponse } from "@/types/reading";

const readingApiErrorCodes: ReadonlySet<string> = new Set<ReadingApiErrorCode>([
  "INVALID_REQUEST",
  "QUESTION_TOO_LONG",
  "REQUEST_TOO_LARGE",
  "INVALID_CARD_COUNT",
  "INVALID_CARD_ID",
  "UNKNOWN_CARD",
  "INVALID_CARD_POSITION",
  "DUPLICATE_CARD_POSITION",
  "INVALID_CARD_ORIENTATION",
  "DUPLICATE_CARD",
  "DEEPSEEK_DISABLED",
  "DEEPSEEK_NOT_CONFIGURED",
  "DEEPSEEK_AUTH_FAILED",
  "DEEPSEEK_INSUFFICIENT_BALANCE",
  "DEEPSEEK_RATE_LIMITED",
  "DEEPSEEK_TIMEOUT",
  "DEEPSEEK_UPSTREAM_ERROR",
  "DEEPSEEK_INVALID_RESPONSE",
  "INTERNAL_ERROR",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim());
}

export function isReadingResponse(value: unknown): value is ReadingResponse {
  if (!isRecord(value)) {
    return false;
  }

  return ["past", "present", "future", "summary"].every((key) => isNonEmptyString(value[key]));
}

export function getReadingApiError(value: unknown): ReadingApiError["error"] | null {
  if (!isRecord(value) || !isRecord(value.error)) {
    return null;
  }

  const { code, message, retryable } = value.error;

  if (
    typeof code !== "string" ||
    !readingApiErrorCodes.has(code) ||
    !isNonEmptyString(message) ||
    typeof retryable !== "boolean"
  ) {
    return null;
  }

  return { code: code as ReadingApiErrorCode, message, retryable };
}
