import { beforeEach, expect, test, vi } from "vitest";
import { DELETE, GET, POST } from "@/app/api/journals/route";
import { getJournalDatabase } from "@/lib/journal-db";
import type { JournalRecord } from "@/lib/journal-record";

const database = vi.hoisted(() => ({ list: vi.fn(), save: vi.fn(), delete: vi.fn() }));
vi.mock("@/lib/journal-db", () => ({ getJournalDatabase: vi.fn(() => database) }));

const maxBytes = 128 * 1024;
const privatePath = "D:/private-data/private-journals.sqlite";

function record(id = "journal-1", kind: JournalRecord["kind"] = "sample"): JournalRecord {
  return { version: 1, id, createdAt: "2026-11-16T08:00:00.000Z", kind, question: "接下来应该关注什么？",
    spreadName: "单牌", cards: [{ position: "核心提示", cardId: "fool", orientation: "upright", meaning: "新的开始",
      keywords: ["自由", "探索"], interpretation: "用于验证保存的示例内容。" }], summary: "用于验证保存的整体总结。" };
}

function raw(method: "POST" | "DELETE", body: BodyInit | null, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/journals", { method, body, headers: { "Content-Type": "application/json", ...headers } });
}

function request(method: "POST" | "DELETE", payload: unknown, headers: Record<string, string> = {}) {
  return raw(method, JSON.stringify(payload), headers);
}

async function expectError(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("content-type")).toContain("application/json");
  const payload: unknown = await response.json();
  expect(payload).toEqual({ error: { message: expect.stringMatching(/\S/) } });
  expect(JSON.stringify(payload)).not.toContain(privatePath);
}

function expectUntouched() {
  expect(getJournalDatabase).not.toHaveBeenCalled();
  expect(database.save).not.toHaveBeenCalled();
  expect(database.delete).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.mocked(getJournalDatabase).mockReset().mockReturnValue(database as unknown as ReturnType<typeof getJournalDatabase>);
  database.list.mockReset().mockReturnValue([record()]);
  database.save.mockReset(); database.delete.mockReset();
});

test("lists complete stored snapshots without caching", async () => {
  const rows = [record(), record("legacy-1", "legacy")];
  database.list.mockReturnValue(rows);
  const response = await GET();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ records: rows });
  expect(database.save).not.toHaveBeenCalled();
  expect(database.delete).not.toHaveBeenCalled();
});

test("saves a sample and permits same-origin browser requests", async () => {
  const sample = record();
  const response = await POST(request("POST", { records: [sample] }, { Origin: "http://localhost" }));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ ok: true });
  expect(database.save).toHaveBeenCalledExactlyOnceWith(sample);
});

test("accepts 20 validated old and sample snapshots for import without an Origin header", async () => {
  const rows = Array.from({ length: 20 }, (_, index) => record(`import-${index}`, index % 2 ? "legacy" : "sample"));
  const response = await POST(request("POST", { records: rows }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
  expect(database.save.mock.calls.map(([item]) => item)).toEqual(rows);
});

test.each(["sample", "legacy"] as const)("deletes the selected %s source only", async (kind) => {
  const response = await DELETE(request("DELETE", { kind, id: "same-id" }));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ ok: true });
  expect(database.delete).toHaveBeenCalledExactlyOnceWith(kind, "same-id");
  expect(database.save).not.toHaveBeenCalled();
});

test.each(["POST", "DELETE"] as const)("rejects cross-origin %s before reading storage", async (method) => {
  const action = method === "POST" ? POST : DELETE;
  await expectError(await action(request(method, {}, { Origin: "https://untrusted.example" })), 403);
  expectUntouched();
});

