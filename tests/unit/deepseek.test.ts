import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { DeepSeekReadingError, requestDeepSeekReading } from "@/lib/deepseek";
import type { ReadingApiErrorCode, TrustedReadingRequest } from "@/types/reading";

import { createReadingResponse } from "../fixtures/reading";

const payload = {
  question: "我该如何面对接下来的变化？",
  cards: [
    {
      cardId: "fool",
      position: "past",
      orientation: "upright",
      nameCn: "愚者",
      nameEn: "The Fool",
      uprightKeywords: ["启程-正位专用"],
      reversedKeywords: ["冒进-逆位专用"],
      meaning: "新的旅程与未知。",
    },
    {
      cardId: "magician",
      position: "present",
      orientation: "reversed",
      nameCn: "魔术师",
      nameEn: "The Magician",
      uprightKeywords: ["创造-正位专用"],
      reversedKeywords: ["失衡-逆位专用"],
      meaning: "意志、行动与资源。",
    },
    {
      cardId: "high-priestess",
      position: "future",
      orientation: "upright",
      nameCn: "女祭司",
      nameEn: "The High Priestess",
      uprightKeywords: ["直觉-正位专用"],
      reversedKeywords: ["封闭-逆位专用"],
      meaning: "直觉、秘密与内在智慧。",
    },
  ],
} satisfies TrustedReadingRequest;

const requestedModel = "deepseek-test-model";
const reading = createReadingResponse();
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function captureDeepSeekError(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(DeepSeekReadingError);
    return error as DeepSeekReadingError;
  }

  throw new Error("expected requestDeepSeekReading to reject");
}

beforeEach(() => {
  fetchMock = vi.fn<typeof fetch>(async () => {
    throw new Error("unexpected unmocked fetch");
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("DEEPSEEK_READING_ENABLED", "true");
  vi.stubEnv("DEEPSEEK_API_KEY", "test-only-api-key");
  vi.stubEnv("DEEPSEEK_BASE_URL", "https://mock.deepseek.local///");
  vi.stubEnv("DEEPSEEK_MODEL", requestedModel);
});

afterEach(() => {
  vi.useRealTimers();
});

test("returns a normalized reading and sends only orientation-specific keywords", async () => {
  fetchMock.mockResolvedValueOnce(
    jsonResponse({
      model: "deepseek-provider-model",
      usage: {
        prompt_tokens: 120,
        completion_tokens: 80,
        total_tokens: 200,
        prompt_cache_hit_tokens: 12,
        prompt_cache_miss_tokens: 108,
      },
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: JSON.stringify({
              ...reading,
              past: `  ${reading.past}  `,
            }),
          },
        },
      ],
    }),
  );

  const result = await requestDeepSeekReading(payload);

  expect(result).toEqual({
    reading,
    usage: {
      promptTokens: 120,
      completionTokens: 80,
      totalTokens: 200,
      promptCacheHitTokens: 12,
      promptCacheMissTokens: 108,
    },
    model: "deepseek-provider-model",
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);

  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("https://mock.deepseek.local/chat/completions");
  expect(init).toMatchObject({ method: "POST", cache: "no-store" });
  expect(init?.headers).toEqual({
    "Content-Type": "application/json",
    Authorization: "Bearer test-only-api-key",
  });
  expect(init?.signal).toBeInstanceOf(AbortSignal);

  const requestBody = JSON.parse(String(init?.body)) as {
    model: string;
    thinking: { type: string };
    response_format: { type: string };
    max_tokens: number;
    messages: Array<{ role: string; content: string }>;
  };
  expect(requestBody).toMatchObject({
    model: requestedModel,
    thinking: { type: "disabled" },
    response_format: { type: "json_object" },
    max_tokens: 1_200,
  });

  const userPrompt = requestBody.messages.find((message) => message.role === "user")?.content ?? "";
  const systemPrompt = requestBody.messages.find((message) => message.role === "system")?.content ?? "";
  expect(systemPrompt).toContain("预言式");
  expect(systemPrompt).toContain("不承诺结局");
  expect(systemPrompt).toContain("不固定句数");
  expect(systemPrompt).toContain("牌面依据");
  expect(systemPrompt).toContain("当前只收到文字卡牌资料，没有收到图片");
  expect(systemPrompt).toContain("不要把示例的卡牌");
  expect(systemPrompt).not.toContain("仅供娱乐与自我反思，不是确定预言");
  expect(userPrompt).not.toContain("含娱乐与反思声明");
  expect(systemPrompt).toContain("120 至 180");
  expect(systemPrompt).toContain("60 至 100");
  expect(systemPrompt).toContain("Unicode 字符");
  expect(systemPrompt).toContain("医疗、法律、财务");
  expect(systemPrompt).toContain("当地紧急服务");
  expect(systemPrompt).toContain("自行检查");
  const example = JSON.parse(systemPrompt.slice(systemPrompt.lastIndexOf("\n") + 1)) as Record<string, string>;
  expect(Object.keys(example).sort()).toEqual(["future", "past", "present", "summary"]);
  for (const key of ["past", "present", "future"]) {
    expect(Array.from(example[key]).length).toBeGreaterThanOrEqual(120);
    expect(Array.from(example[key]).length).toBeLessThanOrEqual(180);
  }
  expect(Array.from(example.summary).length).toBeGreaterThanOrEqual(60);
  expect(Array.from(example.summary).length).toBeLessThanOrEqual(100);
  expect(Object.values(example).join("")).not.toMatch(/行动边界是|调整方式是|仅供娱乐/);
  expect(userPrompt).toContain("启程-正位专用");
  expect(userPrompt).toContain("失衡-逆位专用");
  expect(userPrompt).toContain("直觉-正位专用");
  expect(userPrompt).not.toContain("冒进-逆位专用");
  expect(userPrompt).not.toContain("创造-正位专用");
  expect(userPrompt).not.toContain("封闭-逆位专用");
});

