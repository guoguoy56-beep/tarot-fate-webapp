import { expect, test, type Page } from "@playwright/test";

const space = (page: Page) => page.getByTestId("cosmic-space");
const cameraPose = (page: Page) => space(page).evaluate((element) => {
  const data = (element as HTMLElement).dataset;
  return { position: [Number(data.cameraX), Number(data.cameraY), Number(data.cameraZ)], target: data.cameraTarget!.split(",").map(Number) };
});
const forwardTravel = (from: Awaited<ReturnType<typeof cameraPose>>, to: Awaited<ReturnType<typeof cameraPose>>) => {
  const direction = from.target.map((value, i) => value - from.position[i]);
  return direction.reduce((sum, value, i) => sum + value * (to.position[i] - from.position[i]), 0) / Math.hypot(...direction);
};
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
  await expect(page.getByTestId("cosmic-scene")).toHaveAttribute("data-stream-space", "world");
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
        // Match the pose to the RAF that rendered it; an observer can run on either side of that RAF.
        const rendered = (element.closest(".cosmic-scene") as HTMLElement).dataset.rotationTime;
        frames.push({ time: Number(rendered), x: Number(element.getAttribute("data-camera-x")), y: Number(element.getAttribute("data-camera-y")), z: Number(element.getAttribute("data-camera-z")) });
        if (time - start > 8500) resolve(); else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    return frames;
  });
  await page.getByLabel("你想问星空什么？").press("Enter");
  await expect(page.getByTestId("cosmic-experience")).toHaveAttribute("data-stage", "draw");
  const drawPose = await cameraPose(page);
  await choose(page);
  await page.getByRole("button", { name: "查看整体解读", exact: true }).waitFor({ state: "visible" });
  await expect(page.getByRole("button", { name: "查看整体解读", exact: true })).toBeEnabled();
  const readingPose = await cameraPose(page);
  const coverage = await canvas.evaluate((element) => {
    const canvas = element.getBoundingClientRect(), scene = document.querySelector<HTMLElement>('.cosmic-scene')!, bounds = scene.getBoundingClientRect();
    return { scroll: scene.scrollTop, top: canvas.top - bounds.top, left: canvas.left - bounds.left, bottom: canvas.bottom - bounds.bottom, right: canvas.right - bounds.right };
  });
  Object.values(coverage).forEach((offset) => expect(offset).toBeCloseTo(0, 1));
  expect(Number(await space(page).getAttribute("data-camera-x"))).toBeGreaterThan(100);
  expect(Number(await space(page).getAttribute("data-camera-y"))).toBeLessThan(-50);
  // The downstream space is rotated; measure approach along the actual viewing direction.
  expect(forwardTravel(drawPose, readingPose)).toBeGreaterThan(10);
  expect(await canvas.screenshot()).not.toEqual(home);
  await page.getByRole("button", { name: "查看整体解读", exact: true }).click();
  await expect(page.getByRole("heading", { name: "命运手记", exact: true })).toBeVisible();
  const frames = await samples;
  expect(frames.length).toBeGreaterThan(40);
  for (let index = 1; index < frames.length; index++) {
    const a = frames[index - 1], b = frames[index];
    const distance = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    expect(Number.isFinite(distance)).toBe(true);
    // The dive and subsequent reading approach must remain continuous, even on delayed frames.
    expect(distance).toBeLessThan(150 * (b.time - a.time) / 1000 + 0.05);
  }
  expect(forwardTravel(readingPose, await cameraPose(page))).toBeLessThan(-8);
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
  const questionFrame = await space(page).getAttribute("data-frames");
  expect(Number(questionFrame)).toBeGreaterThan(Number(before));
  await page.waitForTimeout(300);
  expect(await space(page).getAttribute("data-frames")).toBe(questionFrame);
  await page.getByLabel("你想问星空什么？").press("Enter");
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
  await expect(page.getByTestId("cosmic-scene")).toHaveAttribute("data-stream-space", "world");
  await expect(page.locator(".cosmic-panorama")).toBeVisible();
  await prepare(page);
  await page.getByLabel("你想问星空什么？").press("Enter");
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

for (const missing of ["/assets/cosmic/cosmic-panorama-v1.png", "/cards/rws/major-00-fool.jpg"]) {
  test(`a failed scene resource does not block the reading flow: ${missing}`, async ({ page }) => {
    await page.route(`**${missing}`, (route) => route.abort());
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await prepare(page);
    await page.getByLabel("你想问星空什么？").press("Enter");
    await expect(page.getByTestId("cosmic-experience")).toHaveAttribute("data-stage", "draw");
    await page.locator('.cosmic-card[data-card-id="magician"]').press("Enter");
    await expect(page.getByTestId("cosmic-experience")).toHaveAttribute("data-stage", "reading");
    await expect(page.getByRole("button", { name: "查看整体解读", exact: true })).toBeEnabled();
  });
}
