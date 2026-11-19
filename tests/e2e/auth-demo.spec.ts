import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type { JournalRecord } from "../../src/lib/journal-record";

interface DemoAccount { name: string; email: string; password: string }
const baseURL = "http://127.0.0.1:3000";
const evidence = resolve("output/auth-20261117");

function accounts(): DemoAccount[] {
  const directory = process.env.TAROT_E2E_DEMO_DIR || "output/auth-20261117/e2e-data";
  const values: unknown = JSON.parse(readFileSync(join(resolve(directory), "accounts.json"), "utf8"));
  if (!Array.isArray(values) || values.length !== 2 || values.some((value) => !value || typeof value.email !== "string" || typeof value.password !== "string" || typeof value.name !== "string")) {
    throw new Error("Expected two locally provisioned demonstration accounts");
  }
  return values as DemoAccount[];
}

async function signInAPI(context: APIRequestContext, account: DemoAccount) {
  const response = await context.post("/api/auth/sign-in/email", { data: { email: account.email, password: account.password } });
  expect(response.status()).toBe(200);
}

async function home(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "开始占卜", exact: true })).toBeEnabled({ timeout: 45_000 });
}

async function fillLogin(page: Page, account: DemoAccount) {
  const dialog = page.getByRole("dialog", { name: "演示账号登录", exact: true });
  await expect(dialog.getByLabel("邮箱", { exact: true })).toBeVisible();
  await dialog.getByLabel("邮箱", { exact: true }).fill(account.email);
  await dialog.getByLabel("密码", { exact: true }).fill(account.password);
  await dialog.getByRole("button", { name: "登录", exact: true }).click();
}

function record(id: string, question: string): JournalRecord {
  return { version: 1, id, kind: "sample", createdAt: new Date().toISOString(), question, spreadName: "单牌",
    cards: [{ position: "核心提示", cardId: "fool", orientation: "upright", meaning: "这是明确标注的合成测试牌义。", keywords: ["探索"], interpretation: "用于验证账号隔离的合成测试内容。" }],
    summary: "这段内容只用于自动测试，不是真实人工智能输出。" };
}

test.use({ reducedMotion: "reduce" });

test("real HTTP sessions protect journals, isolate matching IDs and revoke copied logout cookies", async ({ playwright }) => {
  const [accountA, accountB] = accounts();
  const options = { baseURL, extraHTTPHeaders: { Origin: baseURL } };
  const guest = await playwright.request.newContext(options), a = await playwright.request.newContext(options), b = await playwright.request.newContext(options);
  try {
    for (const method of ["GET", "POST", "DELETE"] as const) {
      const response = await guest.fetch("/api/journals", { method, ...(method === "GET" ? {} : { data: {} }) });
      expect(response.status()).toBe(401);
      expect(response.headers()["cache-control"]).toBe("no-store");
    }
    await signInAPI(a, accountA); await signInAPI(b, accountB);
    const signedIn = await (await a.get("/api/auth/get-session")).json();
    expect(signedIn.user.email).toBe(accountA.email);
    const id = `owner-isolation-${randomUUID()}`, journalA = record(id, "账号甲的隔离验收记录"), journalB = record(id, "账号乙的隔离验收记录");
    expect((await a.post("/api/journals", { data: { records: [journalA] } })).status()).toBe(200);
    expect((await b.get("/api/journals")).status()).toBe(200);
    expect((await (await b.get("/api/journals")).json()).records.some((item: JournalRecord) => item.id === id)).toBe(false);

    // A client-supplied owner cannot select another account's namespace.
    expect((await b.post("/api/journals", { data: { userId: signedIn.user.id, records: [journalB] } })).status()).toBe(200);
    expect((await (await a.get("/api/journals")).json()).records.find((item: JournalRecord) => item.id === id)).toEqual(journalA);
    expect((await (await b.get("/api/journals")).json()).records.find((item: JournalRecord) => item.id === id)).toEqual(journalB);
    expect((await b.delete("/api/journals", { data: { userId: signedIn.user.id, kind: "sample", id } })).status()).toBe(200);
    expect((await (await a.get("/api/journals")).json()).records.some((item: JournalRecord) => item.id === id)).toBe(true);
    expect((await (await b.get("/api/journals")).json()).records.some((item: JournalRecord) => item.id === id)).toBe(false);
    expect((await a.delete("/api/journals", { data: { kind: "sample", id } })).status()).toBe(200);

    expect((await a.post("/api/auth/sign-up/email", { data: {} })).status()).toBe(404);
    expect((await a.post("/api/auth/request-password-reset", { data: {} })).status()).toBe(404);
    expect((await a.post("/api/auth/sign-in/email", { headers: { Origin: "https://unrelated.example" }, data: {} })).status()).toBe(403);
    expect((await a.post("/api/journals", { headers: { Origin: "https://unrelated.example" }, data: { records: [journalA] } })).status()).toBe(403);

    const stored = await a.storageState();
    const session = stored.cookies.find((entry) => entry.name === "tarot-demo.session_token");
    expect(session?.httpOnly).toBe(true);
    expect(session?.sameSite).toBe("Lax");
    const copied = `${session!.name}=${session!.value}`;
    expect((await a.post("/api/auth/sign-out", { data: {} })).status()).toBe(200);
    expect((await guest.get("/api/journals", { headers: { Cookie: copied } })).status()).toBe(401);
  } finally { await guest.dispose(); await a.dispose(); await b.dispose(); }
});

