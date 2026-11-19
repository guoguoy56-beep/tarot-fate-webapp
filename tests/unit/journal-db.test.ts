import { afterEach, expect, test, vi } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { getJournalDatabase, JournalDatabase } from "@/lib/journal-db";
import type { JournalRecord } from "@/lib/journal-record";

const databases: JournalDatabase[] = [], directories: string[] = [];
const userId = "demo-user-a";
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
  db.save(userId, saved);
  expect(db.list(userId)).toEqual([saved]);
});

test("creates missing parent directories and persists cards across close and reopen", () => {
  const path = join(directory(), "nested", "data", "tarot.sqlite"), saved = record("persistent", 5);
  const first = database(path); first.save(userId, saved); first.close();
  expect(existsSync(path)).toBe(true);
  expect(database(path).list(userId)).toEqual([saved]);
});

test("retains more than 20 database journals without trimming history", () => {
  const db = database();
  for (let index = 0; index < 41; index++) db.save(userId, { ...record(`journal-${String(index).padStart(2, "0")}`, 1), createdAt: new Date(Date.UTC(2026, 10, 16, 8, 0, index)).toISOString() });
  const rows = db.list(userId);
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
  for (const row of [z, earliest, a, legacyA]) db.save(userId, row);
  expect(db.list(userId).map((row) => [row.id, row.kind])).toEqual([["a", "legacy"], ["a", "sample"], ["z", "sample"], ["earliest", "sample"]]);
});

test("keeps samples and legacy imports isolated even when their ids are identical", () => {
  const db = database(), sample = record("same", 1), old = record("same", 3, "legacy");
  db.save(userId, sample); db.save(userId, old);
  expect(db.list(userId)).toHaveLength(2);
  db.delete(userId, "sample", "same");
  expect(db.list(userId)).toEqual([old]);
  db.save(userId, sample); db.delete(userId, "legacy", "same");
  expect(db.list(userId)).toEqual([sample]);
});

test.each(["sample", "legacy"] as const)("repeated %s saves never overwrite an existing snapshot", (kind) => {
  const db = database(), original = record("immutable", 3, kind);
  db.save(userId, original);
  db.save(userId, { ...original, question: "改变的问题", summary: "应忽略的新总结", cards: [...original.cards].reverse() });
  expect(db.list(userId)).toEqual([original]);
});

test("keeps a deleted legacy id imported across database reopen so old browsers cannot resurrect it", () => {
  const path = join(directory(), "tarot.sqlite"), original = record("deleted-old", 3, "legacy");
  const first = database(path); first.save(userId, original); first.delete(userId, "legacy", original.id); first.close();
  const reopened = database(path); reopened.save(userId, original);
  expect(reopened.list(userId)).toEqual([]);
  const inspect = new DatabaseSync(path);
  try {
    expect(inspect.prepare("SELECT id FROM user_legacy_imports").all()).toEqual([{ id: original.id }]);
    expect(inspect.prepare("SELECT count(*) AS total FROM user_journal_cards").get()!.total).toBe(0);
  } finally { inspect.close(); }
});

test("allows a deleted sample id to be saved again without creating a legacy tombstone", () => {
  const db = database(), original = record("reusable", 1);
  db.save(userId, original); db.delete(userId, "sample", original.id); db.save(userId, { ...original, summary: "重新保存的内容" });
  expect(db.list(userId)[0].summary).toBe("重新保存的内容");
});

