import { MAX_READING_REQUEST_BYTES } from "@/lib/reading-limits";

export type ReadingRequestBodyResult =
  | { success: true; data: unknown }
  | { success: false; reason: "invalid" | "too-large" };

export async function readReadingRequestBody(request: Request): Promise<ReadingRequestBodyResult> {
  const contentLength = request.headers.get("content-length");

  if (contentLength !== null) {
    const declaredBytes = Number(contentLength);

    if (Number.isFinite(declaredBytes) && declaredBytes > MAX_READING_REQUEST_BYTES) {
      return { success: false, reason: "too-large" };
    }
  }

  if (!request.body) {
    return { success: false, reason: "invalid" };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      receivedBytes += value.byteLength;

      if (receivedBytes > MAX_READING_REQUEST_BYTES) {
        await reader.cancel().catch(() => undefined);
        return { success: false, reason: "too-large" };
      }

      chunks.push(value);
    }

    const body = new Uint8Array(receivedBytes);
    let offset = 0;

    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const text = new TextDecoder("utf-8", { fatal: true }).decode(body);
    return { success: true, data: JSON.parse(text) as unknown };
  } catch {
    return { success: false, reason: "invalid" };
  }
}
