import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { afterEach, expect, test } from "vitest";
import { createAuthRuntime, type DemoAuthConfig } from "@/lib/auth-config";

type Runtime = Awaited<ReturnType<typeof createAuthRuntime>>;
const directories: string[] = [], runtimes = new Set<Runtime>();
const baseURL = "http://127.0.0.1:3000";

function configuration(): DemoAuthConfig {
  const directory = mkdtempSync(join(tmpdir(), "tarot-auth-test-")); directories.push(directory);
  return { baseURL, secret: randomBytes(32).toString("base64url"), databasePath: join(directory, "auth.sqlite") };
}

async function runtime(config: DemoAuthConfig, provisioning = false) {
  const instance = await createAuthRuntime(config, provisioning); runtimes.add(instance); return instance;
}

function close(instance: Runtime) { instance.close(); runtimes.delete(instance); }

async function provision(config: DemoAuthConfig) {
  const instance = await runtime(config, true);
  const passwordA = randomBytes(24).toString("base64url"), passwordB = randomBytes(24).toString("base64url");
  const a = await instance.auth.api.signUpEmail({ body: { email: "recorder-a@example.test", password: passwordA, name: "演示账号甲" } });
  const b = await instance.auth.api.signUpEmail({ body: { email: "recorder-b@example.test", password: passwordB, name: "演示账号乙" } });
  close(instance);
  return { a: { id: a.user.id, email: a.user.email, password: passwordA }, b: { id: b.user.id, email: b.user.email, password: passwordB } };
}

function http(instance: Runtime, path: string, method = "GET", body?: unknown, cookie?: string) {
  return instance.auth.handler(new Request(baseURL + "/api/auth" + path, {
    method,
    headers: { Origin: baseURL, "x-tarot-client-ip": "127.0.0.1", ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(cookie ? { Cookie: cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));
}

function cookie(response: Response) {
  const cookies = response.headers.getSetCookie();
  const sessionCookie = cookies.find((value) => value.startsWith("tarot-demo.session_token="));
  expect(sessionCookie).toBeDefined();
  return sessionCookie!.split(";", 1)[0];
}

afterEach(() => {
  for (const instance of runtimes) instance.close(); runtimes.clear();
  for (const directory of directories.splice(0)) {
    const absolute = resolve(directory);
    if (dirname(absolute) !== resolve(tmpdir()) || !basename(absolute).startsWith("tarot-auth-test-")) throw new Error("Unexpected authentication test directory");
    rmSync(absolute, { recursive: true, force: true });
  }
});

test("uses real credentials, keeps account sessions distinct and disables ordinary sign-up", async () => {
  const config = configuration(), accounts = await provision(config), app = await runtime(config);
  const bad = await http(app, "/sign-in/email", "POST", { email: accounts.a.email, password: randomBytes(24).toString("base64url") });
  expect(bad.status).toBe(401);
  expect(bad.headers.getSetCookie().some((value) => value.startsWith("tarot-demo.session_token=") && !value.includes("Max-Age=0"))).toBe(false);

  const loginA = await http(app, "/sign-in/email", "POST", accounts.a);
  const loginB = await http(app, "/sign-in/email", "POST", accounts.b);
  expect(loginA.status).toBe(200); expect(loginB.status).toBe(200);
  const cookieA = cookie(loginA), cookieB = cookie(loginB);
  expect(cookieA).not.toBe(cookieB);
  expect(await (await http(app, "/get-session", "GET", undefined, cookieA)).json()).toMatchObject({ user: { id: accounts.a.id, email: accounts.a.email } });
  expect(await (await http(app, "/get-session", "GET", undefined, cookieB)).json()).toMatchObject({ user: { id: accounts.b.id, email: accounts.b.email } });
  expect(await (await http(app, "/get-session")).json()).toBeNull();

  const rejected = await http(app, "/sign-up/email", "POST", { email: "unapproved@example.test", name: "未预置账号", password: randomBytes(24).toString("base64url") });
  expect(rejected.status).toBe(400);
  expect(await rejected.json()).toMatchObject({ code: "EMAIL_PASSWORD_SIGN_UP_DISABLED" });
});

test("issues HttpOnly SameSite cookies and revokes a copied session after logout", async () => {
  const config = configuration(), accounts = await provision(config), app = await runtime(config);
  const response = await http(app, "/sign-in/email", "POST", accounts.a);
  expect(response.status).toBe(200);
  const sessionCookie = response.headers.getSetCookie().find((value) => value.startsWith("tarot-demo.session_token="))!;
  expect(sessionCookie).toContain("HttpOnly");
  expect(sessionCookie.toLowerCase()).toContain("samesite=lax");
  expect(sessionCookie).toMatch(/Max-Age=\d+/);
  const copied = cookie(response);
  expect(await (await http(app, "/get-session", "GET", undefined, copied)).json()).toMatchObject({ user: { id: accounts.a.id } });
  const logout = await http(app, "/sign-out", "POST", {}, copied);
  expect(logout.status).toBe(200);
  expect(await (await http(app, "/get-session", "GET", undefined, copied)).json()).toBeNull();
});

test("preserves accounts and database sessions across a server restart", async () => {
  const config = configuration(), accounts = await provision(config), first = await runtime(config);
  const originalLogin = await http(first, "/sign-in/email", "POST", accounts.a);
  expect(originalLogin.status).toBe(200);
  const copied = cookie(originalLogin);
  close(first);
  const reopened = await runtime(config);
  expect(await (await http(reopened, "/get-session", "GET", undefined, copied)).json()).toMatchObject({ user: { id: accounts.a.id } });
  const newLogin = await http(reopened, "/sign-in/email", "POST", accounts.b);
  expect(newLogin.status).toBe(200);
  expect(await (await http(reopened, "/get-session", "GET", undefined, cookie(newLogin))).json()).toMatchObject({ user: { id: accounts.b.id } });
});

test("rejects a forged session token", async () => {
  const app = await runtime(configuration());
  const forged = "tarot-demo.session_token=" + randomBytes(48).toString("base64url");
  expect(await (await http(app, "/get-session", "GET", undefined, forged)).json()).toBeNull();
});
