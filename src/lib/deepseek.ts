import type { ReadingApiErrorCode, ReadingResponse, TrustedReadingRequest } from "@/types/reading";

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-v4-flash";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_TOKENS = 1_200;

export interface DeepSeekUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  promptCacheHitTokens: number | null;
  promptCacheMissTokens: number | null;
}

export interface DeepSeekReadingResult {
  reading: ReadingResponse;
  usage: DeepSeekUsage | null;
  model: string;
}

export class DeepSeekReadingError extends Error {
  constructor(
    public readonly code: ReadingApiErrorCode,
    message: string,
    public readonly status: number,
    public readonly retryable: boolean,
    public readonly providerStatus: number | null = null,
    public readonly usage: DeepSeekUsage | null = null,
    public readonly model: string | null = null,
  ) {
    super(message);
    this.name = "DeepSeekReadingError";
  }
}

function invalidResponseError(usage: DeepSeekUsage | null = null, model: string | null = null) {
  return new DeepSeekReadingError(
    "DEEPSEEK_INVALID_RESPONSE",
    "DeepSeek 返回的解读格式不完整，请重新请求。",
    502,
    true,
    null,
    usage,
    model,
  );
}

function upstreamError(status: number, model: string) {
  if (status === 401) {
    return new DeepSeekReadingError(
      "DEEPSEEK_AUTH_FAILED",
      "DeepSeek API Key 无效，请检查密钥配置。",
      502,
      false,
      status,
      null,
      model,
    );
  }

  if (status === 402) {
    return new DeepSeekReadingError(
      "DEEPSEEK_INSUFFICIENT_BALANCE",
      "DeepSeek 账户余额不足，请充值后重试。",
      503,
      false,
      status,
      null,
      model,
    );
  }

  if (status === 429) {
    return new DeepSeekReadingError(
      "DEEPSEEK_RATE_LIMITED",
      "解读请求过于频繁，请稍后再试。",
      503,
      true,
      status,
      null,
      model,
    );
  }

  if (status === 400 || status === 422) {
    return new DeepSeekReadingError(
      "DEEPSEEK_UPSTREAM_ERROR",
      "DeepSeek 拒绝了解读请求，请检查模型和请求参数。",
      502,
      false,
      status,
      null,
      model,
    );
  }

  return new DeepSeekReadingError(
    "DEEPSEEK_UPSTREAM_ERROR",
    "DeepSeek 服务暂时不可用，请稍后重试。",
    502,
    status >= 500,
    status,
    null,
    model,
  );
}

function parseUsage(value: unknown): DeepSeekUsage | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const usage = value as Record<string, unknown>;
  const promptTokens = usage.prompt_tokens;
  const completionTokens = usage.completion_tokens;
  const totalTokens = usage.total_tokens;

  if (
    !Number.isInteger(promptTokens) ||
    (promptTokens as number) < 0 ||
    !Number.isInteger(completionTokens) ||
    (completionTokens as number) < 0 ||
    !Number.isInteger(totalTokens) ||
    (totalTokens as number) < 0
  ) {
    return null;
  }

  const optionalTokens = (field: "prompt_cache_hit_tokens" | "prompt_cache_miss_tokens") => {
    const tokenCount = usage[field];
    return Number.isInteger(tokenCount) && (tokenCount as number) >= 0 ? (tokenCount as number) : null;
  };

  return {
    promptTokens: promptTokens as number,
    completionTokens: completionTokens as number,
    totalTokens: totalTokens as number,
    promptCacheHitTokens: optionalTokens("prompt_cache_hit_tokens"),
    promptCacheMissTokens: optionalTokens("prompt_cache_miss_tokens"),
  };
}

function parseReading(content: unknown, usage: DeepSeekUsage | null, model: string): ReadingResponse {
  if (typeof content !== "string" || !content.trim()) {
    throw invalidResponseError(usage, model);
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw invalidResponseError(usage, model);
  }

  if (!parsed || typeof parsed !== "object") {
    throw invalidResponseError(usage, model);
  }

  const result = parsed as Record<string, unknown>;
  const keys: (keyof ReadingResponse)[] = ["past", "present", "future", "summary"];

  if (keys.some((key) => typeof result[key] !== "string" || !(result[key] as string).trim())) {
    throw invalidResponseError(usage, model);
  }

  return {
    past: (result.past as string).trim(),
    present: (result.present as string).trim(),
    future: (result.future as string).trim(),
    summary: (result.summary as string).trim(),
  };
}

