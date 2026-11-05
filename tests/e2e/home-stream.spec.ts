import { expect, test, type Page } from "@playwright/test";

const space = (page: Page) => page.getByTestId("cosmic-space");
const stage = (page: Page) => page.getByTestId("cosmic-experience");
const identity = (page: Page) => page.locator(".cosmic-card").evaluateAll((cards) => cards.map((card) => ({
  id: card.getAttribute("data-card-id"), orientation: card.getAttribute("data-orientation"), anchor: card.getAttribute("data-anchor"),
})));

for (const width of [1920, 1280]) {
  test(`same 78 double-sided cards survive reverse camera, draft return and ring at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1920 ? 1080 : 720 });
    const errors: string[] = [], apiCalls: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => { if (request.url().includes("/api/reading")) apiCalls.push(request.url()); });
    await page.goto("/");
    await expect(space(page)).toHaveAttribute("data-stream-renderer", "mesh");
    await expect(space(page)).toHaveAttribute("data-stream-count", "78");
    await expect(space(page)).toHaveAttribute("data-visible-fronts", "0");
    await expect.poll(async () => Number(await space(page).getAttribute("data-visible-backs"))).toBeGreaterThan(20);
    const before = await identity(page);
    expect(new Set(before.map((card) => card.id)).size).toBe(78);
    const canvas = await space(page).locator("canvas").elementHandle();
    const home = await space(page).locator("canvas").screenshot();
    const samples = space(page).evaluate(async (element) => {
      const frames: Array<{ time: number; x: number; y: number; z: number; target: number[] }> = [];
      const start = performance.now();
      await new Promise<void>((resolve) => {
        const frame = (now: number) => {
          const data = (element as HTMLElement).dataset;
          // The observation RAF may run before or after the scene RAF. Use the timestamp that
          // actually produced these camera attributes, rather than the observer's next frame.
          const rendered = (element.closest(".cosmic-scene") as HTMLElement).dataset.rotationTime;
          frames.push({ time: Number(rendered), x: Number(data.cameraX), y: Number(data.cameraY), z: Number(data.cameraZ), target: data.cameraTarget!.split(",").map(Number) });
          if (now - start > 4300) resolve(); else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
      return frames;
    });
    await page.getByRole("button", { name: "开始占卜", exact: true }).click();
    // Exclude Playwright's wait for the hero button to become actionable from camera travel time.
    const clicked = Date.now();
    await expect(stage(page)).toHaveAttribute("data-stage", "reversing");
    await expect(page.getByLabel("你想问星空什么？")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(stage(page)).toHaveAttribute("data-stage", "reversing");
    await expect(stage(page)).toHaveAttribute("data-stage", "prepare");
    expect(Date.now() - clicked).toBeGreaterThan(3400);
    expect(Date.now() - clicked).toBeLessThan(5000);
    await expect(space(page)).toHaveAttribute("data-camera-x", "16.00000");
    await expect(space(page)).toHaveAttribute("data-camera-y", "-9.50000");
    await expect(space(page)).toHaveAttribute("data-camera-z", "-6.00000");
    // The near stretch shows fronts; the far stretch pitches face-down and reveals its backs.
    await expect.poll(async () => Number(await space(page).getAttribute("data-visible-fronts"))).toBeGreaterThan(20);
    await expect.poll(async () => Number(await space(page).getAttribute("data-visible-backs"))).toBeGreaterThan(0);
    const frames = await samples;
    expect(frames.length).toBeGreaterThan(40);
    expect(Math.min(...frames.map((frame) => frame.x))).toBeLessThan(-2);
    for (let index = 1; index < frames.length; index++) {
      const a = frames[index - 1], b = frames[index];
      const delta = Math.max(1, b.time - a.time) / 1000;
      // The longer forward/downward arc peaks below 27 world units/s.
      expect(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)).toBeLessThan(delta * 28 + 0.1);
      expect(b.y).toBeLessThanOrEqual(a.y + 0.00001);
      expect(b.z).toBeLessThanOrEqual(a.z + 0.00001);
      const yaw = (f: typeof a) => Math.atan2(f.target[0] - f.x, -(f.target[2] - f.z));
      expect(yaw(b)).toBeGreaterThanOrEqual(yaw(a) - 0.00001);
      expect(yaw(b) - yaw(a)).toBeLessThan(delta * 2.1 + 0.02);
    }
    expect(await space(page).locator("canvas").screenshot()).not.toEqual(home);
    const clock = Number(await space(page).getAttribute("data-stream-time"));
    await page.getByLabel("你想问星空什么？").fill("如何安排接下来的学习？");
    await page.waitForTimeout(500);
    expect(Number(await space(page).getAttribute("data-stream-time"))).toBeGreaterThan(clock + 350);
    expect(await identity(page)).toEqual(before);
    await page.getByLabel("你想问星空什么？").press("Escape");
    await expect(stage(page)).toHaveAttribute("data-stage", "returning");
    await expect(stage(page)).toHaveAttribute("data-stage", "home");
    await page.getByRole("button", { name: "开始占卜", exact: true }).click();
    await expect(page.getByLabel("你想问星空什么？")).toHaveValue("如何安排接下来的学习？");
    expect(await identity(page)).toEqual(before);
    // A retained draft exists before the opening capsule becomes editable and receives focus.
    await expect(page.getByLabel("你想问星空什么？")).toBeFocused();
    await page.getByLabel("你想问星空什么？").press("Enter");
    await expect(stage(page)).toHaveAttribute("data-stage", "draw");
    expect(await identity(page)).toEqual(before);
    expect(await canvas!.evaluate((element) => element === document.querySelector(".cosmic-space canvas"))).toBe(true);
    await expect(space(page).locator("canvas")).toHaveCount(1);
    expect(errors).toEqual([]); expect(apiCalls).toEqual([]);
    await canvas!.dispose();
  });
}
