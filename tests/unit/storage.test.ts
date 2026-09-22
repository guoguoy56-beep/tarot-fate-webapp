import { afterEach, expect, test, vi } from "vitest";

import { clearReadingRecords, isReadingRecord, readReadingRecords, saveReadingRecord } from "@/lib/storage";
import type { ReadingRecord } from "@/types/reading";

const storageKey = "tarot_reading_records";

function createRecord(id = "reading-1"): ReadingRecord {
  return {
    id,
    question: "我该如何面对变化？",
    createdAt: "2026-09-21T00:00:00.000Z",
    spread: [
      { position: "past", cardId: "fool", orientation: "upright", interpretation: "过去" },
      { position: "present", cardId: "magician", orientation: "reversed", interpretation: "现在" },
      { position: "future", cardId: "high-priestess", orientation: "upright", interpretation: "未来" },
    ],
    summary: "总结",
  };
}

function installStorage(initialValue: string | null) {
  let value = initialValue;
  const storage = {
    getItem: vi.fn((key: string) => (key === storageKey ? value : null)),
    setItem: vi.fn((key: string, nextValue: string) => {
      if (key === storageKey) {
        value = nextValue;
      }
    }),
    removeItem: vi.fn((key: string) => {
      if (key === storageKey) {
        value = null;
      }
    }),
  };

  vi.stubGlobal("window", { localStorage: storage });
  return storage;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test("recognizes a complete current-format reading record", () => {
  expect(isReadingRecord(createRecord())).toBe(true);
});

test.each([
  null,
  {},
  { ...createRecord(), id: "" },
  { ...createRecord(), spread: createRecord().spread.slice(0, 2) },
  {
    ...createRecord(),
    spread: createRecord().spread.map((card, index) =>
      index === 1 ? { ...card, position: "past" } : card,
    ),
  },
  {
    ...createRecord(),
    spread: createRecord().spread.map((card, index) =>
      index === 1 ? { ...card, cardId: "unknown" } : card,
    ),
  },
])("rejects an invalid reading record", (value) => {
  expect(isReadingRecord(value)).toBe(false);
});

test("returns an empty list without a browser storage environment", () => {
  expect(readReadingRecords()).toEqual([]);
});

test.each([null, "{", "{}", JSON.stringify([{}])])("degrades invalid stored data to an empty list", (raw) => {
  installStorage(raw);
  expect(readReadingRecords()).toEqual([]);
});

test("keeps valid records while dropping invalid records", () => {
  const valid = createRecord();
  const invalid = { ...createRecord("bad"), spread: [] };
  installStorage(JSON.stringify([valid, invalid]));

  expect(readReadingRecords()).toEqual([valid]);
});

test("saves the newest record first and keeps at most 20", () => {
  const existing = Array.from({ length: 20 }, (_, index) => createRecord(`reading-${index + 1}`));
  const storage = installStorage(JSON.stringify(existing));
  const newest = createRecord("newest");

  const records = saveReadingRecord(newest);

  expect(records).toHaveLength(20);
  expect(records[0]).toEqual(newest);
  expect(records).not.toContainEqual(existing.at(-1));
  expect(storage.setItem).toHaveBeenCalledWith(storageKey, JSON.stringify(records));
});

test("clears the stored reading list", () => {
  const storage = installStorage(JSON.stringify([createRecord()]));

  clearReadingRecords();

  expect(storage.removeItem).toHaveBeenCalledWith(storageKey);
});
