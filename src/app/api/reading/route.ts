import { DeepSeekReadingError, requestDeepSeekReading } from "@/lib/deepseek";
import { acquireReadingRateLimit, releaseReadingRateLimit } from "@/lib/reading-rate-limit";
import { readReadingRequestBody } from "@/lib/reading-request-body";
import { validateReadingRequest } from "@/lib/reading-validation";
import type { ReadingApiError } from "@/types/reading";
import { NextResponse } from "next/server";

function errorResponse(error: ReadingApiError["error"], status: number, headers?: HeadersInit) {
  return NextResponse.json<ReadingApiError>({ error }, { status, headers });
}

export async function POST(request: Request) {
  const body = await readReadingRequestBody(request);

  if (!body.success && body.reason === "too-large") {
    return errorResponse(
      { code: "REQUEST_TOO_LARGE", message: "解读请求内容过大。", retryable: false },
      413,
    );
  }

  if (!body.success) {
    return errorResponse({ code: "INVALID_REQUEST", message: "解读请求格式无效。", retryable: false }, 400);
  }

  const validation = validateReadingRequest(body.data);

  if (!validation.success) {
    return errorResponse({ ...validation.error, retryable: false }, 400);
  }

  const rateLimit = await acquireReadingRateLimit(request);

  if (!rateLimit.success && rateLimit.reason === "unavailable") {
    return errorResponse(
      { code: "RATE_LIMIT_UNAVAILABLE", message: "请求保护服务暂时不可用，请稍后重试。", retryable: true },
      503,
    );
  }

  if (!rateLimit.success) {
    const concurrent = rateLimit.reason === "concurrency";
    return errorResponse(
      {
        code: concurrent ? "READING_CONCURRENT_LIMIT" : "READING_RATE_LIMITED",
        message: concurrent ? "已有一次解读正在进行，请等待结果。" : "解读请求过于频繁，请稍后再试。",
        retryable: true,
      },
      429,
      { "Retry-After": String(rateLimit.retryAfterSeconds) },
    );
  }

  try {
    const reading = await requestDeepSeekReading(validation.data);
    return NextResponse.json(reading);
  } catch (error) {
    if (error instanceof DeepSeekReadingError) {
      return errorResponse(
        { code: error.code, message: error.message, retryable: error.retryable },
        error.status,
      );
    }

    return errorResponse({ code: "INTERNAL_ERROR", message: "解读服务发生未知错误。", retryable: true }, 500);
  } finally {
    await releaseReadingRateLimit(rateLimit.lease);
  }
}
