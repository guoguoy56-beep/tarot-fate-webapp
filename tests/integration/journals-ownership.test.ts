import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { GET, POST, DELETE } from "@/app/api/journals/route";
import { getJournalDatabase } from "@/lib/journal-db";
import { getSessionForRequest } from "@/lib/auth";
import type { JournalRecord } from "@/lib/journal-record";

vi.mock("@/lib/auth", () => ({ getAuthBaseURL: () => "http://localhost", getSessionForRequest: vi.fn() }));

const snapshot = (question: string): JournalRecord => ({ version: 1, kind: "sample", id: "same-id",
  createdAt: "2026-11-17T00:00:00.000Z", question, spreadName: "单牌", summary: "两账号隔离验收合成内容",
  cards: [{ position: "核心提示", cardId: "fool", orientation: "upright", meaning: "新的开始", keywords: ["探索"], interpretation: question }] });

function user(id: string) {
  vi.mocked(getSessionForRequest).mockResolvedValue({ user: { id, name: id, email: `${id}@example.test` } } as Awaited<ReturnType<typeof getSessionForRequest>>);
}

function mutation(method: string, data: unknown) {
  return new Request("http://localhost/api/journals", { method, headers: { "Content-Type": "application/json", Origin: "http://localhost" }, body: JSON.stringify(data) });
}

const rows = async () => (await (await GET(new Request("http://localhost/api/journals?userId=user-a"))).json()).records;

beforeEach(() => { vi.stubEnv("TAROT_DATABASE_PATH", ":memory:"); vi.mocked(getSessionForRequest).mockReset(); });
afterEach(() => { getJournalDatabase().close(); });

test("actual API and SQLite keep a second account from reading, overwriting or deleting the first account's journal", async () => {
  const a = snapshot("账号甲的合成问题"), b = snapshot("账号乙的合成问题");
  user("user-a");
  expect((await POST(mutation("POST", { records: [a] }))).status).toBe(200);
  expect(await rows()).toEqual([a]);
  user("user-b");
  expect(await rows()).toEqual([]);
  expect((await DELETE(mutation("DELETE", { userId: "user-a", kind: a.kind, id: a.id }))).status).toBe(200);
  expect((await POST(mutation("POST", { userId: "user-a", records: [b] }))).status).toBe(200);
  expect(await rows()).toEqual([b]);
  user("user-a");
  expect(await rows()).toEqual([a]);
  user("user-b");
  expect((await DELETE(mutation("DELETE", { kind: b.kind, id: b.id }))).status).toBe(200);
  expect(await rows()).toEqual([]);
  user("user-a");
  expect(await rows()).toEqual([a]);
});