test("cascades card deletion and rejects orphan cards through the actual foreign key", () => {
  const path = join(directory(), "tarot.sqlite"), db = database(path);
  db.save(userId, record("remove", 5));
  const inspect = new DatabaseSync(path);
  try {
    inspect.exec("PRAGMA foreign_keys = ON");
    expect(inspect.prepare("SELECT count(*) AS total FROM user_journal_cards").get()!.total).toBe(5);
    db.delete(userId, "sample", "remove");
    expect(inspect.prepare("SELECT count(*) AS total FROM user_journals").get()!.total).toBe(0);
    expect(inspect.prepare("SELECT count(*) AS total FROM user_journal_cards").get()!.total).toBe(0);
    expect(() => inspect.prepare(`INSERT INTO user_journal_cards
      (user_id, journal_kind, journal_id, card_order, position, card_id, orientation, meaning, keywords, interpretation)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(userId, "sample", "missing", 0, "牌位", "fool", "upright", "", "[]", "内容")).toThrow();
  } finally { inspect.close(); }
});

test.each(["sample", "legacy"] as const)("rolls back the %s parent, cards, and import ledger when a later card insert fails", (kind) => {
  const path = join(directory(), "tarot.sqlite"), db = database(path), valid = record("atomic", 3, kind);
  const invalid = { ...valid, cards: valid.cards.map((card, index) => index === 1 ? { ...card, cardId: valid.cards[0].cardId } : card) };
  expect(() => db.save(userId, invalid)).toThrow();
  expect(db.list(userId)).toEqual([]);
  const inspect = new DatabaseSync(path);
  try {
    for (const table of ["user_journals", "user_journal_cards", "user_legacy_imports"]) expect(inspect.prepare(`SELECT count(*) AS total FROM ${table}`).get()!.total).toBe(0);
  } finally { inspect.close(); }
  db.save(userId, valid);
  expect(db.list(userId)).toEqual([valid]);
});

test("preserves invalid-date legacy text at the end of history while rejecting invalid-date samples", () => {
  const path = join(directory(), "tarot.sqlite"), db = database(path);
  const old = { ...record("unknown-date", 3, "legacy"), createdAt: "旧版未记录日期" };
  const current = record("current", 1);
  db.save(userId, old); db.save(userId, current);
  expect(() => db.save(userId, { ...record("invalid", 1), createdAt: "not-a-date" })).toThrow();
  expect(db.list(userId)).toEqual([current, old]);
  db.close();
  expect(database(path).list(userId)).toEqual([current, old]);
});

test("keeps SQL-looking text as data for both saves and deletes", () => {
  const db = database(), payload = "quoted'); DROP TABLE journals; --";
  const saved = { ...record(payload, 1), question: payload, summary: payload, cards: [{ ...record().cards[0], interpretation: payload }] };
  db.save(userId, saved); db.save(userId, record("safe", 1));
  expect(db.list(userId).find((row) => row.id === payload)).toEqual(saved);
  db.delete(userId, "sample", payload);
  expect(db.list(userId)).toEqual([record("safe", 1)]);
});

test("uses an isolated configurable database and reopens after the cached connection is closed", () => {
  const path = join(directory(), "configured.sqlite");
  vi.stubEnv("TAROT_DATABASE_PATH", path);
  const first = getJournalDatabase(); databases.push(first);
  expect(getJournalDatabase()).toBe(first);
  first.save(userId, record("configured", 1)); first.close();
  const reopened = getJournalDatabase(); databases.push(reopened);
  expect(reopened === first).toBe(false);
  expect(reopened.list(userId)).toEqual([record("configured", 1)]);
});

test("defaults to data/tarot-demo.sqlite under the runtime working directory", () => {
  const root = directory();
  vi.stubEnv("TAROT_DATABASE_PATH", "");
  vi.spyOn(process, "cwd").mockReturnValue(root);
  const db = getJournalDatabase(); databases.push(db);
  db.save(userId, record("default", 1));
  expect(existsSync(join(root, "data", "tarot-demo.sqlite"))).toBe(true);
});

test("switches the configured singleton path without mixing two databases", () => {
  const root = directory(), firstPath = join(root, "first.sqlite"), secondPath = join(root, "second.sqlite");
  vi.stubEnv("TAROT_DATABASE_PATH", firstPath);
  const first = getJournalDatabase(); databases.push(first); first.save(userId, record("first", 1));
  vi.stubEnv("TAROT_DATABASE_PATH", secondPath);
  const second = getJournalDatabase(); databases.push(second);
  expect(second.list(userId)).toEqual([]);
  expect(() => first.list(userId)).toThrow();
  second.save(userId, record("second", 1)); second.close();
  expect(database(firstPath).list(userId)).toEqual([record("first", 1)]);
  expect(database(secondPath).list(userId)).toEqual([record("second", 1)]);
});

test("isolates overlapping journal IDs, cards and deletion across users after reopen", () => {
  const path = join(directory(), "accounts.sqlite"), db = database(path);
  const a = record("same-id", 3), b = { ...record("same-id", 5), question: "用户乙的问题" };
  db.save("user-a", a);
  expect(db.list("user-b")).toEqual([]);
  db.delete("user-b", "sample", a.id);
  expect(db.list("user-a")).toEqual([a]);
  db.save("user-b", b); db.close();
  const reopened = database(path);
  expect(reopened.list("user-a")).toEqual([a]);
  expect(reopened.list("user-b")).toEqual([b]);
  reopened.delete("user-b", "sample", b.id);
  expect(reopened.list("user-b")).toEqual([]);
  expect(reopened.list("user-a")).toEqual([a]);
});

test("scopes deleted legacy import tombstones to the owning user", () => {
  const db = database(), old = record("old-shared-id", 3, "legacy");
  db.save("user-a", old); db.delete("user-a", "legacy", old.id);
  db.save("user-a", old); db.save("user-b", old);
  expect(db.list("user-a")).toEqual([]);
  expect(db.list("user-b")).toEqual([old]);
});

test.each(["", " ", "x".repeat(129)])("requires a valid user ID for every operation: %s", (invalid) => {
  const db = database();
  expect(() => db.list(invalid)).toThrow();
  expect(() => db.save(invalid, record())).toThrow();
  expect(() => db.delete(invalid, "sample", "journal-1")).toThrow();
  expect(db.list(userId)).toEqual([]);
});

test("preserves every old shared table and record without assigning them to the first account", () => {
  const path = join(directory(), "old-shared.sqlite"), shared = new DatabaseSync(path);
  shared.exec(`
    CREATE TABLE journals (id TEXT PRIMARY KEY, question TEXT NOT NULL);
    CREATE TABLE journal_cards (journal_id TEXT, interpretation TEXT);
    CREATE TABLE legacy_imports (id TEXT PRIMARY KEY);
    INSERT INTO journals VALUES ('old-1', '旧共享问题');
    INSERT INTO journal_cards VALUES ('old-1', '旧共享解读');
    INSERT INTO legacy_imports VALUES ('old-1');
  `);
  const before = ["journals", "journal_cards", "legacy_imports"].map((table) => shared.prepare(`SELECT * FROM ${table}`).all());
  shared.close();
  const db = database(path);
  expect(db.list("first-user")).toEqual([]);
  db.save("first-user", record("new-1", 1)); db.close();
  const inspect = new DatabaseSync(path);
  try {
    expect(["journals", "journal_cards", "legacy_imports"].map((table) => inspect.prepare(`SELECT * FROM ${table}`).all())).toEqual(before);
  } finally { inspect.close(); }
  expect(database(path).list("second-user")).toEqual([]);
});

test("persists and deletes kind=ai journals and migrates pre-existing user_journals tables safely", () => {
  const path = join(directory(), "migrate-ai.sqlite");
  const legacyDb = new DatabaseSync(path);
  legacyDb.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE user_journals (
      user_id TEXT NOT NULL CHECK (length(trim(user_id)) > 0),
      kind TEXT NOT NULL CHECK (kind IN ('sample', 'legacy')),
      id TEXT NOT NULL CHECK (length(trim(id)) > 0),
      version INTEGER NOT NULL CHECK (version = 1),
      created_at TEXT NOT NULL,
      created_at_ms INTEGER NOT NULL,
      question TEXT NOT NULL CHECK (length(trim(question)) > 0),
      spread_name TEXT NOT NULL CHECK (length(trim(spread_name)) > 0),
      summary TEXT NOT NULL CHECK (length(trim(summary)) > 0),
      PRIMARY KEY (user_id, kind, id)
    ) STRICT;
    CREATE TABLE user_journal_cards (
      user_id TEXT NOT NULL CHECK (length(trim(user_id)) > 0),
      journal_kind TEXT NOT NULL,
      journal_id TEXT NOT NULL,
      card_order INTEGER NOT NULL CHECK (card_order BETWEEN 0 AND 4),
      position TEXT NOT NULL CHECK (length(trim(position)) > 0),
      card_id TEXT NOT NULL CHECK (length(trim(card_id)) > 0),
      orientation TEXT NOT NULL CHECK (orientation IN ('upright', 'reversed')),
      meaning TEXT NOT NULL,
      keywords TEXT NOT NULL CHECK (json_valid(keywords) AND json_type(keywords) = 'array'),
      interpretation TEXT NOT NULL CHECK (length(trim(interpretation)) > 0),
      PRIMARY KEY (user_id, journal_kind, journal_id, card_order),
      UNIQUE (user_id, journal_kind, journal_id, position),
      UNIQUE (user_id, journal_kind, journal_id, card_id),
      FOREIGN KEY (user_id, journal_kind, journal_id) REFERENCES user_journals(user_id, kind, id) ON DELETE CASCADE
    ) STRICT;
    INSERT INTO user_journals VALUES ('demo-user-a', 'sample', 'before-ai', 1, '2026-11-17T08:00:00.000Z', 1794902400000, '迁移前问题', '单牌', '迁移前总结');
    INSERT INTO user_journal_cards VALUES ('demo-user-a', 'sample', 'before-ai', 0, '核心提示', 'fool', 'upright', '牌义', '["探索"]', '迁移前解读');
  `);
  legacyDb.close();

  const db = database(path);
  const ai = record("ai-1", 5, "ai");
  db.save(userId, ai);
  const items = db.list(userId);
  expect(items.map((item) => [item.id, item.kind])).toEqual([["before-ai", "sample"], ["ai-1", "ai"]]);
  db.delete(userId, "ai", "ai-1");
  expect(db.list(userId).map((item) => item.id)).toEqual(["before-ai"]);
});
