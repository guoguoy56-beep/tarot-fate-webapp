import { expect, test, type Page } from "@playwright/test";

const space = (page: Page) => page.getByTestId("cosmic-space");
async function prepare(page: Page) {
  await page.getByRole("button", { name: "开始占卜", exact: true }).click();
  await page.getByRole("button", { name: "单牌 1 张", exact: true }).click();
  await page.getByLabel("你想问星空什么？").fill("如何开始接下来的学习计划？");
}
async function choose(page: Page) {
  await expect(page.getByTestId("cosmic-experience")).toHaveAttribute("data-stage", "draw");
  await page.getByTestId("orbit-card-20").press("Enter");
  await expect(page.getByTestId("cosmic-experience")).toHaveAttribute("data-stage", "reading");
}

test("one WebGL scene carries a continuous camera through reading and summary", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.setViewportSize({ width: 1159, height: 668 });
  await page.goto("/");
  await expect(space(page)).toHaveAttribute("data-renderer", "webgl");
  await expect(space(page)).toHaveCSS("opacity", "1");
  await expect(page.getByTestId("cosmic-scene")).toHaveAttribute("data-ring-space", "world");
  const canvas = space(page).locator("canvas");
  const original = await canvas.elementHandle();
  const home = await canvas.screenshot();
  const homeZ = Number(await space(page).getAttribute("data-camera-z"));
  await prepare(page);
  const samples = space(page).evaluate(async (element) => {
    const frames: Array<{ time: number; x: number; y: number; z: number }> = [];
    const start = performance.now();
    await new Promise<void>((resolve) => {
      const frame = (time: number) => {
        frames.push({ time, x: Number(element.getAttribute("data-camera-x")), y: Number(element.getAttribute("data-camera-y")), z: Number(element.getAttribute("data-camera-z")) });
        if (time - start > 8500) resolve(); else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    return frames;
  });
  await page.getByRole("button", { name: "开启星轨", exact: true }).click();
  await expect(page.getByTestId("cosmic-experience")).toHaveAttribute("data-stage", "draw");
  const drawZ = Number(await space(page).getAttribute("data-camera-z"));
  await choose(page);
  await page.getByRole("button", { name: "查看整体解读", exact: true }).waitFor({ state: "visible" });
  await expect(page.getByRole("button", { name: "查看整体解读", exact: true })).toBeEnabled();
  const readingZ = Number(await space(page).getAttribute("data-camera-z"));
  const coverage = await canvas.evaluate((element) => {
    const canvas = element.getBoundingClientRect(), scene = document.querySelector<HTMLElement>('.cosmic-scene')!, bounds = scene.getBoundingClientRect();
    return { scroll: scene.scrollTop, top: canvas.top - bounds.top, left: canvas.left - bounds.left, bottom: canvas.bottom - bounds.bottom, right: canvas.right - bounds.right };
  });
  Object.values(coverage).forEach((offset) => expect(offset).toBeCloseTo(0, 1));
  expect(homeZ).toBeGreaterThan(drawZ + 10);
  expect(drawZ).toBeGreaterThan(readingZ + 5);
  expect(await canvas.screenshot()).not.toEqual(home);
  await page.getByRole("button", { name: "查看整体解读", exact: true }).click();
  await expect(page.getByRole("heading", { name: "命运手记", exact: true })).toBeVisible();
  const frames = await samples;
  expect(frames.length).toBeGreaterThan(40);
  for (let index = 1; index < frames.length; index++) {
    const a = frames[index - 1], b = frames[index];
    const distance = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    expect(Number.isFinite(distance)).toBe(true);
    expect(distance).toBeLessThan(120 * (b.time - a.time) / 1000 + 0.05);
  }
  expect(Number(await space(page).getAttribute("data-camera-z"))).toBeGreaterThan(readingZ + 5);
  await page.getByRole("button", { name: "命运回廊，返回首页", exact: true }).click();
  await expect.poll(async () => Number(await space(page).getAttribute("data-camera-z"))).toBeGreaterThan(homeZ - 1);
  expect(await original!.evaluate((element) => element === document.querySelector(".cosmic-space canvas"))).toBe(true);
  await expect(canvas).toHaveCount(1);
  await original!.dispose();
  expect(errors).toEqual([]);
});

test("reduced motion uses a static WebGL view instead of continuously rendering", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(space(page)).toHaveAttribute("data-renderer", "webgl");
  const before = await space(page).getAttribute("data-frames");
  await page.waitForTimeout(300);
  expect(await space(page).getAttribute("data-frames")).toBe(before);
  await prepare(page);
  expect(await space(page).getAttribute("data-frames")).toBe(before);
  await page.getByRole("button", { name: "开启星轨", exact: true }).click();
  await choose(page);
  await expect(page.getByRole("button", { name: "查看整体解读", exact: true })).toBeEnabled();
  const settled = await space(page).getAttribute("data-frames");
  await page.waitForTimeout(300);
  expect(await space(page).getAttribute("data-frames")).toBe(settled);
});

test("the full reading flow works when WebGL2 is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", { value: function (this: HTMLCanvasElement, kind: string, ...args: unknown[]) {
      return kind === "webgl2" ? null : Reflect.apply(original, this, [kind, ...args]);
    } });
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(space(page)).toHaveAttribute("data-renderer", "fallback");
  await expect(space(page).locator("canvas")).toHaveCount(0);
  await expect(page.getByTestId("cosmic-scene")).toHaveAttribute("data-ring-space", "world");
  await expect(page.locator(".cosmic-panorama")).toBeVisible();
  await prepare(page);
  await page.getByRole("button", { name: "开启星轨", exact: true }).click();
  await choose(page);
  await page.getByRole("button", { name: "查看整体解读", exact: true }).click();
  await expect(page.getByRole("heading", { name: "命运手记", exact: true })).toBeVisible();
});

test("context loss falls back and restoration reuses the same scene canvas", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(space(page)).toHaveAttribute("data-renderer", "webgl");
  const canvas = space(page).locator("canvas");
  const before = await canvas.elementHandle();
  const extension = await canvas.evaluateHandle((element) => (element as HTMLCanvasElement).getContext("webgl2")!.getExtension("WEBGL_lose_context")!);
  await extension.evaluate((control) => control.loseContext());
  await expect(space(page)).toHaveAttribute("data-renderer", "fallback");
  await extension.evaluate((control) => control.restoreContext());
  await expect(space(page)).toHaveAttribute("data-renderer", "webgl");
  expect(await before!.evaluate((element) => element === document.querySelector(".cosmic-space canvas"))).toBe(true);
  await before!.dispose();
  await extension.dispose();
});
