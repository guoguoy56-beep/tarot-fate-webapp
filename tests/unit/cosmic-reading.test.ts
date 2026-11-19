import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cosmicSpreads } from "@/lib/cosmic-experience";
import { createAiJournal } from "@/lib/cosmic-journal";
import {
  DeepSeekReadingError,
  isDeepSeekReadingAvailable,
  requestDeepSeekCosmicReading,
} from "@/lib/deepseek";
import { isJournalRecord } from "@/lib/journal-record";
import { COSMIC_READING_LENGTH_LIMITS, isCosmicReadingResponse } from "@/lib/reading-response";
import { validateCosmicReadingRequest } from "@/lib/reading-validation";
import type { CosmicReadingResponse, TrustedCosmicReadingRequest } from "@/types/reading";

const sampleIds = ["fool", "magician", "high-priestess", "empress", "emperor"] as const;

function makeText(seed: string, length: number) {
  return seed.repeat(Math.ceil(length / seed.length)).slice(0, length);
}

function makeCosmicResponse(positions: readonly string[]): CosmicReadingResponse {
  return {
    cards: positions.map((position, index) => ({
      position,
      interpretation: makeText(`${position}位的第${index + 1}张牌面给出清晰的观察与行动方向。`, 120),
    })),
    summary: {
      overview: makeText("整体脉络呈现出从停顿转向主动收敛的清晰线索。", 88),
      connectionTitle: positions.length === 1 ? "值得留意的线索" : "牌与牌的联系",
      connection: makeText("牌面之间彼此呼应，提醒你先聚焦最关键的一步并观察反馈。", 88),
      actions: [
        "先把最核心的一个目标写清楚，今天内完成第一步推进。",
        "找一位相关协作者对齐关键节点与边界，避免反复返工。",
        "三天后复盘实际进展，再决定是否调整下一步节奏。",
      ],
      reflection: "如果今天只守住一个最重要的判断，你会选哪一条？",
    },
  };
}

