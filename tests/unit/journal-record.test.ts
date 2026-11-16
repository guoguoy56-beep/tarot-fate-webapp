import { expect, test } from "vitest";
import { cosmicSpreads } from "@/lib/cosmic-experience";
import { createSampleJournal, sampleCardReading, sampleSummary } from "@/lib/cosmic-journal";
import { isJournalRecord, journalFromLegacy } from "@/lib/journal-record";
import { tarotCards } from "@/data/tarotCards";

const selections = tarotCards.slice(0, 5).map((card, anchor) => ({ anchor, cardId: card.id, orientation: anchor % 2 ? "reversed" as const : "upright" as const }));
const create = () => createSampleJournal(cosmicSpreads[2], selections.slice(0, 3), "如何面对变化？", "journal-1", "2026-11-16T00:00:00.000Z");

test.each(cosmicSpreads)("captures the displayed cards and summary for $name", (spread) => {
  const selected = selections.slice(0, spread.slots.length);
  const record = createSampleJournal(spread, selected, "  如何面对变化？  ", "journal-1", "2026-11-16T00:00:00.000Z");
  expect(isJournalRecord(record)).toBe(true);
  expect(record.question).toBe("如何面对变化？");
  expect(record.cards.map((card) => card.position)).toEqual([...spread.slots]);
  expect(record.cards.map((card) => card.orientation)).toEqual(selected.map((card) => card.orientation));
  for (const [index, card] of record.cards.entries()) expect(card).toEqual(sampleCardReading(selected[index], spread.slots[index]));
  const summary = sampleSummary(spread, selected);
  expect(record.summary).toContain(summary.overview);
  expect(record.summary).toContain(summary.connection);
  expect(record.summary).toContain(summary.reflection);
  for (const action of summary.actions) expect(record.summary).toContain(action);
  expect(JSON.parse(JSON.stringify(record))).toEqual(record);
});

test.each([
  { version: 2 }, { kind: "ai" }, { id: "" }, { createdAt: "bad-date" }, { question: "" }, { spreadName: "" }, { summary: "" },
  { cards: [] }, { cards: Array.from({ length: 6 }, () => create().cards[0]) },
  { cards: [create().cards[0], create().cards[0]] },
  { cards: [{ ...create().cards[0], cardId: "unknown" }] },
  { cards: [{ ...create().cards[0], orientation: "invalid" }] },
  { cards: [{ ...create().cards[0], interpretation: "" }] },
])("rejects malformed snapshots", (changes) => expect(isJournalRecord({ ...create(), ...changes })).toBe(false));

test("preserves old three-card content and tolerates its historical date format", () => {
  const record = journalFromLegacy({ id: "old-1", createdAt: "unrecorded", question: "旧问题", summary: "旧总结",
    spread: ["past", "present", "future"].map((position, index) => ({ position: position as "past" | "present" | "future", cardId: selections[index].cardId, orientation: selections[index].orientation, interpretation: `旧正文${index}` })) });
  expect(isJournalRecord(record)).toBe(true);
  expect(record.kind).toBe("legacy");
  expect(record.cards.map((card) => card.position)).toEqual(["过去", "现在", "未来"]);
  expect(record.cards.map((card) => card.interpretation)).toEqual(["旧正文0", "旧正文1", "旧正文2"]);
  expect(record.summary).toBe("旧总结");
});
