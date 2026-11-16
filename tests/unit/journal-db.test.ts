import { afterEach, expect, test, vi } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { getJournalDatabase, JournalDatabase } from "@/lib/journal-db";
import type { JournalRecord } from "@/lib/journal-record";

const databases: JournalDatabase[] = [], directories: string[] = [];
const ids = ["fool", "magician", "high-priestess", "empress", "emperor"];

function record(id = "journal-1", count = 3, kind: JournalRecord["kind"] = "sample"): JournalRecord {
  return { version: 1, id, kind, createdAt: "2026-11-16T08:00:00.000Z", question: "下一步应该关注什么？",
    spreadName: `${count}张牌`, summary: "这是一份完整的保存快照。", cards: ids.slice(0, count).map((cardId, index) => ({
      position: `牌位${index + 1}`, cardId, orientation: index % 2 ? "reversed" : "upright",
      meaning: kind === "legacy" ? "" : `牌义${index + 1}`, keywords: kind === "legacy" ? [] : ["线索", `关键词${index + 1}`], interpretation: `对应第${index + 1}张的解读`,
    })) };
}

function directory() {
  const path = mkdtempSync(join(tmpdir(), "tarot-journal-db-"));
  directories.push(path); return path;
}

function database(path = ":memory:") {
  const db = new JournalDatabase(path); databases.push(db); return db;
}

afterEach(() => {
  databases.splice(0).forEach((db) => db.close());
  vi.restoreAllMocks(); vi.unstubAllEnvs();
  for (const path of directories.splice(0)) {
    const absolute = resolve(path);
    if (dirname(absolute) !== resolve(tmpdir()) || !basename(absolute).startsWith("tarot-journal-db-")) throw new Error("Unexpected temporary database directory");
    rmSync(absolute, { recursive: true, force: true });
  }
});

test.each([1, 2, 3, 4, 5])("round-trips a complete %i-card snapshot with order and orientations", (count) => {
  const db = database(), saved = record(`cards-${count}`, count);
  db.save(saved);
  expect(db.list()).toEqual([saved]);
});

test("creates missing parent directories and persists cards across close and reopen", () => {
  const path = join(directory(), "nested", "data", "tarot.sqlite"), saved = record("persistent", 5);
  const first = database(path); first.save(saved); first.close();
  expect(existsSync(path)).toBe(true);
  expect(database(path).list()).toEqual([saved]);
});

test("retains more than 20 database journals without trimming history", () => {
  const db = database();
  for (let index = 0; index < 41; index++) db.save({ ...record(`journal-${String(index).padStart(2, "0")}`, 1), createdAt: new Date(Date.UTC(2026, 10, 16, 8, 0, index)).toISOString() });
  const rows = db.list();
  expect(rows).toHaveLength(41);
  expect(rows[0].id).toBe("journal-40");
  expect(rows.at(-1)!.id).toBe("journal-00");
});

test("sorts by actual time including offsets, with stable id and source ordering for ties", () => {
  const db = database();
  const earliest = { ...record("earliest", 1), createdAt: "2026-11-16T12:00:00+08:00" };
  const z = { ...record("z", 1), createdAt: "2026-11-16T05:00:00.000Z" };
  const a = { ...record("a", 1), createdAt: "2026-11-16T13:00:00+08:00" };
  const legacyA = { ...a, kind: "legacy" as const };
  for (const row of [z, earliest, a, legacyA]) db.save(row);
  expect(db.list().map((row) => [row.id, row.kind])).toEqual([["a", "legacy"], ["a", "sample"], ["z", "sample"], ["earliest", "sample"]]);
});

test("keeps samples and legacy imports isolated even when their ids are identical", () => {
  const db = database(), sample = record("same", 1), old = record("same", 3, "legacy");
  db.save(sample); db.save(old);
  expect(db.list()).toHaveLength(2);
  db.delete("sample", "same");
  expect(db.list()).toEqual([old]);
  db.save(sample); db.delete("legacy", "same");
  expect(db.list()).toEqual([sample]);
});

test.each(["sample", "legacy"] as const)("repeated %s saves never overwrite an existing snapshot", (kind) => {
  const db = database(), original = record("immutable", 3, kind);
  db.save(original);
  db.save({ ...original, question: "改变的问题", summary: "应忽略的新总结", cards: [...original.cards].reverse() });
  expect(db.list()).toEqual([original]);
});

test("keeps a deleted legacy id imported across database reopen so old browsers cannot resurrect it", () => {
  const path = join(directory(), "tarot.sqlite"), original = record("deleted-old", 3, "legacy");
  const first = database(path); first.save(original); first.delete("legacy", original.id); first.close();
  const reopened = database(path); reopened.save(original);
  expect(reopened.list()).toEqual([]);
  const inspect = new DatabaseSync(path);
  try {
    expect(inspect.prepare("SELECT id FROM legacy_imports").all()).toEqual([{ id: original.id }]);
    expect(inspect.prepare("SELECT count(*) AS total FROM journal_cards").get()!.total).toBe(0);
  } finally { inspect.close(); }
});

