import { expect, test, type Page } from "@playwright/test";
import { homeCardStream } from "../../src/lib/cosmic-experience";

async function sampleStream(page: Page, duration: number) {
  return page.evaluate(async (ms) => {
    const frames: Array<{ time: number; cards: Array<{ x: number; y: number; top: number; scale: number; opacity: number; tilt: number }> }> = [];
    const start = performance.now();
    await new Promise<void>((resolve) => {
      const frame = (now: number) => {
        if (!frames.length || now - frames.at(-1)!.time >= 30) {
          const cards = Array.from(document.querySelectorAll<HTMLElement>(".cosmic-card")).slice(0, ms.count).map((card) => {
            const rect = card.getBoundingClientRect();
            const style = getComputedStyle(card);
            const matrix = new DOMMatrixReadOnly(style.transform);
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, top: rect.top,
              scale: Math.hypot(matrix.m11, matrix.m12, matrix.m13), opacity: Number(style.opacity),
              tilt: Math.atan2(matrix.m12, matrix.m11) * 180 / Math.PI };
          });
          frames.push({ time: now, cards });
        }
        if (now - start >= ms.duration) resolve();
        else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    return frames;
  }, { duration, count: homeCardStream.count });
}

function checkContinuousStream(frames: Awaited<ReturnType<typeof sampleStream>>, width: number, height: number) {
  const resets = new Set<number>();
  const problems: Array<{ frame: number; index: number; reason: string }> = [];
  const check = (condition: boolean, frame: number, index: number, reason: string) => {
    if (!condition) problems.push({ frame, index, reason });
  };
  for (let frame = 1; frame < frames.length; frame++) {
    for (let index = 0; index < homeCardStream.count; index++) {
      const before = frames[frame - 1].cards[index];
      const after = frames[frame].cards[index];
      if (before.y - after.y > height * 0.5) {
        // A wrap is allowed only after the entire card has left the screen.
        check(before.top > height, frame, index, "wrap before the entire card exits");
        check(after.opacity < 0.1, frame, index, "visible wrap at source");
        check(after.x / width > 0.8 && after.y / height > 0.15 && after.y / height < 0.25, frame, index, "source misses vortex");
        check(after.scale < 0.3, frame, index, "card reappears too large");
        resets.add(index);
      } else {
        check(after.y >= before.y - 0.01, frame, index, "backward vertical movement");
        check(after.scale >= before.scale - 0.0001, frame, index, "card shrinks before exit");
        const delta = (frames[frame].time - frames[frame - 1].time) / 1000;
        check(Math.hypot((after.x - before.x) / width, (after.y - before.y) / height) < delta * 0.25 + 0.002, frame, index, "position jumps between frames");
        check(Math.abs(after.tilt - before.tilt) < delta * 8 + 0.02, frame, index, "rotation is too fast");
        if (before.y > height * 0.7) check(after.tilt > before.tilt, frame, index, "foreground does not turn clockwise");
      }
    }
    if (frames[frame].time - frames[0].time > 1200) {
      const cards = frames[frame].cards;
      check(cards.filter((card) => card.y < height * 0.5 && card.opacity > 0.9).length >= 26, frame, -1, "distant cards are too sparse");
      check(cards.filter((card) => card.y > height * 0.65 && card.y < height * 1.25).length <= 5, frame, -1, "foreground is too crowded");
    }
  }
  expect(problems).toEqual([]);
  return resets;
}

test("homepage cards flow through a full loop and gather without remounting or jumping", async ({ page }) => {
  test.setTimeout(homeCardStream.durationMs + 30_000);
  const errors: string[] = [];
  const apiCalls: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => { if (request.url().includes("/api/reading")) apiCalls.push(request.url()); });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "命运回廊", exact: true })).toBeVisible();
  const elements = await page.locator(".cosmic-card").first().evaluateHandle((first) => Array.from(first.parentElement!.children));
  const identity = () => page.locator(".cosmic-card").evaluateAll((cards) => cards.map((card) => ({
    anchor: card.getAttribute("data-anchor"), id: card.getAttribute("data-card-id"), orientation: card.getAttribute("data-orientation"),
  })));
  const before = await identity();
  const frames = await sampleStream(page, homeCardStream.durationMs + 1000);
  expect(checkContinuousStream(frames, 1920, 1080).size).toBe(homeCardStream.count);
  expect(await identity()).toEqual(before);
  await page.screenshot({ path: "output/frontend-v2/home-stream-1920.png" });

  await page.getByRole("button", { name: "开始占卜", exact: true }).click();
  await page.getByLabel("你想问星空什么？").fill("我可以如何迈出下一步？");
  // The stream must continue behind the preparation panel, including effect restarts.
  const preparing = await sampleStream(page, 500);
  expect(preparing.at(-1)!.cards[0].y).toBeGreaterThan(preparing[0].cards[0].y);
  const transition = sampleStream(page, 4800);
  await page.getByRole("button", { name: "开启星轨", exact: true }).click();
  const gathering = await transition;
  let largestStepRatio = 0;
  for (let frame = 1; frame < gathering.length; frame++) {
    for (let index = 0; index < homeCardStream.count; index++) {
      const previous = gathering[frame - 1].cards[index];
      const next = gathering[frame].cards[index];
      const dt = (gathering[frame].time - gathering[frame - 1].time) / 1000;
      const distance = Math.hypot((next.x - previous.x) / 1920, (next.y - previous.y) / 1080);
      largestStepRatio = Math.max(largestStepRatio, distance / (dt * 3 + 0.01));
    }
  }
  expect(largestStepRatio).toBeLessThan(1);
  await expect(page.getByTestId("cosmic-experience")).toHaveAttribute("data-stage", "draw");
  await expect(page.locator('.cosmic-card:not([disabled])')).toHaveCount(78);
  expect(new Set((await identity()).map((card) => card.id)).size).toBe(78);
  expect(await page.evaluate((original) => original.every((node, index) => node === document.querySelectorAll(".cosmic-card")[index]), elements)).toBe(true);
  const shuffled = await identity();
  await page.getByRole("button", { name: "命运回廊，返回首页", exact: true }).click();
  const returning = await sampleStream(page, 5800);
  const resumed = returning.filter((frame) => frame.time > returning.at(-1)!.time - 500);
  expect(resumed.at(-1)!.cards[0].y).toBeGreaterThan(resumed[0].cards[0].y);
  expect(await identity()).toEqual(shuffled);
  expect(await page.evaluate((original) => original.every((node, index) => node === document.querySelectorAll(".cosmic-card")[index]), elements)).toBe(true);
  await elements.dispose();
  expect(apiCalls).toEqual([]);
  expect(errors).toEqual([]);
});

