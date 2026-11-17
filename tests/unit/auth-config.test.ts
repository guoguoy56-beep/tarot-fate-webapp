import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import { getDemoAuthConfig } from "@/lib/auth-config";

function configuration() {
  return { TAROT_AUTH_MODE: "local-demo", BETTER_AUTH_URL: "http://127.0.0.1:3000", BETTER_AUTH_SECRET: randomBytes(32).toString("base64url") };
}

test.each(["http://127.0.0.1:3000", "http://localhost:3000", "http://[::1]:3000"])("accepts the explicit loopback demo origin %s", (origin) => {
  const env = { ...configuration(), BETTER_AUTH_URL: origin };
  expect(getDemoAuthConfig(env)).toEqual({ baseURL: origin, secret: env.BETTER_AUTH_SECRET, databasePath: resolve("data/demo/auth.sqlite") });
});

test("resolves a separately configured authentication database", () => {
  const env = { ...configuration(), TAROT_AUTH_DATABASE_PATH: "output/auth-test/configuration.sqlite" };
  expect(getDemoAuthConfig(env).databasePath).toBe(resolve(env.TAROT_AUTH_DATABASE_PATH));
});

test.each([undefined, "", "production", "demo"])("requires the explicit local-demo mode: %s", (mode) => {
  expect(() => getDemoAuthConfig({ ...configuration(), TAROT_AUTH_MODE: mode })).toThrow();
});

test.each([
  undefined, "", "not a URL", "http://example.com", "https://example.com", "https://127.0.0.1:3000",
  "http://127.0.0.2:3000", "http://127.0.0.1.example.com:3000", "http://0.0.0.0:3000", "http://192.168.1.2:3000",
  "http://user:password@localhost:3000", "http://localhost:3000/login", "http://localhost:3000/?next=/", "http://localhost:3000/#login",
])("rejects non-demo or ambiguous origins: %s", (origin) => {
  expect(() => getDemoAuthConfig({ ...configuration(), BETTER_AUTH_URL: origin })).toThrow();
});

test.each([undefined, "", "short", "a".repeat(64), "123456789".repeat(8)])("rejects missing, short or repetitive authentication secrets", (secret) => {
  expect(() => getDemoAuthConfig({ ...configuration(), BETTER_AUTH_SECRET: secret })).toThrow();
});
