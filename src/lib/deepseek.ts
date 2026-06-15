import type { ReadingApiErrorCode, ReadingRequest, ReadingResponse } from "@/types/reading";

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-v4-flash";
const REQUEST_TIMEOUT_MS = 30_000;

export class DeepSeekReadingError extends Error {
  constructor(
    public readonly code: ReadingApiErrorCode,
    message: string,
    public readonly status: number,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "DeepSeekReadingError";
  }
}

function invalidResponseError() {
  return new DeepSeekReadingError(
    "DEEPSEEK_INVALID_RESPONSE",
    "DeepSeek 返回的解读格式不完整，请重新请求。",
    502,
    true,
  );
}

function upstreamError(status: number) {
  if (status === 401) {
    return new DeepSeekReadingError(
      "DEEPSEEK_AUTH_FAILED",
      "DeepSeek API Key 无效，请检查密钥配置。",
      502,
      false,
    );
  }

  if (status === 402) {
    return new DeepSeekReadingError(
      "DEEPSEEK_INSUFFICIENT_BALANCE",
      "DeepSeek 账户余额不足，请充值后重试。",
      503,
      false,
    );
  }

  if (status === 429) {
    return new DeepSeekReadingError(
      "DEEPSEEK_RATE_LIMITED",
      "解读请求过于频繁，请稍后再试。",
      503,
      true,
    );
  }

  if (status === 400 || status === 422) {
    return new DeepSeekReadingError(
      "DEEPSEEK_UPSTREAM_ERROR",
      "DeepSeek 拒绝了解读请求，请检查模型和请求参数。",
      502,
      false,
    );
  }

  return new DeepSeekReadingError(
    "DEEPSEEK_UPSTREAM_ERROR",
    "DeepSeek 服务暂时不可用，请稍后重试。",
    502,
    status >= 500,
  );
}

function parseReading(content: unknown): ReadingResponse {
  if (typeof content !== "string" || !content.trim()) {
    throw invalidResponseError();
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw invalidResponseError();
  }

  if (!parsed || typeof parsed !== "object") {
    throw invalidResponseError();
  }

  const result = parsed as Record<string, unknown>;
  const keys: (keyof ReadingResponse)[] = ["past", "present", "future", "summary"];

  if (keys.some((key) => typeof result[key] !== "string" || !(result[key] as string).trim())) {
    throw invalidResponseError();
  }

  return {
    past: (result.past as string).trim(),
    present: (result.present as string).trim(),
    future: (result.future as string).trim(),
    summary: (result.summary as string).trim(),
  };
}

export async function requestDeepSeekReading(payload: ReadingRequest): Promise<ReadingResponse> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseUrl = (process.env.DEEPSEEK_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model = process.env.DEEPSEEK_MODEL ?? DEFAULT_MODEL;

  if (!apiKey) {
    throw new DeepSeekReadingError(
      "DEEPSEEK_NOT_CONFIGURED",
      "在线解读尚未配置，请在服务端设置 DeepSeek API Key。",
      503,
      false,
    );
  }

  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout>;

  async function performRequest(): Promise<ReadingResponse> {
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
        max_tokens: 1200,
        messages: [
          {
            role: "system",
            content: `你是一位古老女巫，通晓塔罗、象征、梦境与宿命。你的语言神秘、晦涩、富有诗意，但必须围绕用户的问题给出可理解的解读。

要求：
1. 不要说自己是 AI，不要给出绝对承诺或确定性预言。
2. past、present、future 各写 120 至 180 个汉字，summary 写 60 至 100 个汉字。
3. 当问题涉及医疗、法律、财务或人身安全时，不得替代专业判断；保持角色语气的同时，清楚提醒用户寻求合格专业人士。若存在即时危险，应建议联系当地紧急服务或可信赖的人。
4. 只返回严格 JSON，不要使用 Markdown 代码块或附加说明。
5. JSON 字段必须且只能包含 past、present、future、summary。

示例 JSON：
{"past":"过去牌解读","present":"现在牌解读","future":"未来牌解读","summary":"女巫的最终箴言"}`,
          },
          {
            role: "user",
            content: `请根据以下 JSON 输入完成三牌解读：\n${JSON.stringify(payload, null, 2)}`,
          },
        ],
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw upstreamError(response.status);
    }

    let data: unknown;

    try {
      data = await response.json();
    } catch {
      if (controller.signal.aborted) {
        throw new DeepSeekReadingError("DEEPSEEK_TIMEOUT", "DeepSeek 响应超时，请稍后重试。", 504, true);
      }

      throw invalidResponseError();
    }

    if (!data || typeof data !== "object") {
      throw invalidResponseError();
    }

    const choices = (data as { choices?: unknown }).choices;

    if (!Array.isArray(choices)) {
      throw invalidResponseError();
    }

    const message =
      choices[0] && typeof choices[0] === "object" ? (choices[0] as { message?: unknown }).message : null;
    const content = message && typeof message === "object" ? (message as { content?: unknown }).content : null;

    return parseReading(content);
  }

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new DeepSeekReadingError("DEEPSEEK_TIMEOUT", "DeepSeek 响应超时，请稍后重试。", 504, true));
    }, REQUEST_TIMEOUT_MS);
  });

  try {
    return await Promise.race([performRequest(), timeoutPromise]);
  } catch (error) {
    if (error instanceof DeepSeekReadingError) {
      throw error;
    }

    if (controller.signal.aborted) {
      throw new DeepSeekReadingError("DEEPSEEK_TIMEOUT", "DeepSeek 响应超时，请稍后重试。", 504, true);
    }

    throw new DeepSeekReadingError(
      "DEEPSEEK_UPSTREAM_ERROR",
      "无法连接 DeepSeek 服务，请检查网络后重试。",
      502,
      true,
    );
  } finally {
    clearTimeout(timeout!);
  }
}
