import type { CosmicReadingResponse, ReadingApiError, ReadingApiErrorCode, ReadingResponse } from "@/types/reading";

export const READING_LENGTH_LIMITS = {
  interpretation: { min: 120, max: 180 },
  summary: { min: 60, max: 100 },
} as const;

export const COSMIC_READING_LENGTH_LIMITS = {
  interpretation: { min: 60, max: 420 },
  overview: { min: 40, max: 360 },
  connectionTitle: { min: 2, max: 24 },
  connection: { min: 40, max: 360 },
  action: { min: 8, max: 160 },
  actionsCount: { min: 2, max: 4 },
  reflection: { min: 8, max: 120 },
} as const;

const readingFields = ["past", "present", "future", "summary"] as const;
const cosmicSummaryFields = ["overview", "connectionTitle", "connection", "actions", "reflection"] as const;

const readingApiErrorCodes: ReadonlySet<string> = new Set<ReadingApiErrorCode>([
  "INVALID_REQUEST",
  "INVALID_SPREAD",
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

function isBoundedText(value: unknown, min: number, max: number): value is string {
  if (typeof value !== "string") return false;
  const length = Array.from(value.trim()).length;
  return length >= min && length <= max;
}

export function isReadingResponse(value: unknown): value is ReadingResponse {
  if (!isRecord(value)) {
    return false;
  }

  return Object.keys(value).length === readingFields.length && readingFields.every((key) => {
    if (!Object.hasOwn(value, key) || typeof value[key] !== "string") {
      return false;
    }
    const length = Array.from(value[key].trim()).length;
    const limits = key === "summary" ? READING_LENGTH_LIMITS.summary : READING_LENGTH_LIMITS.interpretation;
    return length >= limits.min && length <= limits.max;
  });
}

export function isCosmicReadingResponse(
  value: unknown,
  expectedPositions?: readonly string[],
): value is CosmicReadingResponse {
  if (!isRecord(value) || Object.keys(value).length !== 2 || !Object.hasOwn(value, "cards") || !Object.hasOwn(value, "summary")) {
    return false;
  }

  const { cards, summary } = value;
  if (!Array.isArray(cards) || cards.length < 1 || cards.length > 5) {
    return false;
  }

  if (expectedPositions && cards.length !== expectedPositions.length) {
    return false;
  }

  const seenPositions = new Set<string>();
  for (let index = 0; index < cards.length; index++) {
    const item = cards[index];
    if (
      !isRecord(item) ||
      Object.keys(item).length !== 2 ||
      !Object.hasOwn(item, "position") ||
      !Object.hasOwn(item, "interpretation") ||
      !isNonEmptyString(item.position) ||
      !isBoundedText(item.interpretation, COSMIC_READING_LENGTH_LIMITS.interpretation.min, COSMIC_READING_LENGTH_LIMITS.interpretation.max)
    ) {
      return false;
    }
    const position = item.position.trim();
    if (seenPositions.has(position)) {
      return false;
    }
    if (expectedPositions && position !== expectedPositions[index]) {
      return false;
    }
    seenPositions.add(position);
  }

  if (!isRecord(summary) || Object.keys(summary).length !== cosmicSummaryFields.length || !cosmicSummaryFields.every((key) => Object.hasOwn(summary, key))) {
    return false;
  }

  if (
    !isBoundedText(summary.overview, COSMIC_READING_LENGTH_LIMITS.overview.min, COSMIC_READING_LENGTH_LIMITS.overview.max) ||
    !isBoundedText(summary.connectionTitle, COSMIC_READING_LENGTH_LIMITS.connectionTitle.min, COSMIC_READING_LENGTH_LIMITS.connectionTitle.max) ||
    !isBoundedText(summary.connection, COSMIC_READING_LENGTH_LIMITS.connection.min, COSMIC_READING_LENGTH_LIMITS.connection.max) ||
    !isBoundedText(summary.reflection, COSMIC_READING_LENGTH_LIMITS.reflection.min, COSMIC_READING_LENGTH_LIMITS.reflection.max)
  ) {
    return false;
  }

  if (
    !Array.isArray(summary.actions) ||
    summary.actions.length < COSMIC_READING_LENGTH_LIMITS.actionsCount.min ||
    summary.actions.length > COSMIC_READING_LENGTH_LIMITS.actionsCount.max ||
    !summary.actions.every((action) => isBoundedText(action, COSMIC_READING_LENGTH_LIMITS.action.min, COSMIC_READING_LENGTH_LIMITS.action.max))
  ) {
    return false;
  }

  return true;
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