test("blocks requests when online readings are disabled", async () => {
  vi.stubEnv("DEEPSEEK_READING_ENABLED", " FALSE ");

  const error = await captureDeepSeekError(requestDeepSeekReading(payload));

  expect(error).toMatchObject({
    code: "DEEPSEEK_DISABLED",
    status: 503,
    retryable: false,
    providerStatus: null,
    usage: null,
    model: null,
  });
  expect(fetchMock).not.toHaveBeenCalled();
});

test("blocks requests when the API key is missing", async () => {
  vi.stubEnv("DEEPSEEK_API_KEY", "");

  const error = await captureDeepSeekError(requestDeepSeekReading(payload));

  expect(error).toMatchObject({
    code: "DEEPSEEK_NOT_CONFIGURED",
    status: 503,
    retryable: false,
    providerStatus: null,
    usage: null,
    model: requestedModel,
  });
  expect(fetchMock).not.toHaveBeenCalled();
});

test.each([
  [401, "DEEPSEEK_AUTH_FAILED", 502, false],
  [402, "DEEPSEEK_INSUFFICIENT_BALANCE", 503, false],
  [429, "DEEPSEEK_RATE_LIMITED", 503, true],
  [400, "DEEPSEEK_UPSTREAM_ERROR", 502, false],
  [422, "DEEPSEEK_UPSTREAM_ERROR", 502, false],
  [500, "DEEPSEEK_UPSTREAM_ERROR", 502, true],
  [503, "DEEPSEEK_UPSTREAM_ERROR", 502, true],
] satisfies Array<[number, ReadingApiErrorCode, number, boolean]>)(
  "maps provider status %i to %s",
  async (providerStatus, code, status, retryable) => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "provider detail must not leak" }, providerStatus));

    const error = await captureDeepSeekError(requestDeepSeekReading(payload));

    expect(error).toMatchObject({
      code,
      status,
      retryable,
      providerStatus,
      usage: null,
      model: requestedModel,
    });
    expect(error.message).not.toContain("provider detail");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  },
);

test("maps a non-JSON success response to an invalid-response error", async () => {
  fetchMock.mockResolvedValueOnce(
    new Response("not-json", { status: 200, headers: { "Content-Type": "application/json" } }),
  );

  const error = await captureDeepSeekError(requestDeepSeekReading(payload));

  expect(error).toMatchObject({
    code: "DEEPSEEK_INVALID_RESPONSE",
    status: 502,
    retryable: true,
    providerStatus: null,
    usage: null,
    model: requestedModel,
  });
});

