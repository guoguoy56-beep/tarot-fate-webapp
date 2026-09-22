import { expect, test } from "vitest";

import { MAX_READING_REQUEST_BYTES } from "@/lib/reading-limits";
import { readReadingRequestBody } from "@/lib/reading-request-body";

function createRequest(body?: BodyInit | null, headers?: HeadersInit) {
  return new Request("http://localhost/api/reading", {
    method: "POST",
    body,
    headers,
  });
}

test("parses a JSON request body within the byte limit", async () => {
  const result = await readReadingRequestBody(createRequest(JSON.stringify({ question: "测试" })));

  expect(result).toEqual({ success: true, data: { question: "测试" } });
});

test("rejects a request without a body", async () => {
  await expect(readReadingRequestBody(createRequest())).resolves.toEqual({ success: false, reason: "invalid" });
});

test("rejects malformed JSON", async () => {
  await expect(readReadingRequestBody(createRequest("{"))).resolves.toEqual({
    success: false,
    reason: "invalid",
  });
});

test("rejects a declared content length above the byte limit", async () => {
  const request = createRequest("{}", { "content-length": String(MAX_READING_REQUEST_BYTES + 1) });

  await expect(readReadingRequestBody(request)).resolves.toEqual({ success: false, reason: "too-large" });
});

test("rejects an oversized streamed body even without a content-length header", async () => {
  const request = createRequest("x".repeat(MAX_READING_REQUEST_BYTES + 1));

  expect(request.headers.has("content-length")).toBe(false);
  await expect(readReadingRequestBody(request)).resolves.toEqual({ success: false, reason: "too-large" });
});