test("login form handles errors, preserves the real session on reload, fits mobile and signs out", async ({ page }) => {
  const [account] = accounts(), errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  mkdirSync(evidence, { recursive: true });
  await home(page);
  const navigation = page.getByRole("navigation", { name: "主导航", exact: true });
  await navigation.getByRole("button", { name: "登录", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "演示账号登录", exact: true });
  await expect(dialog.getByText("使用提供的演示账号；本轮暂未开放注册与找回密码。", { exact: true })).toBeVisible();
  await fillLogin(page, { ...account, password: `incorrect-${randomUUID()}` });
  await expect(dialog.getByRole("alert")).toContainText("邮箱或密码不正确");
  await dialog.getByLabel("密码", { exact: true }).fill("");
  await page.screenshot({ path: join(evidence, "login-desktop.jpg") });
  await fillLogin(page, account);
  await expect(dialog).not.toBeVisible();
  await expect(navigation.getByRole("button", { name: account.name, exact: true })).toBeVisible();
  await home(page);
  await navigation.getByRole("button", { name: account.name, exact: true }).click();
  await expect(dialog.getByText(account.email, { exact: true })).toBeVisible();
  await page.screenshot({ path: join(evidence, "profile-desktop.jpg") });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(dialog.getByRole("button", { name: "退出登录", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: join(evidence, "profile-mobile.jpg") });
  await dialog.getByRole("button", { name: "退出登录", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(navigation.getByRole("button", { name: "登录", exact: true })).toBeVisible();
  await home(page);
  await expect(navigation.getByRole("button", { name: "登录", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("anonymous reading survives login and saved history remains private after switching accounts", async ({ page }) => {
  const [accountA, accountB] = accounts(), errors: string[] = [], readingCalls: string[] = [];
  const question = `登录后保留本次牌面与手记 ${randomUUID().slice(0, 8)}`;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => { if (new URL(request.url()).pathname === "/api/reading" || request.url().includes("api.deepseek.com")) readingCalls.push(request.url()); });
  mkdirSync(evidence, { recursive: true });
  await home(page);
  await page.getByRole("button", { name: "开始占卜", exact: true }).click();
  await page.getByRole("button", { name: "单牌 1 张", exact: true }).click();
  await page.getByLabel("你想问星空什么？", { exact: true }).fill(question);
  await page.getByLabel("你想问星空什么？", { exact: true }).press("Enter");
  const experience = page.getByTestId("cosmic-experience");
  await expect(experience).toHaveAttribute("data-stage", "draw", { timeout: 30_000 });
  await page.getByRole("button", { name: "选择第 1 张牌", exact: true }).press("Space");
  await expect(experience).toHaveAttribute("data-stage", "reading");
  const selected = page.getByTestId("orbit-card-0");
  const cardId = await selected.getAttribute("data-card-id"), orientation = await selected.getAttribute("data-orientation");
  await page.getByRole("button", { name: "查看整体解读", exact: true }).click();
  await expect(experience).toHaveAttribute("data-stage", "summary");
  await page.getByRole("button", { name: "保存示例手记", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "演示账号登录", exact: true });
  await expect(dialog.getByText("登录后可保存本次解读，刚才的问题与牌面会为你保留。", { exact: true })).toBeVisible();
  await fillLogin(page, accountA);
  await expect(dialog).not.toBeVisible();
  await expect(experience).toHaveAttribute("data-stage", "summary");
  await expect(selected).toHaveAttribute("data-card-id", cardId!);
  await expect(selected).toHaveAttribute("data-orientation", orientation!);
  await expect(page.getByRole("region", { name: "整体分析正文", exact: true })).toContainText(question);
  await page.getByRole("button", { name: "保存示例手记", exact: true }).click();
  await expect(page.getByRole("button", { name: "已保存本次示例", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "查看历史记录", exact: true }).click();
  const history = page.getByRole("dialog", { name: "历史记录", exact: true });
  const article = history.getByRole("article", { name: question, exact: true });
  await expect(article).toBeVisible();
  await article.getByText("查看完整手记", { exact: true }).click();
  await expect(article.getByText("以下为保存当时的示例内容，仅供体验。", { exact: true })).toBeVisible();
  await page.screenshot({ path: join(evidence, "history-account-a.jpg") });

  await home(page);
  const navigation = page.getByRole("navigation", { name: "主导航", exact: true });
  await navigation.getByRole("button", { name: accountA.name, exact: true }).click();
  await dialog.getByRole("button", { name: "退出登录", exact: true }).click();
  await navigation.getByRole("button", { name: "登录", exact: true }).click();
  await fillLogin(page, accountB);
  await expect(dialog).not.toBeVisible();
  await expect(navigation.getByRole("button", { name: accountB.name, exact: true })).toBeVisible();
  await navigation.getByRole("button", { name: "历史记录", exact: true }).click();
  await expect(history.getByRole("heading", { name: "历史记录", exact: true })).toBeVisible();
  await expect(history.getByText("正在读取手记…", { exact: true })).not.toBeVisible();
  await expect(history.getByRole("article", { name: question, exact: true })).toHaveCount(0);
  await page.screenshot({ path: join(evidence, "history-account-b.jpg") });

  await history.getByRole("button", { name: "关闭面板", exact: true }).click();
  await navigation.getByRole("button", { name: accountB.name, exact: true }).click();
  await dialog.getByRole("button", { name: "退出登录", exact: true }).click();
  await navigation.getByRole("button", { name: "登录", exact: true }).click();
  await fillLogin(page, accountA);
  await expect(dialog).not.toBeVisible();
  await expect(navigation.getByRole("button", { name: accountA.name, exact: true })).toBeVisible();
  await home(page);
  await navigation.getByRole("button", { name: "历史记录", exact: true }).click();
  await expect(history.getByRole("article", { name: question, exact: true })).toBeVisible();
  expect(errors).toEqual([]);
  expect(readingCalls).toEqual([]);
});