test("allows a deleted sample id to be saved again without creating a legacy tombstone", () => {
  const db = database(), original = record("reusable", 1);
  db.save(original); db.delete("sample", original.id); db.save({ ...original, summary: "重新保存的内容" });
  expect(db.list()[0].summary).toBe("重新保存的内容");
});

test("cascades card deletion and rejects orphan cards through the actual foreign key", () => {
  const path = join(directory(), "tarot.sqlite"), db = database(path);
  db.save(record("remove", 5));
  const inspect = new DatabaseSync(path);
  try {
    inspect.exec("PRAGMA foreign_keys = ON");
    expect(inspect.prepare("SELECT count(*) AS total FROM journal_cards").get()!.total).toBe(5);
    db.delete("sample", "remove");
    expect(inspect.prepare("SELECT count(*) AS total FROM journals").get()!.total).toBe(0);
    expect(inspect.prepare("SELECT count(*) AS total FROM journal_cards").get()!.total).toBe(0);
    expect(() => inspect.prepare(`INSERT INTO journal_cards
      (journal_kind, journal_id, card_order, position, card_id, orientation, meaning, keywords, interpretation)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run("sample", "missing", 0, "牌位", "fool", "upright", "", "[]", "内容")).toThrow();
  } finally { inspect.close(); }
});

test.each(["sample", "legacy"] as const)("rolls back the %s parent, cards, and import ledger when a later card insert fails", (kind) => {
  const path = join(directory(), "tarot.sqlite"), db = database(path), valid = record("atomic", 3, kind);
  const invalid = { ...valid, cards: valid.cards.map((card, index) => index === 1 ? { ...card, cardId: valid.cards[0].cardId } : card) };
  expect(() => db.save(invalid)).toThrow();
  expect(db.list()).toEqual([]);
  const inspect = new DatabaseSync(path);
  try {
    for (const table of ["journals", "journal_cards", "legacy_imports"]) expect(inspect.prepare(`SELECT count(*) AS total FROM ${table}`).get()!.total).toBe(0);
  } finally { inspect.close(); }
  db.save(valid);
  expect(db.list()).toEqual([valid]);
});

test("preserves invalid-date legacy text at the end of history while rejecting invalid-date samples", () => {
  const path = join(directory(), "tarot.sqlite"), db = database(path);
  const old = { ...record("unknown-date", 3, "legacy"), createdAt: "旧版未记录日期" };
  const current = record("current", 1);
  db.save(old); db.save(current);
  expect(() => db.save({ ...record("invalid", 1), createdAt: "not-a-date" })).toThrow();
  expect(db.list()).toEqual([current, old]);
  db.close();
  expect(database(path).list()).toEqual([current, old]);
});

test("keeps SQL-looking text as data for both saves and deletes", () => {
  const db = database(), payload = "quoted'); DROP TABLE journals; --";
  const saved = { ...record(payload, 1), question: payload, summary: payload, cards: [{ ...record().cards[0], interpretation: payload }] };
  db.save(saved); db.save(record("safe", 1));
  expect(db.list().find((row) => row.id === payload)).toEqual(saved);
  db.delete("sample", payload);
  expect(db.list()).toEqual([record("safe", 1)]);
});

test("uses an isolated configurable database and reopens after the cached connection is closed", () => {
  const path = join(directory(), "configured.sqlite");
  vi.stubEnv("TAROT_DATABASE_PATH", path);
  const first = getJournalDatabase(); databases.push(first);
  expect(getJournalDatabase()).toBe(first);
  first.save(record("configured", 1)); first.close();
  const reopened = getJournalDatabase(); databases.push(reopened);
  expect(reopened === first).toBe(false);
  expect(reopened.list()).toEqual([record("configured", 1)]);
});

test("defaults to data/tarot.sqlite under the runtime working directory", () => {
  const root = directory();
  vi.stubEnv("TAROT_DATABASE_PATH", "");
  vi.spyOn(process, "cwd").mockReturnValue(root);
  const db = getJournalDatabase(); databases.push(db);
  db.save(record("default", 1));
  expect(existsSync(join(root, "data", "tarot.sqlite"))).toBe(true);
});

test("switches the configured singleton path without mixing two databases", () => {
  const root = directory(), firstPath = join(root, "first.sqlite"), secondPath = join(root, "second.sqlite");
  vi.stubEnv("TAROT_DATABASE_PATH", firstPath);
  const first = getJournalDatabase(); databases.push(first); first.save(record("first", 1));
  vi.stubEnv("TAROT_DATABASE_PATH", secondPath);
  const second = getJournalDatabase(); databases.push(second);
  expect(second.list()).toEqual([]);
  expect(() => first.list()).toThrow();
  second.save(record("second", 1)); second.close();
  expect(database(firstPath).list()).toEqual([record("first", 1)]);
  expect(database(secondPath).list()).toEqual([record("second", 1)]);
});