test("homepage stream clears the title and loops on a smaller desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const frames = await sampleStream(page, 6500);
  expect(checkContinuousStream(frames, 1280, 720).size).toBeGreaterThanOrEqual(Math.floor(6500 / (homeCardStream.durationMs / homeCardStream.count)));
  const hero = await page.locator(".cosmic-hero").boundingBox();
  expect(hero).not.toBeNull();
  for (const frame of frames) {
    for (const card of frame.cards) {
      if (card.y < hero!.y + hero!.height && card.opacity > 0.1) expect(card.x).toBeGreaterThan(hero!.x + hero!.width + 80);
    }
  }
  await page.screenshot({ path: "output/frontend-v2/home-stream-1280.png" });
});

test("reduced motion keeps the home stream still across preparation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const frames = await sampleStream(page, 1100);
  expect(frames.at(-1)!.cards).toEqual(frames[0].cards);
  await page.getByRole("button", { name: "开始占卜", exact: true }).click();
  const preparing = await sampleStream(page, 1100);
  expect(preparing.at(-1)!.cards).toEqual(frames.at(-1)!.cards);
  await page.getByRole("button", { name: "关闭面板", exact: true }).click();
  await expect(page.getByRole("heading", { name: "命运回廊", exact: true })).toBeVisible();
});
