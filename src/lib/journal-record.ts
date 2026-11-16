import { isCardOrientation, isTarotCardId } from "@/lib/reading-validation";
import type { ReadingRecord } from "@/types/reading";
import type { CardOrientation } from "@/types/tarot";

export interface JournalCard {
  position: string;
  cardId: string;
  orientation: CardOrientation;
  meaning: string;
  keywords: string[];
  interpretation: string;
}

export interface JournalRecord {
  version: 1;
  id: string;
  createdAt: string;
  kind: "sample" | "legacy";
  question: string;
  spreadName: string;
  cards: JournalCard[];
  summary: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max: number): value is string => typeof value === "string" && Boolean(value.trim()) && value.length <= max;

export function isJournalRecord(value: unknown): value is JournalRecord {
  if (!isRecord(value) || value.version !== 1 || (value.kind !== "sample" && value.kind !== "legacy")
    || !text(value.id, 128) || !text(value.question, 4000) || !text(value.spreadName, 100) || !text(value.summary, 32000)
    || !text(value.createdAt, 80) || (value.kind === "sample" && !Number.isFinite(Date.parse(value.createdAt)))
    || !Array.isArray(value.cards) || value.cards.length < 1 || value.cards.length > 5) return false;
  const positions = new Set<string>(), cards = new Set<string>();
  for (const card of value.cards) {
    if (!isRecord(card) || !text(card.position, 100) || !isTarotCardId(card.cardId) || !isCardOrientation(card.orientation)
      || typeof card.meaning !== "string" || card.meaning.length > 16000
      || !Array.isArray(card.keywords) || card.keywords.length > 20 || !card.keywords.every((word) => text(word, 100))
      || !text(card.interpretation, 16000) || positions.has(card.position.trim()) || cards.has(card.cardId)) return false;
    positions.add(card.position.trim()); cards.add(card.cardId);
  }
  return true;
}

export function journalFromLegacy(record: ReadingRecord): JournalRecord {
  const positions = { past: "过去", present: "现在", future: "未来" } as const;
  return { version: 1, id: record.id, createdAt: record.createdAt, kind: "legacy", question: record.question,
    spreadName: "过去现在未来", summary: record.summary,
    cards: record.spread.map((card) => ({ position: positions[card.position], cardId: card.cardId,
      orientation: card.orientation, meaning: "", keywords: [], interpretation: card.interpretation })) };
}
