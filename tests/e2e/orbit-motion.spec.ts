import { expect, test, type Page } from "@playwright/test";

async function measureRotation(page: Page, duration: number) {
  return page.getByTestId("cosmic-scene").evaluate(async (scene, ms) => {
    const read = () => ({ angle: Number(scene.getAttribute("data-rotation")), time: performance.now() });
    const start = read();
    await new Promise<void>((resolve) => {
      const frame = () => { if (performance.now() - start.time >= ms) resolve(); else requestAnimationFrame(frame); };
      requestAnimationFrame(frame);
    });
    const end = read();
    return (end.angle - start.angle) / (end.time - start.time);
  }, duration);
}

test("the completed ring settles into continuous idle without pausing on hover", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.getByRole("button", { name: "开始占卜", exact: true }).click();
  await page.getByLabel("你想问星空什么？").fill("我可以怎样开始新的计划？");
  const framesPromise = page.evaluate(async () => new Promise<Array<{ stage: string; angle: number; time: number }>>((resolve) => {
    const frames: Array<{ stage: string; angle: number; time: number }> = [];
    let drawStart: number | undefined;
    const frame = (now: number) => {
      const scene = document.querySelector('[data-testid="cosmic-scene"]');
      const stage = document.querySelector("main")?.getAttribute("data-stage") ?? "";
      const renderedTime = scene?.getAttribute("data-rotation-time");
      const time = renderedTime ? Number(renderedTime) : now;
      frames.push({ stage, angle: Number(scene?.getAttribute("data-rotation")), time });
      if (stage === "draw") drawStart ??= time;
      if (drawStart !== undefined && time - drawStart >= 3200) resolve(frames);
      else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }));
  await page.getByLabel("你想问星空什么？").press("Enter");
  // Keep the pointer on the ring for the transition, then compare with the empty upper corner.
  await page.mouse.move(960, 820);
  const frames = await framesPromise;
  const travel = frames.filter((frame) => frame.stage === "travel");
  const draw = frames.filter((frame) => frame.stage === "draw");
  const averageSpeed = (samples: typeof frames) => (samples.at(-1)!.angle - samples[0].angle) / (samples.at(-1)!.time - samples[0].time);
  const window = (start: number, end: number) => draw.filter((frame) => frame.time - draw[0].time >= start && frame.time - draw[0].time < end);
  const travelEnd = travel.at(-1)!.time;
  const settlingSpeed = averageSpeed(travel.filter((frame) => frame.time >= travelEnd - 1100 && frame.time < travelEnd - 900));
  const arrivalTail = averageSpeed(travel.filter((frame) => frame.time >= travelEnd - 350 && frame.time < travelEnd - 50));
  expect(settlingSpeed).toBeGreaterThan(0.0005);
  expect(settlingSpeed).toBeLessThan(0.001);
  expect(arrivalTail).toBeGreaterThan(0.000065);
  expect(arrivalTail).toBeLessThan(settlingSpeed / 2);
  const early = averageSpeed(window(50, 350));
  const middle = averageSpeed(window(850, 1150));
  const late = averageSpeed(window(2600, 3100));
  expect(early).toBeGreaterThan(0.00005);
  expect(early).toBeLessThan(0.00008);
  expect(Math.abs(middle - early)).toBeLessThan(0.000015);
  expect(Math.abs(late - early)).toBeLessThan(0.000015);
  expect(late).toBeGreaterThan(0.00005);
  expect(late).toBeLessThan(0.00008);
  const hovered = await measureRotation(page, 700);
  expect(hovered).toBeGreaterThan(0.00005);
  expect(hovered).toBeLessThan(0.000075);
  await page.mouse.move(1800, 50);
  const outside = await measureRotation(page, 700);
  expect(outside).toBeGreaterThan(0.00005);
  expect(Math.abs(hovered - outside)).toBeLessThan(0.000015);

  const facts = () => page.locator(".cosmic-card").evaluateAll((cards) => cards.map((card) => ({
    id: card.getAttribute("data-card-id"), anchor: card.getAttribute("data-anchor"), orientation: card.getAttribute("data-orientation"), selected: card.getAttribute("data-selected"),
  })));
  const before = await facts();
  for (const sign of [-1, 1]) {
    // At the foreground, screen-right is negative angular rotation and screen-left positive.
    await page.mouse.move(960, 842);
    await page.mouse.down();
    await page.mouse.move(960 - sign * 280, 842, { steps: 20 });
    await page.mouse.up();
    const released = await measureRotation(page, 300);
    expect(released * sign).toBeGreaterThan(0.0001);
    const settled = await measureRotation(page, 3100);
    expect(settled * sign).toBeGreaterThan(0.00006);
    const idle = await measureRotation(page, 600);
    expect(idle * sign).toBeGreaterThan(0.00005);
    expect(idle * sign).toBeLessThan(0.00008);
    expect(await facts()).toEqual(before);
  }
});
