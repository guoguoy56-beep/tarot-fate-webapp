import { DeepSeekReadingError, requestDeepSeekReading } from "@/lib/deepseek";
import { validateReadingRequest } from "@/lib/reading-validation";
import type { ReadingApiError } from "@/types/reading";
import { NextResponse } from "next/server";

function errorResponse(error: ReadingApiError["error"], status: number) {
  return NextResponse.json<ReadingApiError>({ error }, { status });
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return errorResponse({ code: "INVALID_REQUEST", message: "解读请求格式无效。", retryable: false }, 400);
  }

  const validation = validateReadingRequest(payload);

  if (!validation.success) {
    return errorResponse({ ...validation.error, retryable: false }, 400);
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
  }
}