test.each([
  ["missing choices", {}],
  ["empty choices", { choices: [] }],
  ["missing message", { choices: [{ finish_reason: "stop" }] }],
  ["non-JSON reading", { choices: [{ finish_reason: "stop", message: { content: "not-json" } }] }],
  [
    "missing reading field",
    {
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ past: "过去", present: "现在", future: "未来" }) } }],
    },
  ],
  ["blank reading field", { choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ ...reading, summary: " \t" }) } }] }],
  ["wrong reading field type", { choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ ...reading, future: 42 }) } }] }],
  ["too-short reading", { choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ ...reading, past: "合成".repeat(33) + "短" }) } }] }],
  ["too-long reading", { choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ ...reading, future: "长".repeat(181) }) } }] }],
  ["extra reading field", { choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ ...reading, privateDetail: "must not leak" }) } }] }],
])("rejects a provider payload with %s", async (_name, responseBody) => {
  fetchMock.mockResolvedValueOnce(
    jsonResponse({
      ...responseBody,
      model: "provider-model",
      usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 },
    }),
  );

  const error = await captureDeepSeekError(requestDeepSeekReading(payload));

  expect(error).toMatchObject({
    code: "DEEPSEEK_INVALID_RESPONSE",
    status: 502,
    retryable: true,
    providerStatus: null,
    usage: {
      promptTokens: 3,
      completionTokens: 4,
      totalTokens: 7,
      promptCacheHitTokens: null,
      promptCacheMissTokens: null,
    },
    model: "provider-model",
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test.each(["length", "content_filter", "tool_calls", "insufficient_system_resource", null, undefined])(
  "rejects a parseable reading when completion reason is %s",
  async (finishReason) => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      model: "provider-model",
      usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 },
      choices: [{ finish_reason: finishReason, message: { content: JSON.stringify(reading) } }],
    }));

    const error = await captureDeepSeekError(requestDeepSeekReading(payload));

    expect(error).toMatchObject({
      code: "DEEPSEEK_INVALID_RESPONSE",
      status: 502,
      retryable: true,
      model: "provider-model",
      usage: { promptTokens: 3, completionTokens: 4, totalTokens: 7 },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(error.message).not.toContain(reading.past);
  },
);

test.each([
  ["missing usage", undefined, null],
  ["invalid usage", { prompt_tokens: -1, completion_tokens: 4, total_tokens: 7 }, null],
  [
    "missing cache counts",
    { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 },
    { promptTokens: 3, completionTokens: 4, totalTokens: 7, promptCacheHitTokens: null, promptCacheMissTokens: null },
  ],
])("keeps successful readings usable with %s", async (_name, usage, expectedUsage) => {
  fetchMock.mockResolvedValueOnce(
    jsonResponse({ usage, choices: [{ finish_reason: "stop", message: { content: JSON.stringify(reading) } }] }),
  );

  await expect(requestDeepSeekReading(payload)).resolves.toEqual({
    reading,
    usage: expectedUsage,
    model: requestedModel,
  });
});

test("maps network failures without exposing the original exception", async () => {
  fetchMock.mockRejectedValueOnce(new TypeError("socket contained sensitive detail"));

  const error = await captureDeepSeekError(requestDeepSeekReading(payload));

  expect(error).toMatchObject({
    code: "DEEPSEEK_UPSTREAM_ERROR",
    status: 502,
    retryable: true,
    providerStatus: null,
    usage: null,
    model: requestedModel,
  });
  expect(error.message).not.toContain("sensitive detail");
});

test.each(["request", "response body"])("times out a pending %s after 30 seconds", async (phase) => {
  vi.useFakeTimers();
  const requestSignal = { current: null as AbortSignal | null };

  fetchMock.mockImplementationOnce((_input, init) => {
    requestSignal.current = init?.signal ?? null;

    if (phase === "response body") {
      return Promise.resolve(new Response(new ReadableStream()));
    }

    return new Promise<Response>((_resolve, reject) => {
      requestSignal.current?.addEventListener(
        "abort",
        () => reject(new DOMException("request aborted", "AbortError")),
        { once: true },
      );
    });
  });

  const errorPromise = captureDeepSeekError(requestDeepSeekReading(payload));
  await vi.advanceTimersByTimeAsync(29_999);
  expect(requestSignal.current?.aborted).toBe(false);

  await vi.advanceTimersByTimeAsync(1);
  const error = await errorPromise;

  expect(requestSignal.current?.aborted).toBe(true);
  expect(error).toMatchObject({
    code: "DEEPSEEK_TIMEOUT",
    status: 504,
    retryable: true,
    providerStatus: null,
    usage: null,
    model: requestedModel,
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});
