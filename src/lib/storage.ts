import { isCardOrientation, isSpreadPosition, isTarotCardId } from "@/lib/reading-validation";
import type { ReadingRecord } from "@/types/reading";

const STORAGE_KEY = "tarot_reading_records";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim());
}

export function isReadingRecord(value: unknown): value is ReadingRecord {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.question) ||
    !isNonEmptyString(value.createdAt) ||
    !isNonEmptyString(value.summary) ||
    !Array.isArray(value.spread) ||
    value.spread.length !== 3
  ) {
    return false;
  }

  const positions = new Set<string>();

  for (const card of value.spread) {
    if (
      !isRecord(card) ||
      !isSpreadPosition(card.position) ||
      positions.has(card.position) ||
      !isTarotCardId(card.cardId) ||
      !isCardOrientation(card.orientation) ||
      !isNonEmptyString(card.interpretation)
    ) {
      return false;
    }

    positions.add(card.position);
  }

  return true;
}

export function readReadingRecords(): ReadingRecord[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isReadingRecord) : [];
  } catch {
    return [];
  }
}

export function saveReadingRecord(record: ReadingRecord): ReadingRecord[] {
  const records = [record, ...readReadingRecords()].slice(0, 20);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  return records;
}

export function clearReadingRecords(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
