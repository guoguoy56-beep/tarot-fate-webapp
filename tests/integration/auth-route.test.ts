import { beforeEach, expect, test, vi } from "vitest";
import { GET, POST } from "@/app/api/auth/[...all]/route";
import { getAuth, getAuthBaseURL } from "@/lib/auth";

const handler = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({ getAuth: vi.fn(), getAuthBaseURL: vi.fn() }));

const origin = "http://127.0.0.1:3000";
const request = (path: string, method = "GET", body?: BodyInit, headers: Record<string, string> = {}) => new Request(origin + path, {
  method, headers: { ...(method === "POST" ? { Origin: origin, "Content-Type": "application/json" } : {}), ...headers }, body,
});

beforeEach(() => {
  handler.mockReset().mockImplementation(async () => Response.json({ ok: true }));
  vi.mocked(getAuthBaseURL).mockReset().mockReturnValue(origin);
  vi.mocked(getAuth).mockReset().mockResolvedValue({ handler } as unknown as Awaited<ReturnType<typeof getAuth>>);
});

test.each([
  ["GET", "/api/auth/get-session"], ["POST", "/api/auth/sign-in/email"], ["POST", "/api/auth/sign-out"],
])("passes the permitted %s %s operation without caching", async (method, path) => {
  const response = await (method === "GET" ? GET : POST)(request(path, method, method === "POST" ? "{}" : undefined));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(handler).toHaveBeenCalledOnce();
});

test.each([
  ["POST", "/api/auth/sign-up/email"], ["POST", "/api/auth/request-password-reset"],
  ["POST", "/api/auth/change-password"], ["GET", "/api/auth/sign-in/email"],
  ["POST", "/api/auth/get-session"], ["GET", "/api/auth/get-session/"],
])("does not expose the unimplemented %s %s endpoint", async (method, path) => {
  const response = await (method === "GET" ? GET : POST)(request(path, method, method === "POST" ? "{}" : undefined));
  expect(response.status).toBe(404);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(getAuth).not.toHaveBeenCalled();
  expect(handler).not.toHaveBeenCalled();
});

test.each([
  { Origin: "https://unrelated.example" }, { Origin: "null" }, { Origin: "" }, { Host: "unrelated.example" },
])("rejects untrusted origin or host before invoking authentication", async (headers) => {
  const response = await POST(request("/api/auth/sign-in/email", "POST", "{}", Object.fromEntries(Object.entries(headers).filter((entry): entry is [string, string] => entry[1] !== undefined))));
  expect(response.status).toBe(403);
  expect(getAuth).not.toHaveBeenCalled();
  expect(handler).not.toHaveBeenCalled();
});

test("requires Origin on a browser login POST and rejects an untrusted request URL", async () => {
  const missing = new Request(origin + "/api/auth/sign-in/email", { method: "POST", body: "{}" });
  expect((await POST(missing)).status).toBe(403);
  const otherURL = new Request("http://unrelated.example/api/auth/get-session", { headers: { Host: "127.0.0.1:3000" } });
  expect((await GET(otherURL)).status).toBe(403);
  expect(handler).not.toHaveBeenCalled();
});

test("accepts Next's internal localhost URL only with the configured client Host and canonicalizes it", async () => {
  const internal = new Request("http://localhost:3000/api/auth/get-session", { headers: { Host: "127.0.0.1:3000" } });
  const response = await GET(internal);
  expect(response.status).toBe(200);
  const forwarded = handler.mock.calls[0][0] as Request;
  expect(forwarded.url).toBe(origin + "/api/auth/get-session");
  expect((await GET(new Request("http://localhost:3000/api/auth/get-session"))).status).toBe(403);
});

test("rejects cross-origin session reads", async () => {
  const response = await GET(request("/api/auth/get-session", "GET", undefined, { Origin: "https://unrelated.example" }));
  expect(response.status).toBe(403);
  expect(handler).not.toHaveBeenCalled();
});

test("overwrites caller supplied IP headers and preserves the cookie and JSON body", async () => {
  const payload = JSON.stringify({ email: "demo@example.test", password: "test-only-input" });
  const response = await POST(request("/api/auth/sign-in/email", "POST", payload, {
    "x-tarot-client-ip": "203.0.113.1", "x-forwarded-for": "203.0.113.2", "x-real-ip": "203.0.113.3", Cookie: "synthetic=value",
  }));
  expect(response.status).toBe(200);
  const forwarded = handler.mock.calls[0][0] as Request;
  expect(forwarded.headers.get("x-tarot-client-ip")).toBe("127.0.0.1");
  expect(forwarded.headers.has("x-forwarded-for")).toBe(false);
  expect(forwarded.headers.has("x-real-ip")).toBe(false);
  expect(forwarded.headers.get("cookie")).toBe("synthetic=value");
  expect(await forwarded.text()).toBe(payload);
});

test("rejects oversized declared and actual request bodies including multibyte input", async () => {
  const declared = await POST(request("/api/auth/sign-in/email", "POST", "{}", { "Content-Length": "8193" }));
  expect(declared.status).toBe(413);
  const actual = await POST(request("/api/auth/sign-in/email", "POST", "星".repeat(2800), { "Content-Length": "1" }));
  expect(actual.status).toBe(413);
  expect(handler).not.toHaveBeenCalled();
});

test("returns a generic uncached failure without configuration details", async () => {
  vi.mocked(getAuthBaseURL).mockImplementation(() => { throw new Error("PRIVATE CONFIGURATION SENTINEL"); });
  const response = await GET(request("/api/auth/get-session"));
  expect(response.status).toBe(503);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.text()).not.toContain("PRIVATE CONFIGURATION SENTINEL");
  expect(handler).not.toHaveBeenCalled();
});

test("keeps authentication failures generic when the provider fails", async () => {
  handler.mockRejectedValueOnce(new Error("PRIVATE PROVIDER SENTINEL"));
  const response = await POST(request("/api/auth/sign-in/email", "POST", "{}"));
  expect(response.status).toBe(503);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.text()).not.toContain("PRIVATE PROVIDER SENTINEL");
});
