import { isJournalRecord, journalFromLegacy, type JournalRecord } from "@/lib/journal-record";
import { readReadingRecords } from "@/lib/storage";

export type { JournalCard, JournalRecord } from "@/lib/journal-record";

async function request(method: "GET" | "POST" | "DELETE", body?: unknown, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch("/api/journals", {
    method, cache: "no-store", signal,
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  const data: unknown = await response.json();
  if (!response.ok) throw new Error("手记服务暂时无法访问，请重试。");
  return data;
}

export async function readJournalRecords(signal?: AbortSignal): Promise<JournalRecord[]> {
  // Import is idempotent on the server, including IDs of legacy records deleted there.
  // Keep the browser original intact so a failed import can always be retried.
  const legacy = readReadingRecords().map(journalFromLegacy).filter(isJournalRecord);
  for (const record of legacy) await request("POST", { records: [record] }, signal);
  const data = await request("GET", undefined, signal);
  if (!data || typeof data !== "object" || !("records" in data) || !Array.isArray(data.records)
    || !data.records.every(isJournalRecord)) throw new Error("手记数据格式异常，请重试。");
  return data.records;
}

export async function saveJournalRecord(record: JournalRecord): Promise<void> {
  if (!isJournalRecord(record) || record.kind !== "sample") throw new Error("手记内容格式无效，无法保存。");
  await request("POST", { records: [record] });
}

export async function deleteJournalRecord(record: JournalRecord): Promise<void> {
  await request("DELETE", { kind: record.kind, id: record.id });
}