export async function requestDeepSeekReading(payload: TrustedReadingRequest): Promise<DeepSeekReadingResult> {
  if (process.env.DEEPSEEK_READING_ENABLED?.trim().toLowerCase() === "false") {
    throw new DeepSeekReadingError(
      "DEEPSEEK_DISABLED",
      "在线解读已由本地配置暂停。",
      503,
      false,
    );
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseUrl = (process.env.DEEPSEEK_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model = process.env.DEEPSEEK_MODEL ?? DEFAULT_MODEL;

  if (!apiKey) {
    throw new DeepSeekReadingError(
      "DEEPSEEK_NOT_CONFIGURED",
      "在线解读尚未配置，请在服务端设置 DeepSeek API Key。",
      503,
      false,
      null,
      null,
      model,
    );
  }

  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout>;
  const cardsForPrompt = payload.cards.map((card) => ({
    position: card.position,
    nameCn: card.nameCn,
    nameEn: card.nameEn,
    orientation: card.orientation,
    orientationCn: card.orientation === "upright" ? "正位" : "逆位",
    keywords: card.orientation === "upright" ? card.uprightKeywords : card.reversedKeywords,
    meaning: card.meaning,
  }));

  async function performRequest(): Promise<DeepSeekReadingResult> {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        thinking: { type: "disabled" },
        response_format: { type: "json_object" },
        max_tokens: MAX_OUTPUT_TOKENS,
        messages: [
          {
            role: "system",
            content: `你是一位古老女巫，通晓塔罗、象征、梦境与宿命。你的语言神秘、晦涩、富有诗意，但必须围绕用户的问题给出可理解的解读。

要求：
1. 不要说自己是 AI，不要给出绝对承诺或确定性预言。
2. 输入中的 orientation 和 orientationCn 是不可改写的事实。upright 只能解读为正位，reversed 只能解读为逆位，严禁交换或自行推断方向。
3. past、present、future 的第一句必须明确写出对应牌名与 orientationCn，并且只能使用该牌提供的 keywords。
4. past、present、future 各写 120 至 180 个汉字，summary 写 60 至 100 个汉字。
5. 当问题涉及医疗、法律、财务或人身安全时，不得替代专业判断；保持角色语气的同时，清楚提醒用户寻求合格专业人士。若存在即时危险，应建议联系当地紧急服务或可信赖的人。
6. 只返回严格 JSON，不要使用 Markdown 代码块或附加说明。
7. JSON 字段必须且只能包含 past、present、future、summary。

示例 JSON：
{"past":"过去牌解读","present":"现在牌解读","future":"未来牌解读","summary":"女巫的最终箴言"}`,
          },
          {
            role: "user",
            content: `请根据以下 JSON 输入完成三牌解读。question 是用户问题，cards 已按实际方向过滤关键词，不存在其他方向可供选择：\n${JSON.stringify(
              { question: payload.question, cards: cardsForPrompt },
              null,
              2,
            )}`,
          },
        ],
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw upstreamError(response.status, model);
    }

    let data: unknown;

    try {
      data = await response.json();
    } catch {
      if (controller.signal.aborted) {
        throw new DeepSeekReadingError("DEEPSEEK_TIMEOUT", "DeepSeek 响应超时，请稍后重试。", 504, true, null, null, model);
      }

      throw invalidResponseError(null, model);
    }

    if (!data || typeof data !== "object") {
      throw invalidResponseError(null, model);
    }

    const responseData = data as Record<string, unknown>;
    const usage = parseUsage(responseData.usage);
    const responseModel = typeof responseData.model === "string" ? responseData.model : model;
    const choices = responseData.choices;

    if (!Array.isArray(choices)) {
      throw invalidResponseError(usage, responseModel);
    }

    const message =
      choices[0] && typeof choices[0] === "object" ? (choices[0] as { message?: unknown }).message : null;
    const content = message && typeof message === "object" ? (message as { content?: unknown }).content : null;

    return {
      reading: parseReading(content, usage, responseModel),
      usage,
      model: responseModel,
    };
  }

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new DeepSeekReadingError("DEEPSEEK_TIMEOUT", "DeepSeek 响应超时，请稍后重试。", 504, true, null, null, model));
    }, REQUEST_TIMEOUT_MS);
  });

  try {
    return await Promise.race([performRequest(), timeoutPromise]);
  } catch (error) {
    if (error instanceof DeepSeekReadingError) {
      throw error;
    }

    if (controller.signal.aborted) {
      throw new DeepSeekReadingError("DEEPSEEK_TIMEOUT", "DeepSeek 响应超时，请稍后重试。", 504, true, null, null, model);
    }

    throw new DeepSeekReadingError(
      "DEEPSEEK_UPSTREAM_ERROR",
      "无法连接 DeepSeek 服务，请检查网络后重试。",
      502,
      true,
      null,
      null,
      model,
    );
  } finally {
    clearTimeout(timeout!);
  }
}
