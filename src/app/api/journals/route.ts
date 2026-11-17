import { NextResponse } from "next/server";
import { getJournalDatabase } from "@/lib/journal-db";
import { isJournalRecord } from "@/lib/journal-record";
import { getAuthBaseURL, getSessionForRequest } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maxBodyBytes = 128 * 1024;
const storageMessage = "手记存储暂时不可用，请稍后重试。";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function error(status: number, message: string) {
  return json({ error: { message } }, status);
}

function allowedOrigin(request: Request, configuredOrigin: string) {
  const origin = request.headers.get("origin");
  return origin === null || origin === configuredOrigin;
}

async function owner(request: Request): Promise<{ userId: string; origin: string } | { response: Response }> {
  try {
    const session = await getSessionForRequest(request);
    if (!session?.user.id) return { response: error(401, "请先登录后查看和保存个人手记。") };
    return { userId: session.user.id, origin: new URL(getAuthBaseURL()).origin };
  } catch {
    return { response: error(500, storageMessage) };
  }
}

async function readBody(request: Request): Promise<{ data: unknown } | { error: Response }> {
  const tooLarge = () => ({ error: error(413, "手记内容过大，请减少导入数量后重试。") });
  const declared = request.headers.get("content-length");
  if (declared !== null && Number(declared) > maxBodyBytes) return tooLarge();
  if (!request.body) return { error: error(400, "手记请求格式无效。") };
  try {
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > maxBodyBytes) {
          await reader.cancel().catch(() => undefined);
          return tooLarge();
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(received);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      return { data: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown };
    } finally {
      reader.releaseLock();
    }
  } catch {
    return { error: error(400, "手记请求格式无效。") };
  }
}

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

export async function GET(request: Request) {
  const account = await owner(request);
  if ("response" in account) return account.response;
  try {
    return json({ records: getJournalDatabase().list(account.userId) });
  } catch {
    return error(500, storageMessage);
  }
}

export async function POST(request: Request) {
  const account = await owner(request);
  if ("response" in account) return account.response;
  if (!allowedOrigin(request, account.origin)) return error(403, "请从本站页面保存手记。");
  const body = await readBody(request);
  if ("error" in body) return body.error;
  const payload = body.data;
  if (!isObject(payload) || !Array.isArray(payload.records) || payload.records.length < 1
    || payload.records.length > 20 || !payload.records.every(isJournalRecord)) {
    return error(400, "手记内容格式无效，无法保存。");
  }
  try {
    const database = getJournalDatabase();
    for (const record of payload.records) database.save(account.userId, record);
    return json({ ok: true });
  } catch {
    return error(500, storageMessage);
  }
}

export async function DELETE(request: Request) {
  const account = await owner(request);
  if ("response" in account) return account.response;
  if (!allowedOrigin(request, account.origin)) return error(403, "请从本站页面删除手记。");
  const body = await readBody(request);
  if ("error" in body) return body.error;
  const payload = body.data;
  if (!isObject(payload) || (payload.kind !== "sample" && payload.kind !== "legacy")
    || typeof payload.id !== "string" || !payload.id.trim() || payload.id.length > 128) {
    return error(400, "无法识别要删除的手记。");
  }
  try {
    getJournalDatabase().delete(account.userId, payload.kind, payload.id);
    return json({ ok: true });
  } catch {
    return error(500, storageMessage);
  }
}
