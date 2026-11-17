import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync, type SQLOutputValue } from "node:sqlite";
import type { JournalRecord } from "@/lib/journal-record";

type JournalKind = JournalRecord["kind"];
interface JournalRow extends Record<string, SQLOutputValue> {
  kind: JournalKind; id: string; version: 1; created_at: string; question: string; spread_name: string; summary: string;
  position: string; card_id: string; orientation: "upright" | "reversed"; meaning: string; keywords: string; interpretation: string;
}

let current: { path: string; database: JournalDatabase } | undefined;

export class JournalDatabase {
  private readonly database: DatabaseSync;
  private closed = false;

  constructor(path: string) {
    // Existing shared tables are deliberately left untouched; ownership is never inferred.
    // Runtime data files are created after deployment, never bundled as application assets.
    const filename = path === ":memory:" ? path : resolve(/* turbopackIgnore: true */ path);
    if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true });
    this.database = new DatabaseSync(filename);
    try {
      this.database.exec(`
        PRAGMA foreign_keys = ON;
        PRAGMA busy_timeout = 5000;
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS user_journals (
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
        CREATE TABLE IF NOT EXISTS user_journal_cards (
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
        CREATE TABLE IF NOT EXISTS user_legacy_imports (
          user_id TEXT NOT NULL CHECK (length(trim(user_id)) > 0),
          id TEXT NOT NULL CHECK (length(trim(id)) > 0),
          PRIMARY KEY (user_id, id)
        ) STRICT;
        CREATE INDEX IF NOT EXISTS user_journals_created_at ON user_journals(user_id, created_at_ms DESC, id, kind);
      `);
    } catch (error) {
      this.database.close();
      throw error;
    }
  }

  list(userId: string): JournalRecord[] {
    this.assertUserId(userId);
    const rows = this.database.prepare(`
      SELECT j.kind, j.id, j.version, j.created_at, j.question, j.spread_name, j.summary,
        c.position, c.card_id, c.orientation, c.meaning, c.keywords, c.interpretation
      FROM user_journals AS j JOIN user_journal_cards AS c ON c.user_id = j.user_id AND c.journal_kind = j.kind AND c.journal_id = j.id
      WHERE j.user_id = ?
      ORDER BY j.created_at_ms DESC, j.id ASC, j.kind ASC, c.card_order ASC
    `).all(userId) as JournalRow[];
    const records = new Map<string, JournalRecord>();
    for (const row of rows) {
      const key = `${row.kind}:${row.id}`;
      let record = records.get(key);
      if (!record) {
        record = { version: row.version, id: row.id, createdAt: row.created_at, kind: row.kind, question: row.question,
          spreadName: row.spread_name, summary: row.summary, cards: [] };
        records.set(key, record);
      }
      record.cards.push({ position: row.position, cardId: row.card_id, orientation: row.orientation,
        meaning: row.meaning, keywords: JSON.parse(row.keywords) as string[], interpretation: row.interpretation });
    }
    return [...records.values()];
  }

  save(userId: string, record: JournalRecord): void {
    this.assertUserId(userId);
    const parsedTime = Date.parse(record.createdAt);
    if ((record.kind !== "legacy" && !Number.isFinite(parsedTime)) || record.cards.length < 1 || record.cards.length > 5) throw new Error("手记时间或牌组数量无效。");
    const createdAtMs = Number.isFinite(parsedTime) ? parsedTime : 0;
    this.transaction(() => {
      if (record.kind === "legacy") {
        const imported = this.database.prepare("INSERT INTO user_legacy_imports (user_id, id) VALUES (?, ?) ON CONFLICT(user_id, id) DO NOTHING").run(userId, record.id);
        if (Number(imported.changes) === 0) return;
      }
      const inserted = this.database.prepare(`
        INSERT INTO user_journals (user_id, kind, id, version, created_at, created_at_ms, question, spread_name, summary)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, kind, id) DO NOTHING
      `).run(userId, record.kind, record.id, record.version, record.createdAt, createdAtMs, record.question, record.spreadName, record.summary);
      if (Number(inserted.changes) === 0) return;
      const insertCard = this.database.prepare(`
        INSERT INTO user_journal_cards (user_id, journal_kind, journal_id, card_order, position, card_id, orientation, meaning, keywords, interpretation)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      record.cards.forEach((card, index) => {
        insertCard.run(userId, record.kind, record.id, index, card.position, card.cardId, card.orientation,
          card.meaning, JSON.stringify(card.keywords), card.interpretation);
      });
    });
  }

  delete(userId: string, kind: JournalKind, id: string): void {
    this.assertUserId(userId);
    if ((kind !== "sample" && kind !== "legacy") || typeof id !== "string" || !id.trim()) throw new Error("无法识别要删除的手记。");
    this.transaction(() => {
      // Keep the ID even after deleting the body, so an old browser cannot re-import it.
      if (kind === "legacy") this.database.prepare("INSERT INTO user_legacy_imports (user_id, id) VALUES (?, ?) ON CONFLICT(user_id, id) DO NOTHING").run(userId, id);
      this.database.prepare("DELETE FROM user_journals WHERE user_id = ? AND kind = ? AND id = ?").run(userId, kind, id);
    });
  }

  close(): void {
    if (this.closed) return;
    this.database.close();
    this.closed = true;
    if (current?.database === this) current = undefined;
  }

  private assertUserId(userId: string): void {
    if (typeof userId !== "string" || !userId.trim() || userId.length > 128) throw new Error("手记需要有效的登录用户。");
  }

  private transaction(action: () => void): void {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      action();
      this.database.exec("COMMIT");
    } catch (error) {
      try { this.database.exec("ROLLBACK"); } catch { /* Preserve the original write error if cleanup also fails. */ }
      throw error;
    }
  }
}

export function getJournalDatabase(): JournalDatabase {
  const configured = process.env.TAROT_DATABASE_PATH?.trim() || join("data", "tarot-demo.sqlite");
  const path = configured === ":memory:" ? configured : resolve(/* turbopackIgnore: true */ configured);
  if (!current || current.path !== path) {
    current?.database.close();
    current = { path, database: new JournalDatabase(path) };
  }
  return current.database;
}
