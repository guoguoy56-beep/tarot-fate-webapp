import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { POST } from "@/app/api/reading/route";
import { tarotCardMap } from "@/data/tarotCards";
import { DeepSeekReadingError, requestDeepSeekReading } from "@/lib/deepseek";
import { MAX_READING_REQUEST_BYTES } from "@/lib/reading-limits";
import type { ReadingApiErrorCode, ReadingRequest, ReadingRequestErrorCode } from "@/types/reading";

vi.mock("@/lib/deepseek", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/deepseek")>()),
  requestDeepSeekReading: vi.fn(),
}));

const requestReadingMock = vi.mocked(requestDeepSeekReading);
const logInfo = vi.fn();
const logWarn = vi.fn();
const fakeApiKey = "test004-only-api-key";
const privateQuestion = "TEST004_PRIVATE_QUESTION：如何面对变化？";
const privateReading = "TEST004_PRIVATE_READING";
const forgedMetadata = "TEST004_FORGED_CARD_METADATA";
const privateException = "TEST004_PRIVATE_EXCEPTION";
const privateStack = "TEST004_PRIVATE_STACK";
const privatePrompt = "TEST004_PRIVATE_PROMPT";
const privateMarkers = [
  fakeApiKey, privateQuestion, privateReading, forgedMetadata, privateException, privateStack, privatePrompt,
];
const reading = {
  past: `${privateReading}：过去解读`,
  present: "现在解读",
  future: "未来解读",
  summary: "总结箴言",
};
const usage = {
  promptTokens: 120,
  completionTokens: 80,
  totalTokens: 200,
  promptCacheHitTokens: null,
  promptCacheMissTokens: null,
};
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

function createPayload(): ReadingRequest {
  return {
    question: `  ${privateQuestion}\r\n请给我提示。  `,
    cards: [
      { cardId: "fool", position: "past", orientation: "upright" },
      { cardId: "magician", position: "present", orientation: "reversed" },
      { cardId: "high-priestess", position: "future", orientation: "upright" },
    ],
  };
}

function rawRequest(body: BodyInit | null, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/reading", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
}

function jsonRequest(payload: unknown = createPayload()) {
  return rawRequest(JSON.stringify(payload));
}

function paddedRequestBody(bytes: number) {
  const body = JSON.stringify(createPayload());
  return body + " ".repeat(bytes - new TextEncoder().encode(body).byteLength);
}

async function expectApiError(response: Response, status: number, code: ReadingApiErrorCode, retryable = false) {
  expect(response.status).toBe(status);
  expect(response.headers.get("content-type")).toContain("application/json");
  const body: unknown = await response.json();
  expect(body).toEqual({ error: { code, message: expect.stringMatching(/\S/), retryable } });

  const serialized = JSON.stringify(body);
  for (const marker of privateMarkers) {
    expect(serialized).not.toContain(marker);
  }
}

