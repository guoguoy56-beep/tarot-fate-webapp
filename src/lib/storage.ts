import type { ReadingRecord } from "@/types/reading";

const STORAGE_KEY = "tarot_reading_records";

export function readReadingRecords(): ReadingRecord[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ReadingRecord[]) : [];
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
