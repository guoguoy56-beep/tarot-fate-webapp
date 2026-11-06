import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

for (const width of [1920, 1280]) {
  test(`the same 78 cards dive into an ordered ring before selection at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1920 ? 1080 : 720 });
    const errors: string[] = [], requests: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => { if (request.url().includes("/api/reading")) requests.push(request.url()); });
    await page.goto("/");
    await page.getByRole("button", { name: "开始占卜", exact: true }).click();
    const input = page.getByLabel("你想问星空什么？"), scene = page.getByTestId("cosmic-scene"), space = page.getByTestId("cosmic-space");
    await input.fill("如何迈出下一步？");
    const facts = () => page.locator(".cosmic-card").evaluateAll((cards) => cards.map((card) => [card.getAttribute("data-anchor"), card.getAttribute("data-card-id"), card.getAttribute("data-orientation")]));
    const before = await facts(), canvas = await space.locator("canvas").elementHandle();
    const framesPromise = scene.evaluate(async (element) => {
      const frames: Array<{ stage: string; time: number; entered: number; rotation: number; x: number; y: number; selectable: number }> = [];
      const start = performance.now();
      await new Promise<void>((resolve) => {
        const frame = () => {
          const data = (element.querySelector('[data-testid="cosmic-space"]') as HTMLElement).dataset;
          const sceneData = (element as HTMLElement).dataset;
          const stage = document.querySelector("main")!.dataset.stage!;
          frames.push({ stage, time: Number(sceneData.rotationTime), entered: Number(data.ringEntered), rotation: Number(sceneData.rotation), x: Number(data.cameraX), y: Number(data.cameraY),
            selectable: element.querySelectorAll('.cosmic-card:not([disabled])').length });
          if (stage === "draw" || performance.now() - start > 11000) resolve(); else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
      return frames;
    });
    await input.press("Enter");
    await expect(page.getByTestId("cosmic-experience")).toHaveAttribute("data-stage", "travel");
    await expect(page.locator(".cosmic-track")).toHaveCount(0);
    await expect(page.locator(".cosmic-header")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("cosmic-experience")).toHaveAttribute("data-stage", "travel");
    const directory = "output/ring-entry-2026-11-06";
    await mkdir(directory, { recursive: true });
    await page.waitForTimeout(1600);
    await page.screenshot({ path: `${directory}/${width}-01-dive.png` });
    await expect.poll(async () => Number(await space.getAttribute("data-ring-entered"))).toBeGreaterThan(15);
    await page.screenshot({ path: `${directory}/${width}-02-entry.png` });
    await expect.poll(async () => Number(await space.getAttribute("data-ring-entered"))).toBe(78);
    await page.screenshot({ path: `${directory}/${width}-03-settling.png` });
    await expect(page.getByTestId("cosmic-experience")).toHaveAttribute("data-stage", "draw");
    const frames = await framesPromise, travel = frames.filter((frame) => frame.stage === "travel");
    expect(travel.length).toBeGreaterThan(40);
    expect(travel.at(-1)!.time - travel[0].time).toBeGreaterThan(7400);
    expect(travel.at(-1)!.time - travel[0].time).toBeLessThan(8100);
    expect(travel.some((frame) => frame.entered > 0 && frame.entered < 20)).toBe(true);
    expect(travel.some((frame) => frame.entered > 40 && frame.entered < 78)).toBe(true);
    expect(travel.at(-1)!.entered).toBe(78);
    for (let i = 1; i < travel.length; i++) expect(travel[i].entered).toBeGreaterThanOrEqual(travel[i - 1].entered);
    expect(travel.every((frame) => frame.selectable === 0)).toBe(true);
    expect(frames.some((frame) => frame.stage === "shuffle")).toBe(false);
    expect(await facts()).toEqual(before);
    expect(await canvas!.evaluate((node) => node === document.querySelector(".cosmic-space canvas"))).toBe(true);
    await expect(page.locator('.cosmic-card:not([disabled])')).toHaveCount(78);
    await page.screenshot({ path: `${directory}/${width}-04-draw.png` });
    await canvas!.dispose();
    expect(errors).toEqual([]); expect(requests).toEqual([]);
  });
}

test("a new round returns from the downstream space to the fixed question station", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "开始占卜", exact: true }).click();
  await page.getByRole("button", { name: "单牌 1 张", exact: true }).click();
  const question = page.getByLabel("你想问星空什么？"), stage = page.getByTestId("cosmic-experience"), space = page.getByTestId("cosmic-space");
  await question.fill("下一步关注什么？"); await question.press("Enter");
  await expect(stage).toHaveAttribute("data-stage", "draw");
  await page.getByTestId("orbit-card-20").press("Enter");
  await page.getByRole("button", { name: "查看整体解读", exact: true }).click();
  await page.getByRole("button", { name: "再次占卜", exact: true }).click();
  await expect(stage).toHaveAttribute("data-stage", "prepare");
  await expect(space).toHaveAttribute("data-camera-x", "16.00000");
  await expect(space).toHaveAttribute("data-camera-y", "-9.50000");
  await expect(space).toHaveAttribute("data-camera-z", "-6.00000");
  await expect(question).toHaveValue("下一步关注什么？");
  await question.press("Escape");
  await expect(stage).toHaveAttribute("data-stage", "home");
  await expect(space).toHaveAttribute("data-camera-x", "0.00000");
});

test("the question particle loop tolerates a transient zero-size layout before submission", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "开始占卜", exact: true }).click();
  const question = page.getByLabel("你想问星空什么？");
  await expect(question).toBeEnabled();
  const collapsed = await page.addStyleTag({ content: ".cosmic-question-frame { width: 0 !important; height: 0 !important; }" });
  await page.waitForTimeout(150);
  await collapsed.evaluate((element) => { element.parentNode?.removeChild(element); });
  await question.fill("如何开始下一段旅程？"); await question.press("Enter");
  await expect(page.getByTestId("cosmic-experience")).toHaveAttribute("data-stage", "travel");
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});
