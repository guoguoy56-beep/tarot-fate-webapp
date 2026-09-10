import { Redis } from "@upstash/redis";
import { createHmac, randomUUID } from "node:crypto";
import { isIP } from "node:net";

export const READING_RATE_LIMIT = 5;
export const READING_RATE_WINDOW_SECONDS = 10 * 60;

const CONCURRENCY_LEASE_MS = 35_000;
const REDIS_TIMEOUT_MS = 2_000;
const RATE_LIMIT_NAMESPACE = "tarot:reading:v1";

const ACQUIRE_SCRIPT = `#!lua flags=allow-key-locking
local active = redis.call("GET", KEYS[2])
if active then
  local active_ttl = redis.call("PTTL", KEYS[2])
  if active_ttl < 1 then active_ttl = tonumber(ARGV[3]) end
  return {0, 1, 0, active_ttl}
end

local count = redis.call("INCR", KEYS[1])
local rate_ttl
if count == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[2])
  rate_ttl = tonumber(ARGV[2])
else
  rate_ttl = redis.call("PTTL", KEYS[1])
  if rate_ttl < 1 then
    redis.call("PEXPIRE", KEYS[1], ARGV[2])
    rate_ttl = tonumber(ARGV[2])
  end
end

if count > tonumber(ARGV[1]) then
  return {0, 2, 0, rate_ttl}
end

local acquired = redis.call("SET", KEYS[2], ARGV[4], "NX", "PX", ARGV[3])
if not acquired then
  return {0, 1, 0, tonumber(ARGV[3])}
end

return {1, 0, tonumber(ARGV[1]) - count, rate_ttl}`;

const RELEASE_SCRIPT = `#!lua flags=allow-key-locking
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0`;

interface ReadingRateLimitLease {
  key: string;
  token: string;
}

export type ReadingRateLimitResult =
  | { success: true; lease: ReadingRateLimitLease | null }
  | { success: false; reason: "rate" | "concurrency"; retryAfterSeconds: number }
  | { success: false; reason: "unavailable" };

let redisClient: Redis | null = null;

function getRedisClient() {
  if (redisClient) {
    return redisClient;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error("Reading rate limit store is not configured.");
  }

  redisClient = new Redis({
    url,
    token,
    enableTelemetry: false,
    enableAutoPipelining: false,
    responseEncoding: false,
    retry: { retries: 1, backoff: () => 50 },
    signal: () => AbortSignal.timeout(REDIS_TIMEOUT_MS),
  });

  return redisClient;
}

function getTrustedClientIp(request: Request) {
  if (process.env.RATE_LIMIT_TRUSTED_PROXY !== "vercel") {
    throw new Error("Reading rate limit trusted proxy is not configured.");
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  const clientIp = forwardedFor?.split(",", 1)[0]?.trim();

  if (!clientIp || isIP(clientIp) === 0) {
    throw new Error("Reading rate limit client address is unavailable.");
  }

  return clientIp;
}

function getAnonymousIdentifier(request: Request) {
  const secret = process.env.READING_RATE_LIMIT_SECRET;

  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("Reading rate limit identifier secret is not configured.");
  }

  return createHmac("sha256", secret).update(getTrustedClientIp(request)).digest("hex");
}

function getDeploymentNamespace() {
  return process.env.VERCEL_ENV === "preview" ? "preview" : "production";
}

function parseDecision(value: unknown) {
  if (!Array.isArray(value) || value.length !== 4) {
    throw new Error("Reading rate limit store returned an invalid decision.");
  }

  const decision = value.map(Number);

  if (decision.some((part) => !Number.isFinite(part))) {
    throw new Error("Reading rate limit store returned an invalid decision.");
  }

  return decision;
}

export async function acquireReadingRateLimit(request: Request): Promise<ReadingRateLimitResult> {
  if (process.env.NODE_ENV !== "production") {
    return { success: true, lease: null };
  }

  try {
    const identifier = getAnonymousIdentifier(request);
    const keyPrefix = `${RATE_LIMIT_NAMESPACE}:${getDeploymentNamespace()}:${identifier}`;
    const rateKey = `${keyPrefix}:rate`;
    const concurrencyKey = `${keyPrefix}:active`;
    const token = randomUUID();
    const value = await getRedisClient().eval(ACQUIRE_SCRIPT, [rateKey, concurrencyKey], [
      READING_RATE_LIMIT,
      READING_RATE_WINDOW_SECONDS * 1_000,
      CONCURRENCY_LEASE_MS,
      token,
    ]);
    const [allowed, reason, , retryAfterMs] = parseDecision(value);

    if (allowed === 1) {
      return { success: true, lease: { key: concurrencyKey, token } };
    }

    if (reason === 1 || reason === 2) {
      return {
        success: false,
        reason: reason === 1 ? "concurrency" : "rate",
        retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1_000)),
      };
    }

    return { success: false, reason: "unavailable" };
  } catch {
    return { success: false, reason: "unavailable" };
  }
}

export async function releaseReadingRateLimit(lease: ReadingRateLimitLease | null) {
  if (!lease) {
    return;
  }

  try {
    await getRedisClient().eval(RELEASE_SCRIPT, [lease.key], [lease.token]);
  } catch {
    // The lease expires automatically; release failure must not replace a completed reading response.
  }
}