beforeEach(() => {
  requestReadingMock.mockReset();
  requestReadingMock.mockResolvedValue({ reading, usage, model: "test004-provider-model" });
  fetchMock = vi.fn<typeof fetch>(async () => {
    throw new Error("unexpected external fetch in API integration test");
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("DEEPSEEK_API_KEY", fakeApiKey);
  vi.spyOn(console, "info").mockImplementation(logInfo);
  vi.spyOn(console, "warn").mockImplementation(logWarn);
});

afterEach(() => {
  expect(fetchMock).not.toHaveBeenCalled();
  const logs = JSON.stringify([...logInfo.mock.calls, ...logWarn.mock.calls]);
  for (const marker of privateMarkers) {
    expect(logs).not.toContain(marker);
  }
});

test("returns only the reading for a valid three-card request and logs safe usage metrics", async () => {
  const response = await POST(jsonRequest());

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("application/json");
  expect(await response.json()).toEqual(reading);
  expect(requestReadingMock).toHaveBeenCalledTimes(1);
  expect(logInfo).toHaveBeenCalledTimes(1);
  expect(logWarn).not.toHaveBeenCalled();
  const event: unknown = JSON.parse(String(logInfo.mock.calls[0][0]).replace(/^\[tarot.reading\] /, ""));
  expect(event).toMatchObject({
    event: "tarot.reading",
    outcome: "success",
    upstreamRequested: true,
    model: "test004-provider-model",
    usage,
  });
});

test("normalizes the question and rebuilds every card from production data before calling DeepSeek", async () => {
  const payload = createPayload();
  const response = await POST(jsonRequest({
    ...payload,
    prompt: privatePrompt,
    cards: payload.cards.map((card) => ({
      ...card,
      nameCn: forgedMetadata,
      nameEn: forgedMetadata,
      meaning: forgedMetadata,
      uprightKeywords: [forgedMetadata],
      reversedKeywords: [forgedMetadata],
    })),
  }));

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(reading);
  expect(requestReadingMock).toHaveBeenCalledExactlyOnceWith({
    question: `${privateQuestion}\n请给我提示。`,
    cards: payload.cards.map((card) => {
      const trusted = tarotCardMap.get(card.cardId)!;
      return {
        ...card,
        nameCn: trusted.nameCn,
        nameEn: trusted.nameEn,
        meaning: trusted.meaning,
        uprightKeywords: trusted.uprightKeywords,
        reversedKeywords: trusted.reversedKeywords,
      };
    }),
  });
});

test("accepts exactly 500 Unicode code points rather than counting UTF-16 code units", async () => {
  const question = "🔮".repeat(500);
  const response = await POST(jsonRequest({ ...createPayload(), question }));

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(reading);
  expect(requestReadingMock).toHaveBeenCalledWith(expect.objectContaining({ question }));
});

test.each([
  ["missing body", null],
  ["empty body", ""],
  ["malformed JSON", "{"],
  ["non-object JSON", "null"],
  ["invalid UTF-8", new Uint8Array([0xff])],
] satisfies Array<[string, BodyInit | null]>)("returns 400 for %s before reaching DeepSeek", async (_name, body) => {
  await expectApiError(await POST(rawRequest(body)), 400, "INVALID_REQUEST");
  expect(requestReadingMock).not.toHaveBeenCalled();
  expect(logInfo).not.toHaveBeenCalled();
  expect(logWarn).not.toHaveBeenCalled();
});

const invalidPayloads: Array<[string, (payload: ReadingRequest) => unknown, ReadingRequestErrorCode]> = [
  ["blank question", (payload) => ({ ...payload, question: " \r\n " }), "INVALID_REQUEST"],
  ["missing question", (payload) => ({ cards: payload.cards }), "INVALID_REQUEST"],
  ["overlong question", (payload) => ({ ...payload, question: "🔮".repeat(501) }), "QUESTION_TOO_LONG"],
  ["missing cards", (payload) => ({ question: payload.question }), "INVALID_REQUEST"],
  ["wrong card count", (payload) => ({ ...payload, cards: payload.cards.slice(0, 2) }), "INVALID_CARD_COUNT"],
  ["invalid card ID", (payload) => ({
    ...payload, cards: [{ ...payload.cards[0], cardId: 42 }, ...payload.cards.slice(1)],
  }), "INVALID_CARD_ID"],
  ["unknown card ID", (payload) => ({
    ...payload, cards: [{ ...payload.cards[0], cardId: privateException }, ...payload.cards.slice(1)],
  }), "UNKNOWN_CARD"],
  ["invalid position", (payload) => ({
    ...payload, cards: [{ ...payload.cards[0], position: "center" }, ...payload.cards.slice(1)],
  }), "INVALID_CARD_POSITION"],
  ["duplicate positions", (payload) => ({
    ...payload, cards: [payload.cards[0], { ...payload.cards[1], position: "past" }, payload.cards[2]],
  }), "DUPLICATE_CARD_POSITION"],
  ["invalid orientation", (payload) => ({
    ...payload, cards: [{ ...payload.cards[0], orientation: "sideways" }, ...payload.cards.slice(1)],
  }), "INVALID_CARD_ORIENTATION"],
  ["duplicate cards", (payload) => ({
    ...payload, cards: [payload.cards[0], { ...payload.cards[1], cardId: "fool" }, payload.cards[2]],
  }), "DUPLICATE_CARD"],
];

test.each(invalidPayloads)("returns the public 400 contract for %s", async (_name, change, code) => {
  await expectApiError(await POST(jsonRequest(change(createPayload()))), 400, code);
  expect(requestReadingMock).not.toHaveBeenCalled();
  expect(logInfo).not.toHaveBeenCalled();
  expect(logWarn).not.toHaveBeenCalled();
});

test("accepts a valid JSON body at the exact 4096-byte limit", async () => {
  const body = paddedRequestBody(MAX_READING_REQUEST_BYTES);
  expect(new TextEncoder().encode(body)).toHaveLength(MAX_READING_REQUEST_BYTES);

  const response = await POST(rawRequest(body));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(reading);
  expect(requestReadingMock).toHaveBeenCalledTimes(1);
});

test.each([
  ["oversized declared length", "{}", { "content-length": String(MAX_READING_REQUEST_BYTES + 1) }],
  ["oversized body with a misleading length", paddedRequestBody(MAX_READING_REQUEST_BYTES + 1), { "content-length": "1" }],
])("returns 413 for an %s", async (_name, body, headers) => {
  await expectApiError(await POST(rawRequest(body, headers)), 413, "REQUEST_TOO_LARGE");
  expect(requestReadingMock).not.toHaveBeenCalled();
  expect(logInfo).not.toHaveBeenCalled();
  expect(logWarn).not.toHaveBeenCalled();
});

test("returns 413 for oversized chunks without content-length and cancels the stream", async () => {
  const bytes = new TextEncoder().encode(paddedRequestBody(MAX_READING_REQUEST_BYTES + 1));
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes.slice(0, 2000));
      controller.enqueue(bytes.slice(2000));
    },
    cancel,
  });
  const init: RequestInit & { duplex: "half" } = { method: "POST", body, duplex: "half" };
  const request = new Request("http://localhost/api/reading", init);
  expect(request.headers.has("content-length")).toBe(false);

  await expectApiError(await POST(request), 413, "REQUEST_TOO_LARGE");
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(requestReadingMock).not.toHaveBeenCalled();
  expect(logInfo).not.toHaveBeenCalled();
  expect(logWarn).not.toHaveBeenCalled();
});

