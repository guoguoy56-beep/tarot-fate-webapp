import { isJournalRecord, type JournalRecord } from "@/lib/journal-record";

export type { JournalCard, JournalRecord } from "@/lib/journal-record";

async function request(method: "GET" | "POST" | "DELETE", body?: unknown, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch("/api/journals", {
    method, cache: "no-store", signal,
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  const data: unknown = await response.json();
  if (response.status === 401) throw new Error("登录已失效，请重新登录后访问个人手记。");
  if (!response.ok) throw new Error("手记服务暂时无法访问，请重试。");
  return data;
}

export async function readJournalRecords(signal?: AbortSignal): Promise<JournalRecord[]> {
  // Browser legacy records stay untouched until an explicit account-scoped import is implemented.
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
