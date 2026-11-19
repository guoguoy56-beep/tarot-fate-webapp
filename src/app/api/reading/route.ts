import {
  DeepSeekReadingError,
  requestDeepSeekCosmicReading,
  requestDeepSeekReading,
} from "@/lib/deepseek";
import { readReadingRequestBody } from "@/lib/reading-request-body";
import { recordReadingMetric } from "@/lib/reading-observability";
import { validateCosmicReadingRequest, validateReadingRequest } from "@/lib/reading-validation";
import type { ReadingApiError } from "@/types/reading";
import { NextResponse } from "next/server";

function errorResponse(error: ReadingApiError["error"], status: number) {
  return NextResponse.json<ReadingApiError>({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

  const isCosmicSpreadRequest = isObjectRecord(body.data) && Object.hasOwn(body.data, "spreadId");

  if (isCosmicSpreadRequest) {
    const validation = validateCosmicReadingRequest(body.data);

    if (!validation.success) {
      return errorResponse({ ...validation.error, retryable: false }, 400);
    }

    const startedAt = performance.now();

    try {
      const result = await requestDeepSeekCosmicReading(validation.data);
      recordReadingMetric({
        outcome: "success",
        durationMs: performance.now() - startedAt,
        upstreamRequested: true,
        model: result.model,
        usage: result.usage,
      });
      return NextResponse.json(result.reading, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      if (error instanceof DeepSeekReadingError) {
        const upstreamRequested = error.code !== "DEEPSEEK_DISABLED" && error.code !== "DEEPSEEK_NOT_CONFIGURED";
        recordReadingMetric({
          outcome: upstreamRequested ? "failure" : "blocked",
          durationMs: performance.now() - startedAt,
          upstreamRequested,
          model: error.model ?? undefined,
          usage: error.usage,
          errorCode: error.code,
          status: error.status,
          retryable: error.retryable,
          providerStatus: error.providerStatus,
        });
        return errorResponse(
          { code: error.code, message: error.message, retryable: error.retryable },
          error.status,
        );
      }

      recordReadingMetric({
        outcome: "failure",
        durationMs: performance.now() - startedAt,
        upstreamRequested: true,
        errorCode: "INTERNAL_ERROR",
        status: 500,
        retryable: true,
      });
      return errorResponse({ code: "INTERNAL_ERROR", message: "解读服务发生未知错误。", retryable: true }, 500);
    }
  }

  const validation = validateReadingRequest(body.data);

  if (!validation.success) {
    return errorResponse({ ...validation.error, retryable: false }, 400);
  }

  const startedAt = performance.now();

  try {
    const result = await requestDeepSeekReading(validation.data);
    recordReadingMetric({
      outcome: "success",
      durationMs: performance.now() - startedAt,
      upstreamRequested: true,
      model: result.model,
      usage: result.usage,
    });
    return NextResponse.json(result.reading);
  } catch (error) {
    if (error instanceof DeepSeekReadingError) {
      const upstreamRequested = error.code !== "DEEPSEEK_DISABLED" && error.code !== "DEEPSEEK_NOT_CONFIGURED";
      recordReadingMetric({
        outcome: upstreamRequested ? "failure" : "blocked",
        durationMs: performance.now() - startedAt,
        upstreamRequested,
        model: error.model ?? undefined,
        usage: error.usage,
        errorCode: error.code,
        status: error.status,
        retryable: error.retryable,
        providerStatus: error.providerStatus,
      });
      return errorResponse(
        { code: error.code, message: error.message, retryable: error.retryable },
        error.status,
      );
    }

    recordReadingMetric({
      outcome: "failure",
      durationMs: performance.now() - startedAt,
      upstreamRequested: true,
      errorCode: "INTERNAL_ERROR",
      status: 500,
      retryable: true,
    });
    return errorResponse({ code: "INTERNAL_ERROR", message: "解读服务发生未知错误。", retryable: true }, 500);
  }
}