describe("validateCosmicReadingRequest", () => {
  test.each(cosmicSpreads)("accepts valid %s spread (%i cards) and rebuilds trusted card metadata", (spread) => {
    const forged = "FORGED_METADATA";
    const result = validateCosmicReadingRequest({
      spreadId: spread.id,
      question: "  最近的工作方向该如何聚焦？\r\n请给我提示  ",
      cards: spread.slots.map((position, index) => ({
        cardId: sampleIds[index],
        position,
        orientation: index % 2 === 0 ? "upright" : "reversed",
        nameCn: forged,
        meaning: forged,
        uprightKeywords: [forged],
      })),
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.spreadId).toBe(spread.id);
    expect(result.data.spreadName).toBe(spread.name);
    expect(result.data.question).toBe("最近的工作方向该如何聚焦？\n请给我提示");
    expect(result.data.cards).toHaveLength(spread.slots.length);
    expect(result.data.cards[0].nameCn).toBe("愚者");
    expect(result.data.cards[0].meaning).not.toBe(forged);
    expect(result.data.cards[0].uprightKeywords).not.toContain(forged);
  });

  test("rejects unknown spread, mismatched count, wrong position order and duplicate cards", () => {
    expect(validateCosmicReadingRequest({
      spreadId: "unknown-spread",
      question: "问题",
      cards: [{ cardId: "fool", position: "核心提示", orientation: "upright" }],
    })).toMatchObject({ success: false, error: { code: "INVALID_SPREAD" } });

    expect(validateCosmicReadingRequest({
      spreadId: "cross",
      question: "问题",
      cards: [{ cardId: "fool", position: "现状", orientation: "upright" }],
    })).toMatchObject({ success: false, error: { code: "INVALID_CARD_COUNT" } });

    expect(validateCosmicReadingRequest({
      spreadId: "three",
      question: "问题",
      cards: [
        { cardId: "fool", position: "建议", orientation: "upright" },
        { cardId: "magician", position: "阻碍", orientation: "upright" },
        { cardId: "empress", position: "现状", orientation: "upright" },
      ],
    })).toMatchObject({ success: false, error: { code: "INVALID_CARD_POSITION" } });

    expect(validateCosmicReadingRequest({
      spreadId: "three",
      question: "问题",
      cards: [
        { cardId: "fool", position: "现状", orientation: "upright" },
        { cardId: "fool", position: "阻碍", orientation: "reversed" },
        { cardId: "empress", position: "建议", orientation: "upright" },
      ],
    })).toMatchObject({ success: false, error: { code: "DUPLICATE_CARD" } });
  });
});

describe("isCosmicReadingResponse & createAiJournal", () => {
  test("validates 1-card and 5-card structured responses and rejects malformed shapes", () => {
    const single = makeCosmicResponse(["核心提示"]);
    const cross = makeCosmicResponse(["现状", "阻力", "根源", "建议", "走向"]);

    expect(isCosmicReadingResponse(single, ["核心提示"])).toBe(true);
    expect(isCosmicReadingResponse(cross, ["现状", "阻力", "根源", "建议", "走向"])).toBe(true);
    expect(isCosmicReadingResponse(single, ["倾向与提醒"])).toBe(false);
    expect(isCosmicReadingResponse({ ...single, extra: true }, ["核心提示"])).toBe(false);
    expect(isCosmicReadingResponse({
      ...single,
      cards: [{ position: "核心提示", interpretation: makeText("太短", COSMIC_READING_LENGTH_LIMITS.interpretation.min - 1) }],
    }, ["核心提示"])).toBe(false);
    expect(isCosmicReadingResponse({
      ...single,
      summary: { ...single.summary, actions: ["只有一条建议不够"] },
    }, ["核心提示"])).toBe(false);
  });

  test("creates a valid kind=ai JournalRecord from a cosmic AI response", () => {
    const spread = cosmicSpreads[4]; // 十字牌阵 (5 cards)
    const response = makeCosmicResponse(spread.slots);
    const selected = spread.slots.map((_, index) => ({
      anchor: index,
      cardId: sampleIds[index],
      orientation: index % 2 === 0 ? "upright" as const : "reversed" as const,
    }));
    const record = createAiJournal(spread, selected, "下一步如何推进？", response, "ai-journal-1", "2026-11-19T02:00:00.000Z");

    expect(record.kind).toBe("ai");
    expect(record.cards).toHaveLength(5);
    expect(record.cards[0].interpretation).toBe(response.cards[0].interpretation);
    expect(isJournalRecord(record)).toBe(true);
  });
});

describe("isDeepSeekReadingAvailable & requestDeepSeekCosmicReading", () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
  const payload: TrustedCosmicReadingRequest = {
    spreadId: "three",
    spreadName: "三牌阵",
    spreadSubtitle: "从处境出发，走向行动",
    question: "接下来的合作该如何推进？",
    cards: [
      {
        cardId: "fool",
        position: "现状",
        orientation: "upright",
        nameCn: "愚者",
        nameEn: "The Fool",
        uprightKeywords: ["启程-正位专用"],
        reversedKeywords: ["冒进-逆位专用"],
        meaning: "新的起点与探索。",
      },
      {
        cardId: "magician",
        position: "阻碍",
        orientation: "reversed",
        nameCn: "魔术师",
        nameEn: "The Magician",
        uprightKeywords: ["创造-正位专用"],
        reversedKeywords: ["分散-逆位专用"],
        meaning: "意志、资源与专注。",
      },
      {
        cardId: "emperor",
        position: "建议",
        orientation: "upright",
        nameCn: "皇帝",
        nameEn: "The Emperor",
        uprightKeywords: ["秩序-正位专用"],
        reversedKeywords: ["僵化-逆位专用"],
        meaning: "规则、结构与担当。",
      },
    ],
  };

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>(async () => {
      throw new Error("unexpected unmocked fetch");
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("DEEPSEEK_READING_ENABLED", "true");
    vi.stubEnv("DEEPSEEK_API_KEY", "test-cosmic-key");
    vi.stubEnv("DEEPSEEK_BASE_URL", "https://mock.deepseek.local");
    vi.stubEnv("DEEPSEEK_MODEL", "deepseek-test-cosmic");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("evaluates availability strictly from server env without requiring external calls", () => {
    expect(isDeepSeekReadingAvailable({ DEEPSEEK_API_KEY: "test-key", DEEPSEEK_READING_ENABLED: "true" })).toBe(true);
    expect(isDeepSeekReadingAvailable({ DEEPSEEK_API_KEY: "test-key" })).toBe(true);
    expect(isDeepSeekReadingAvailable({ DEEPSEEK_API_KEY: "test-key", DEEPSEEK_READING_ENABLED: "false" })).toBe(false);
    expect(isDeepSeekReadingAvailable({ DEEPSEEK_API_KEY: "   ", DEEPSEEK_READING_ENABLED: "true" })).toBe(false);
    expect(isDeepSeekReadingAvailable({})).toBe(false);
  });

  test("sends only orientation-specific keywords and returns trimmed multi-spread reading", async () => {
    const reading = makeCosmicResponse(["现状", "阻碍", "建议"]);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({
        model: "deepseek-provider-cosmic",
        usage: { prompt_tokens: 210, completion_tokens: 340, total_tokens: 550 },
        choices: [{
          finish_reason: "stop",
          message: {
            content: JSON.stringify({
              ...reading,
              cards: reading.cards.map((item) => ({ position: ` ${item.position} `, interpretation: ` ${item.interpretation} ` })),
              summary: { ...reading.summary, overview: ` ${reading.summary.overview} ` },
            }),
          },
        }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    const result = await requestDeepSeekCosmicReading(payload);
    expect(result.reading).toEqual(reading);
    expect(result.model).toBe("deepseek-provider-cosmic");
    expect(result.usage).toEqual({
      promptTokens: 210,
      completionTokens: 340,
      totalTokens: 550,
      promptCacheHitTokens: null,
      promptCacheMissTokens: null,
    });

    const sentBody = String(fetchMock.mock.calls[0][1]?.body ?? "");
    expect(sentBody).toContain("启程-正位专用");
    expect(sentBody).not.toContain("冒进-逆位专用");
    expect(sentBody).toContain("分散-逆位专用");
    expect(sentBody).not.toContain("创造-正位专用");
  });

  test("rejects disabled, unconfigured, upstream errors, truncated output and timeout", async () => {
    vi.stubEnv("DEEPSEEK_READING_ENABLED", "false");
    await expect(requestDeepSeekCosmicReading(payload)).rejects.toMatchObject({ code: "DEEPSEEK_DISABLED", status: 503 });

    vi.stubEnv("DEEPSEEK_READING_ENABLED", "true");
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    await expect(requestDeepSeekCosmicReading(payload)).rejects.toMatchObject({ code: "DEEPSEEK_NOT_CONFIGURED", status: 503 });

    vi.stubEnv("DEEPSEEK_API_KEY", "test-cosmic-key");
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 429 }));
    await expect(requestDeepSeekCosmicReading(payload)).rejects.toMatchObject({ code: "DEEPSEEK_RATE_LIMITED", status: 503, retryable: true });

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ finish_reason: "length", message: { content: JSON.stringify(makeCosmicResponse(["现状", "阻碍", "建议"])) } }],
    }), { status: 200 }));
    await expect(requestDeepSeekCosmicReading(payload)).rejects.toBeInstanceOf(DeepSeekReadingError);

    vi.useFakeTimers();
    fetchMock.mockImplementationOnce((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    const pending = requestDeepSeekCosmicReading(payload).catch((error) => error);
    await vi.advanceTimersByTimeAsync(45_001);
    await expect(pending).resolves.toMatchObject({ code: "DEEPSEEK_TIMEOUT", status: 504, retryable: true });
  });
});