test.each(["POST", "DELETE"] as const)("accepts the actual Host for %s when Next canonicalizes the internal URL", async (method) => {
  const action = method === "POST" ? POST : DELETE;
  const payload = method === "POST" ? { records: [record()] } : { kind: "sample", id: "journal-1" };
  const response = await action(request(method, payload, { Host: "127.0.0.1:3000", Origin: "http://127.0.0.1:3000" }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
});

test.each(["POST", "DELETE"] as const)("still rejects an evil Origin with a valid actual Host for %s", async (method) => {
  const action = method === "POST" ? POST : DELETE;
  const payload = method === "POST" ? { records: [record()] } : { kind: "sample", id: "journal-1" };
  await expectError(await action(request(method, payload, { Host: "127.0.0.1:3000", Origin: "https://untrusted.example" })), 403);
  expectUntouched();
});

test("does not trust x-forwarded-host when checking browser origin", async () => {
  await expectError(await POST(request("POST", { records: [record()] }, {
    Host: "127.0.0.1:3000", Origin: "https://untrusted.example", "x-forwarded-host": "untrusted.example",
  })), 403);
  expectUntouched();
});

test.each(["null", "", "http://localhost:3000"])("rejects an Origin that does not match the request origin: %s", async (origin) => {
  await expectError(await POST(request("POST", { records: [record()] }, { Origin: origin })), 403);
  expectUntouched();
});

test.each([null, "", "{", new Uint8Array([0xff])])("rejects absent, malformed or non-UTF-8 JSON bodies", async (body) => {
  await expectError(await POST(raw("POST", body)), 400);
  expectUntouched();
});

test.each([
  null, [], {}, { records: null }, { records: {} }, { records: [] }, { records: Array(21).fill(record()) },
  { records: [record(), {}] }, { records: [{ ...record(), version: 2 }] },
  { records: [{ ...record(), kind: "ai" }] }, { records: [{ ...record(), question: " " }] },
  { records: [{ ...record(), createdAt: "invalid-date" }] }, { records: [{ ...record(), cards: [] }] },
  { records: [{ ...record(), cards: [{ ...record().cards[0], cardId: "unknown" }] }] },
  { records: [{ ...record(), cards: [{ ...record().cards[0], orientation: "sideways" }] }] },
])("rejects an invalid save payload before any record is written", async (payload) => {
  await expectError(await POST(request("POST", payload)), 400);
  expectUntouched();
});

test.each([null, [], {}, { kind: "sample" }, { kind: "sample", id: 10 }, { kind: "sample", id: " " },
  { kind: "sample", id: "x".repeat(129) }, { kind: "other", id: "journal-1" }])("rejects an invalid delete target", async (payload) => {
  await expectError(await DELETE(request("DELETE", payload)), 400);
  expectUntouched();
});

test("accepts valid JSON at the exact 128 KiB body limit", async () => {
  const body = JSON.stringify({ records: [record()] });
  const padded = body + " ".repeat(maxBytes - new TextEncoder().encode(body).byteLength);
  expect(new TextEncoder().encode(padded)).toHaveLength(maxBytes);
  expect((await POST(raw("POST", padded))).status).toBe(200);
  expect(database.save).toHaveBeenCalledTimes(1);
});

test.each(["POST", "DELETE"] as const)("rejects declared and actual oversized %s bodies", async (method) => {
  const action = method === "POST" ? POST : DELETE;
  await expectError(await action(raw(method, "{}", { "content-length": String(maxBytes + 1) })), 413);
  await expectError(await action(raw(method, " ".repeat(maxBytes + 1), { "content-length": "1" })), 413);
  expectUntouched();
});

test("cancels an oversized streamed body without content-length", async () => {
  const cancel = vi.fn();
  const stream = new ReadableStream<Uint8Array>({ start(controller) {
    controller.enqueue(new Uint8Array(65536)); controller.enqueue(new Uint8Array(65537));
  }, cancel });
  const init: RequestInit & { duplex: "half" } = { method: "POST", body: stream, duplex: "half" };
  const streamed = new Request("http://localhost/api/journals", init);
  await expectError(await POST(streamed), 413);
  expect(cancel).toHaveBeenCalledTimes(1);
  expectUntouched();
});

test("returns a safe format error if the body stream fails", async () => {
  const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.error(new Error(privatePath)); } });
  const init: RequestInit & { duplex: "half" } = { method: "DELETE", body: stream, duplex: "half" };
  await expectError(await DELETE(new Request("http://localhost/api/journals", init)), 400);
  expectUntouched();
});

test.each(["GET", "POST", "DELETE"] as const)("redacts database operation failures for %s", async (method) => {
  const failure = new Error(`SQLITE_CANTOPEN at ${privatePath}`);
  if (method === "GET") database.list.mockImplementationOnce(() => { throw failure; });
  if (method === "POST") database.save.mockImplementationOnce(() => { throw failure; });
  if (method === "DELETE") database.delete.mockImplementationOnce(() => { throw failure; });
  const response = method === "GET" ? await GET() : method === "POST"
    ? await POST(request("POST", { records: [record()] }))
    : await DELETE(request("DELETE", { kind: "sample", id: "journal-1" }));
  await expectError(response, 500);
});

test("redacts database initialization errors", async () => {
  vi.mocked(getJournalDatabase).mockImplementationOnce(() => { throw new Error(privatePath); });
  await expectError(await GET(), 500);
});
