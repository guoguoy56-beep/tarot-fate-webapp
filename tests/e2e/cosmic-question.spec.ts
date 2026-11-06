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
  const gap = await page.locator(".cosmic-prepare h2").evaluate((title) => document.querySelector("#cosmic-question")!.getBoundingClientRect().top - title.getBoundingClientRect().bottom);
  expect(gap).toBeCloseTo(viewport.height <= 850 ? 18 : 28, 0);
  await expect(page.locator(".cosmic-question-capsule")).toHaveCSS("outline-style", "none");
  await expect(page.locator(".cosmic-question-capsule")).toHaveCSS("border-top-width", "0px");
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

test("the light draws a persistent counterclockwise border from the upper midpoint", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.getByRole("button", { name: "开始占卜", exact: true }).click();
  const canvas = page.locator(".cosmic-question-sparks");
  const readEdges = async (surface: HTMLCanvasElement, waitForPartial: boolean) => {
    if (waitForPartial) await new Promise<void>((resolve, reject) => {
      const sample = () => {
        const value = Number(surface.dataset.traceProgress);
        if (value > 0.4) { reject(new Error("Missed partial border window")); return; }
        if (value >= 0.28) resolve(); else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    const context = surface.getContext("2d")!, image = context.getImageData(0, 0, surface.width, surface.height);
    const frame = surface.parentElement!, width = frame.clientWidth, height = frame.clientHeight;
    const ratio = surface.width / surface.clientWidth, padding = 76;
    const alpha = (x: number, y: number) => {
      let maximum = 0;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const pixel = ((Math.round(y * ratio) + dy) * image.width + Math.round(x * ratio) + dx) * 4;
        maximum = Math.max(maximum, image.data[pixel + 3]);
      }
      return maximum;
    };
    return { progress: Number(surface.dataset.traceProgress), top: alpha(padding + width / 2, padding), left: alpha(padding, padding + height / 2),
      bottom: alpha(padding + width / 2, padding + height), right: alpha(padding + width, padding + height / 2) };
  };
  // Read real canvas pixels while only the upper-left quarter has been traced.
  const partial = await canvas.evaluate(readEdges, true);
  expect(partial.progress).toBeLessThanOrEqual(0.4);
  expect(partial.top).toBeGreaterThan(0); expect(partial.left).toBeGreaterThan(0);
  expect(partial.bottom).toBe(0); expect(partial.right).toBe(0);
  await expect(question(page)).toBeEnabled();
  const complete = await canvas.evaluate(readEdges, false);
  for (const value of [complete.top, complete.left, complete.bottom, complete.right]) expect(value).toBeGreaterThan(0);
  await expectCenteredInput(page);
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
