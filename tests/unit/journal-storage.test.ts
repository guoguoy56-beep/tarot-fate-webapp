import { afterEach, expect, test, vi } from "vitest";
import { readJournalRecords, saveJournalRecord, deleteJournalRecord } from "@/lib/journal-storage";
import { createSampleJournal } from "@/lib/cosmic-journal";
import { cosmicSpreads } from "@/lib/cosmic-experience";
import { tarotCards } from "@/data/tarotCards";

const record = createSampleJournal(cosmicSpreads[0], [{ anchor: 0, cardId: tarotCards[0].id, orientation: "upright" }], "测试问题", "sample-1", "2026-11-16T00:00:00.000Z");
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

test("loads server records without using browser storage as the source of truth", async () => {
  const fetch = vi.fn().mockResolvedValue(json({ records: [record] })); vi.stubGlobal("fetch", fetch);
  expect(await readJournalRecords()).toEqual([record]);
  expect(fetch).toHaveBeenCalledWith("/api/journals", expect.objectContaining({ method: "GET", cache: "no-store" }));
});

test("sends the complete snapshot on save and routes deletion by kind and id", async () => {
  const fetch = vi.fn().mockImplementation(() => Promise.resolve(json({ ok: true }))); vi.stubGlobal("fetch", fetch);
  await saveJournalRecord(record);
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ records: [record] });
  await deleteJournalRecord(record);
  expect(fetch.mock.calls[1][1].method).toBe("DELETE");
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ kind: "sample", id: "sample-1" });
});

test.each([json({ error: {} }, 500), json({ records: [{}] }), new Response("not-json")])("does not report a failed read as empty history", async (response) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
  await expect(readJournalRecords()).rejects.toThrow();
});

test("a failed save remains retryable and does not write browser data", async () => {
  const fetch = vi.fn().mockResolvedValueOnce(json({}, 500)).mockResolvedValueOnce(json({ ok: true })); vi.stubGlobal("fetch", fetch);
  await expect(saveJournalRecord(record)).rejects.toThrow();
  await expect(saveJournalRecord(record)).resolves.toBeUndefined();
});

test("reports an expired session instead of treating it as an empty personal history", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ error: { message: "登录失效" } }, 401)));
  await expect(readJournalRecords()).rejects.toThrow("请重新登录");
});

test("never auto-imports an old shared browser history into the current account", async () => {
  const old = { id: "old-1", createdAt: "2026-09-21T00:00:00.000Z", question: "旧问题", summary: "旧总结", spread: ["past", "present", "future"].map((position, index) => ({ position, cardId: tarotCards[index].id, orientation: "upright", interpretation: `旧正文${index}` })) };
  const original = JSON.stringify([old, { ...old, id: "old-2" }]);
  const getItem = vi.fn(() => original), setItem = vi.fn(), removeItem = vi.fn();
  vi.stubGlobal("window", { localStorage: { getItem, setItem, removeItem } });
  const fetch = vi.fn().mockResolvedValue(json({ records: [] })); vi.stubGlobal("fetch", fetch);
  const controller = new AbortController();
  await readJournalRecords(controller.signal);
  expect(fetch.mock.calls.map((call) => call[1].method)).toEqual(["GET"]);
  expect(getItem).not.toHaveBeenCalled();
  expect(fetch.mock.calls.every((call) => call[1].signal === controller.signal)).toBe(true);
  expect(setItem).not.toHaveBeenCalled(); expect(removeItem).not.toHaveBeenCalled();
});