test.each([
  ["DEEPSEEK_DISABLED", 503, false, null, false],
  ["DEEPSEEK_NOT_CONFIGURED", 503, false, null, false],
  ["DEEPSEEK_AUTH_FAILED", 502, false, 401, true],
  ["DEEPSEEK_INSUFFICIENT_BALANCE", 503, false, 402, true],
  ["DEEPSEEK_RATE_LIMITED", 503, true, 429, true],
  ["DEEPSEEK_TIMEOUT", 504, true, null, true],
  ["DEEPSEEK_UPSTREAM_ERROR", 502, true, 500, true],
  ["DEEPSEEK_INVALID_RESPONSE", 502, true, null, true],
] satisfies Array<[ReadingApiErrorCode, number, boolean, number | null, boolean]>)(
  "maps %s to a safe HTTP error and the appropriate metric",
  async (code, status, retryable, providerStatus, upstreamRequested) => {
    requestReadingMock.mockRejectedValueOnce(new DeepSeekReadingError(
      code, "适配器提供的安全错误提示。", status, retryable, providerStatus, usage, "test004-provider-model",
    ));

    await expectApiError(await POST(jsonRequest()), status, code, retryable);
    expect(requestReadingMock).toHaveBeenCalledTimes(1);
    expect(logInfo).not.toHaveBeenCalled();
    expect(logWarn).toHaveBeenCalledTimes(1);
    const event: unknown = JSON.parse(String(logWarn.mock.calls[0][0]).replace(/^\[tarot.reading\] /, ""));
    expect(event).toMatchObject({
      event: "tarot.reading",
      outcome: upstreamRequested ? "failure" : "blocked",
      upstreamRequested,
      errorCode: code,
      status,
      retryable,
    });
  },
);

test("turns unexpected exceptions into a generic 500 without leaking private fields or stack traces", async () => {
  const error = Object.assign(new Error(`${privateException}: ${fakeApiKey}`), { prompt: privatePrompt });
  error.stack = `${privateStack}: ${fakeApiKey}`;
  requestReadingMock.mockRejectedValueOnce(error);

  await expectApiError(await POST(jsonRequest()), 500, "INTERNAL_ERROR", true);
  expect(requestReadingMock).toHaveBeenCalledTimes(1);
  expect(logInfo).not.toHaveBeenCalled();
  expect(logWarn).toHaveBeenCalledTimes(1);
  expect(String(logWarn.mock.calls[0][0])).toContain('"errorCode":"INTERNAL_ERROR"');
});
