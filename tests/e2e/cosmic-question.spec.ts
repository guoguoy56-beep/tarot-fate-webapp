import { expect, test, type Page } from "@playwright/test";

const stage = (page: Page) => page.getByTestId("cosmic-experience");
const question = (page: Page) => page.getByRole("textbox", { name: "你想问星空什么？" });
const identities = (page: Page) => page.locator(".cosmic-card").evaluateAll((cards) => cards.map((card) => ({
  id: card.getAttribute("data-card-id"), orientation: card.getAttribute("data-orientation"), anchor: card.getAttribute("data-anchor"),
})));

async function expectCenteredInput(page: Page) {
  const bounds = (await question(page).boundingBox())!, viewport = page.viewportSize()!;
  expect(Math.abs(bounds.x + bounds.width / 2 - viewport.width / 2)).toBeLessThan(1);
  expect(Math.abs(bounds.y + bounds.height / 2 - viewport.height / 2)).toBeLessThan(1);
  await expect(page.locator(".cosmic-question-meta")).not.toContainText("500");
}

test("the magic capsule retains a 500-character draft and the same moving deck through return and Enter", async ({ page }) => {
  const errors: string[] = [], apiCalls: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => { if (request.url().includes("/api/reading")) apiCalls.push(request.url()); });
  await page.goto("/");
  await page.getByRole("button", { name: "开始占卜", exact: true }).click();
  await expect(stage(page)).toHaveAttribute("data-stage", "reversing");
  await expect(question(page)).toHaveCount(0);
  await expect(question(page)).toBeEnabled();
  await expect(question(page)).toBeFocused();
  await expect(question(page)).toHaveAttribute("type", "text");
  await expect(question(page)).toHaveAttribute("placeholder", "输入你的问题");
  await expectCenteredInput(page);
  await expect(page.locator(".cosmic-prepare textarea, .cosmic-prepare button[type=submit]")).toHaveCount(0);
  await expect(page.getByRole("group", { name: "选择牌阵" }).getByRole("button")).toHaveCount(8);
  const before = await identities(page), height = (await question(page).boundingBox())!.height;
  const longQuestion = "如何安排接下来的学习与生活？".repeat(50).slice(0, 500);
  await question(page).fill(longQuestion + "超出上限");
  await expect(question(page)).toHaveValue(longQuestion);
  expect((await question(page).boundingBox())!.height).toBe(height);
  expect(await question(page).evaluate((input) => input.scrollLeft)).toBeGreaterThan(0);
  const clock = Number(await page.getByTestId("cosmic-space").getAttribute("data-stream-time"));
  await page.getByRole("button", { name: "十字牌阵 5 张", exact: true }).click();
  await expect(question(page)).toBeFocused();
  await expect.poll(async () => Number(await page.getByTestId("cosmic-space").getAttribute("data-stream-time"))).toBeGreaterThan(clock + 300);
  expect(await identities(page)).toEqual(before);
  await question(page).press("Escape");
  await expect(stage(page)).toHaveAttribute("data-stage", "returning");
  await expect(stage(page)).toHaveAttribute("data-stage", "home");
  await page.getByRole("button", { name: "开始占卜", exact: true }).click();
  await expect(question(page)).toBeEnabled();
  await expectCenteredInput(page);
  await expect(question(page)).toHaveValue(longQuestion);
  await expect(page.getByRole("button", { name: "十字牌阵 5 张", exact: true })).toHaveAttribute("aria-pressed", "true");
  await question(page).press("Enter");
  await expect(stage(page)).toHaveAttribute("data-stage", "travel");
  await expect(stage(page)).toHaveAttribute("data-stage", "draw");
  expect(await identities(page)).toEqual(before);
  expect(errors).toEqual([]); expect(apiCalls).toEqual([]);
});

test("empty Enter and IME confirmation do not submit; reduced motion keeps a static usable capsule", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await page.getByRole("button", { name: "开始占卜", exact: true }).click();
  await expect(question(page)).toBeEnabled();
  await expectCenteredInput(page);
  await expect(page.locator(".cosmic-question-sparks")).toHaveAttribute("data-motion", "static");
  await question(page).press("Enter");
  await expect(stage(page)).toHaveAttribute("data-stage", "prepare");
  await question(page).fill("   ");
  await question(page).press("Enter");
  await expect(stage(page)).toHaveAttribute("data-stage", "prepare");
  await question(page).fill("我想理解此刻的感受");
  await question(page).dispatchEvent("compositionstart");
  await question(page).dispatchEvent("keydown", { key: "Enter", code: "Enter", isComposing: true });
  await question(page).dispatchEvent("keydown", { key: "Escape", code: "Escape" });
  await expect(stage(page)).toHaveAttribute("data-stage", "prepare");
  await question(page).dispatchEvent("compositionend");
  await question(page).dispatchEvent("keydown", { key: "Enter", code: "Enter", keyCode: 229 });
  await expect(stage(page)).toHaveAttribute("data-stage", "prepare");
  await question(page).press("Enter");
  await expect(stage(page)).toHaveAttribute("data-stage", "travel");
  await expect(stage(page)).toHaveAttribute("data-stage", "draw");
});
