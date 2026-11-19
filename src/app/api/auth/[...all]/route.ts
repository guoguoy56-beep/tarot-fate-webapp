import { NextResponse } from "next/server";
import { getAuth, getAuthBaseURL } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (status: number, message: string) => NextResponse.json({ message }, { status, headers: { "Cache-Control": "no-store" } });

async function handle(request: Request) {
  try {
    const base = new URL(getAuthBaseURL()), url = new URL(request.url);
    const origin = request.headers.get("origin"), host = request.headers.get("host");
    // Next.js may use localhost for its internal URL even when the client uses 127.0.0.1.
    if ((host || url.host) !== base.host || url.protocol !== base.protocol
      || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.port !== base.port
      || (origin !== null && origin !== base.origin) || (request.method === "POST" && origin !== base.origin)) {
      return json(403, "请从本站页面进行登录操作。");
    }
    const permitted = request.method === "GET" ? ["/api/auth/get-session"] : ["/api/auth/sign-in/email", "/api/auth/sign-out"];
    if (!permitted.includes(url.pathname)) return json(404, "本轮演示暂未开放此功能。");
    const headers = new Headers(request.headers);
    // The demo listener binds to loopback. Never trust caller-supplied proxy headers.
    headers.set("x-tarot-client-ip", "127.0.0.1");
    headers.delete("x-forwarded-for"); headers.delete("x-real-ip");
    let body: Uint8Array<ArrayBuffer> | undefined;
    if (request.method === "POST") {
      if (Number(headers.get("content-length")) > 8192) return json(413, "登录请求内容过大。");
      const reader = request.body?.getReader();
      if (reader) {
        const chunks: Uint8Array[] = []; let length = 0;
        try {
          for (;;) {
            const next = await reader.read(); if (next.done) break;
            length += next.value.byteLength;
            if (length > 8192) { await reader.cancel(); return json(413, "登录请求内容过大。"); }
            chunks.push(next.value);
          }
          body = new Uint8Array(length); let offset = 0;
          for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
        } finally { reader.releaseLock(); }
      }
    }
    const response = await (await getAuth()).handler(new Request(new URL(url.pathname + url.search, base), { method: request.method, headers, body }));
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch { return json(503, "登录服务暂时不可用，请使用本地演示启动命令或稍后重试。"); }
}

export const GET = handle;
export const POST = handle;
