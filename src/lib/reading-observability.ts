import type { DeepSeekUsage } from "@/lib/deepseek";
import type { ReadingApiErrorCode } from "@/types/reading";

interface ReadingMetricTotals {
  validatedRequests: number;
  upstreamRequests: number;
  successes: number;
  failures: number;
  blocked: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface ReadingMetricInput {
  outcome: "success" | "failure" | "blocked";
  durationMs: number;
  upstreamRequested: boolean;
  model?: string;
  usage?: DeepSeekUsage | null;
  errorCode?: ReadingApiErrorCode;
  status?: number;
  retryable?: boolean;
  providerStatus?: number | null;
}

const totals: ReadingMetricTotals = {
  validatedRequests: 0,
  upstreamRequests: 0,
  successes: 0,
  failures: 0,
  blocked: 0,
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
};

export function recordReadingMetric(input: ReadingMetricInput) {
  totals.validatedRequests += 1;

  if (input.upstreamRequested) {
    totals.upstreamRequests += 1;
  }

  totals[input.outcome === "success" ? "successes" : input.outcome === "failure" ? "failures" : "blocked"] += 1;

  if (input.usage) {
    totals.promptTokens += input.usage.promptTokens;
    totals.completionTokens += input.usage.completionTokens;
    totals.totalTokens += input.usage.totalTokens;
  }

  const event = {
    event: "tarot.reading",
    timestamp: new Date().toISOString(),
    outcome: input.outcome,
    durationMs: Math.max(0, Math.round(input.durationMs)),
    upstreamRequested: input.upstreamRequested,
    model: input.model,
    usage: input.usage ?? undefined,
    errorCode: input.errorCode,
    status: input.status,
    retryable: input.retryable,
    providerStatus: input.providerStatus ?? undefined,
    totals: { ...totals },
  };
  const line = `[tarot.reading] ${JSON.stringify(event)}`;

  if (input.outcome === "success") {
    console.info(line);
  } else {
    console.warn(line);
  }
}
