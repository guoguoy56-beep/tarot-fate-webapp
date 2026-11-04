import { expect, test, type Page } from "@playwright/test";
import { readingIdleMotion, readingIdlePose } from "../../src/lib/cosmic-experience";

async function pickFrontCard(page: Page) {
  const findTarget = () => page.locator('.cosmic-card:not([disabled])').evaluateAll((cards) => {
    return cards.flatMap((card) => {
      const rect = card.getBoundingClientRect();
      return [0.25, 0.5, 0.75].map((fraction) => {
        const x = rect.x + rect.width * fraction;
        const y = rect.y + rect.height * 0.7;
        return { anchor: card.getAttribute("data-anchor"), x, y, hit: card.contains(document.elementFromPoint(x, y)) };
      });
    }).filter((card) => card.hit && card.y > window.innerHeight * 0.45).sort((a, b) => b.y - a.y)[0];
  });
  // Stage state is committed before the next projected animation frame is painted.
  await expect.poll(async () => Boolean(await findTarget())).toBe(true);
  const target = await findTarget();
  expect(target).toBeTruthy();
  await page.mouse.click(target.x, target.y);
  return target.anchor;
}

async function samplePresentation(page: Page, duration: number, previousAnchor: string | null = null) {
  return page.evaluate(async ({ ms, previous }) => {
    const frames: Array<{ time: number; clock: number; arrivalTime: number | null; x: number; y: number; width: number; height: number; flip: number; yaw: number; pitch: number; rotation: number; topBottom: number; leftRight: number }> = [];
    const start = performance.now();
    let first = 0;
    let revealClock: Animation | undefined;
    await new Promise<void>((resolve) => {
      const record = (now: number) => {
        const card = document.querySelector<HTMLElement>('.cosmic-card.is-face-up');
        if (card && card.dataset.anchor !== previous) {
          if (!frames.length) first = now;
          const rect = card.getBoundingClientRect();
          const flipper = card.querySelector('.cosmic-card-flipper')!;
          revealClock ??= flipper.getAnimations().find((animation) => animation instanceof CSSTransition && animation.transitionProperty === "transform");
          const pose = card.querySelector('.cosmic-card-pose');
          const flip = new DOMMatrixReadOnly(getComputedStyle(flipper).transform);
          const tilt = pose ? new DOMMatrixReadOnly(getComputedStyle(pose).transform) : new DOMMatrixReadOnly();
          const front = card.querySelector<HTMLElement>('.cosmic-card-front')!;
          if (!front.querySelector('[data-corner]')) {
            for (const [left, top] of [[0, 0], [100, 0], [100, 100], [0, 100]]) {
              const point = document.createElement('span');
              point.dataset.corner = '';
              point.style.cssText = `position:absolute;left:${left}%;top:${top}%;width:0;height:0;pointer-events:none`;
              front.append(point);
            }
          }
          const corners = Array.from(front.querySelectorAll('[data-corner]'), (point) => point.getBoundingClientRect());
          const edge = (a: number, b: number) => Math.hypot(corners[a].x - corners[b].x, corners[a].y - corners[b].y);
          frames.push({ time: now - first, clock: now, arrivalTime: typeof revealClock?.startTime === "number" ? now - revealClock.startTime : null,
            x: rect.x, y: rect.y, width: rect.width, height: rect.height,
            flip: Math.atan2(flip.m31, flip.m11) * 180 / Math.PI,
            yaw: Math.atan2(tilt.m31, tilt.m11) * 180 / Math.PI,
            pitch: Math.atan2(tilt.m23, tilt.m22) * 180 / Math.PI,
            rotation: Number(document.querySelector<HTMLElement>('[data-testid="cosmic-scene"]')!.dataset.rotation),
            topBottom: edge(0, 1) / edge(3, 2), leftRight: edge(0, 3) / edge(1, 2) });
        }
        if (now - start >= ms) resolve();
        else requestAnimationFrame((time) => setTimeout(() => record(time), 0));
      };
      // Read after the scene's RAF writes, so we observe the frame actually presented by the browser.
      requestAnimationFrame((time) => setTimeout(() => record(time), 0));
    });
    return frames;
  }, { ms: duration, previous: previousAnchor });
}

function expectArrivalSequence(frames: Awaited<ReturnType<typeof samplePresentation>>) {
  // A class can commit before the transition's first frame; measure from its actual clock.
  const arrival = frames.filter((frame) => frame.arrivalTime !== null && frame.arrivalTime >= 0);
  expect(arrival.length).toBeGreaterThan(20);
  const at = (time: number) => arrival.reduce((closest, frame) => Math.abs(frame.arrivalTime! - time) < Math.abs(closest.arrivalTime! - time) ? frame : closest);
  const first = frames[0], last = frames.at(-1)!;
  const progress = (frame: typeof first) => (frame.rotation - first.rotation) / (last.rotation - first.rotation);
  // The approach starts first; the delayed flip remains visible late in the same transition.
  expect(progress(at(400))).toBeGreaterThan(0.5);
  expect(progress(at(600)) - progress(at(200))).toBeGreaterThan((progress(at(1400)) - progress(at(1000))) * 3);
  expect(Math.abs(at(200).flip)).toBeLessThan(2);
  expect(Math.abs(at(400).flip)).toBeLessThan(30);
  expect(Math.abs(at(900).flip)).toBeGreaterThan(45);
  expect(Math.abs(at(900).flip)).toBeLessThan(135);
  expect(Math.abs(at(1300).flip)).toBeGreaterThan(120);
  expect(Math.abs(at(1300).flip)).toBeLessThan(178);
  // Turning is already under way before arrival and continues across the handoff.
  expect(at(1500).yaw).toBeGreaterThan(at(1300).yaw + 2);
  expect(at(1800).yaw).toBeGreaterThan(at(1500).yaw + 1);
  const join = arrival.filter((frame) => frame.arrivalTime! >= 1500 && frame.arrivalTime! <= 1900);
  for (let index = 1; index < join.length; index++) {
    expect(join[index].yaw).toBeGreaterThan(join[index - 1].yaw);
  }
}

test("cosmic ring preserves shuffled anchors through drag, reading and summary", async ({ page }) => {
  const errors: string[] = [];
  const apiCalls: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("request", (request) => { if (request.url().includes("/api/reading")) apiCalls.push(request.url()); });
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "主导航" });
  await expect(navigation).toBeVisible();
  await expect(page.getByRole("heading", { name: "命运回廊", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "开始占卜", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".cosmic-header nav")).toBeVisible();
  await page.getByLabel("你想问星空什么？").fill("如何为接下来的学习找到方向？");
  await page.getByRole("button", { name: "开启星轨", exact: true }).click();
  await expect(page.getByTestId("cosmic-experience")).toHaveAttribute("data-stage", "travel");
  await expect(navigation).toHaveCount(0);
  await expect(page.getByRole("button", { name: "命运回廊，返回首页", exact: true })).toBeVisible();
  await expect(page.getByTestId("cosmic-experience")).toHaveAttribute("data-stage", "shuffle");
  await expect(navigation).toHaveCount(0);
  await expect(page.getByTestId("cosmic-experience")).toHaveAttribute("data-stage", "draw");
  await expect(navigation).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "选择与你共鸣的牌" })).toBeVisible();
  await page.screenshot({ path: "output/ring-3d-2026-11-04/01-draw.png" });
  await pickFrontCard(page);
  await expect(page.locator('.cosmic-card[data-selected="true"]')).toHaveCount(1);
  const snapshot = () => page.locator(".cosmic-card").evaluateAll((cards) => cards.map((card) => ({
    anchor: card.getAttribute("data-anchor"), id: card.getAttribute("data-card-id"), orientation: card.getAttribute("data-orientation"), selected: card.getAttribute("data-selected"),
  })));
  const before = await snapshot();
  // The same screen drag has opposite angular signs on the front/back or left/right of an ellipse.
  for (const gesture of [
    { from: [960, 842], to: [1200, 842], sign: -1 },
    { from: [960, 454], to: [1200, 454], sign: 1 },
    { from: [182, 648], to: [182, 758], sign: -1 },
    { from: [1738, 648], to: [1738, 758], sign: 1 },
  ]) {
    await page.mouse.move(gesture.from[0], gesture.from[1]);
    await page.mouse.down();
    const rotation = Number(await page.getByTestId("cosmic-scene").getAttribute("data-rotation"));
    await page.mouse.move(gesture.to[0], gesture.to[1], { steps: 20 });
    await page.mouse.up();
    const after = Number(await page.getByTestId("cosmic-scene").getAttribute("data-rotation"));
    expect((after - rotation) * gesture.sign).toBeGreaterThan(0.01);
    await expect(page.locator('.cosmic-card[data-selected="true"]')).toHaveCount(1);
    expect(await snapshot()).toEqual(before);
  }
  await pickFrontCard(page);
  await expect(page.locator('.cosmic-card[data-selected="true"]')).toHaveCount(2);
  const [arrival] = await Promise.all([samplePresentation(page, 2300), pickFrontCard(page)]);
  await test.info().attach("first-arrival-frames", { body: JSON.stringify(arrival), contentType: "application/json" });
  await expect(page.getByTestId("cosmic-experience")).toHaveAttribute("data-stage", "reading");
  await expect(navigation).toHaveCount(0);
  const chosen = (await snapshot()).filter((card) => card.selected === "true");
  const settled = arrival.at(-1)!;
  expect(arrival.some((frame) => frame.time > 300 && frame.time < 850 && frame.flip > 5 && frame.flip < 175
    && Math.hypot(frame.x - settled.x, frame.y - settled.y, frame.width - settled.width) > 5)).toBe(true);
  expect(Math.abs(settled.flip)).toBeCloseTo(180, 1);
  expectArrivalSequence(arrival);
  await page.screenshot({ path: "output/ring-3d-2026-11-04/02-reading.png" });
  const cycleMs = readingIdleMotion.swayMs + readingIdleMotion.turnMs;
  const idle = await samplePresentation(page, cycleMs * 2 + 100);
  expect(idle.length).toBeGreaterThan(100);
  for (const dimension of ["x", "y", "width", "height"] as const) {
    expect(Math.max(...idle.map((frame) => frame[dimension])) - Math.min(...idle.map((frame) => frame[dimension]))).toBeLessThan(0.1);
  }
  expect(Math.min(...idle.map((frame) => frame.yaw))).toBeLessThan(-20);
  expect(Math.max(...idle.map((frame) => frame.yaw))).toBeGreaterThan(20);
  expect(Math.max(...idle.map((frame) => frame.pitch))).toBeGreaterThan(9);
  expect(Math.max(...idle.map((frame) => frame.pitch))).toBeLessThanOrEqual(10.01);
  const facing = idle.filter((frame) => Math.abs(Math.abs(frame.flip) - 180) < 0.01 && Math.abs(frame.yaw) <= 25);
  // Projected edges must change in the actual viewport, not just in an internal rotation matrix.
  // At 10 degrees, a 116px card under 380px perspective projects to about this edge ratio.
  expect(Math.min(...facing.map((frame) => frame.topBottom))).toBeCloseTo(0.948, 2);
  expect(Math.min(...facing.map((frame) => frame.leftRight))).toBeLessThan(0.98);
  expect(Math.max(...facing.map((frame) => frame.leftRight))).toBeGreaterThan(1.02);
  let fullTurn = 0;
  const completedTurns: number[] = [];
  const speeds: Array<{ angle: number; rate: number }> = [];
  for (let index = 1; index < idle.length; index++) {
    const before = idle[index - 1], after = idle[index];
    const delta = (after.flip + after.yaw - before.flip - before.yaw) * Math.PI / 180;
    const step = Math.atan2(Math.sin(delta), Math.cos(delta)) * 180 / Math.PI;
    speeds.push({ angle: idle[0].flip + idle[0].yaw + fullTurn + step / 2, rate: step / (after.time - before.time) * 1000 });
    for (const boundary of [cycleMs, cycleMs * 2]) {
      if (before.time < boundary && after.time >= boundary) {
        completedTurns.push(fullTurn + step * (boundary - before.time) / (after.time - before.time));
      }
    }
    fullTurn += step;
  }
  expect(completedTurns).toHaveLength(2);
  completedTurns.forEach((turn, index) => expect(turn).toBeCloseTo(360 * (index + 1), 0));
  expect(Math.min(...speeds.map((item) => item.rate))).toBeGreaterThan(2);
  expect(Math.max(...speeds.map((item) => item.rate))).toBeGreaterThan(300);
  for (const seam of [204, 516, 564, 876]) {
    const crossing = speeds.filter((item) => Math.abs(item.angle - seam) < 4);
    expect(crossing.length).toBeGreaterThan(0);
    expect(Math.min(...crossing.map((item) => item.rate))).toBeGreaterThan(12);
  }
  expect((await snapshot()).filter((card) => card.selected === "true")).toEqual(chosen);
  await expect(page.locator(".cosmic-card.is-face-up img")).toBeVisible();
  await expect(page.getByText("示例解读", { exact: true })).toBeVisible();
  const previousAnchor = await page.locator('.cosmic-card.is-face-up').getAttribute("data-anchor");
  const [nextArrival] = await Promise.all([
    samplePresentation(page, 2300, previousAnchor),
    page.getByRole("button", { name: "下一张", exact: true }).click(),
  ]);
  await test.info().attach("next-arrival-frames", { body: JSON.stringify(nextArrival), contentType: "application/json" });
  const nextSettled = nextArrival.at(-1)!;
  expect(nextArrival.some((frame) => frame.time > 300 && frame.time < 850 && frame.flip > 5 && frame.flip < 175
    && Math.hypot(frame.x - nextSettled.x, frame.y - nextSettled.y, frame.width - nextSettled.width) > 5)).toBe(true);
  expect(Math.abs(nextSettled.flip)).toBeCloseTo(180, 1);
  expectArrivalSequence(nextArrival);
  await expect(page.getByText("现在 · 第 2 / 3 张", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "上一张", exact: true }).click();
  await expect(page.getByText("过去 · 第 1 / 3 张", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "下一张", exact: true }).click();
  await page.getByRole("button", { name: "下一张", exact: true }).click();
  await expect(page.getByText("未来 · 第 3 / 3 张", { exact: true })).toBeVisible();
  expect((await snapshot()).filter((card) => card.selected === "true")).toEqual(chosen);
  await page.getByRole("button", { name: "查看整体解读", exact: true }).click();
  await expect(page.getByTestId("cosmic-experience")).toHaveAttribute("data-stage", "summarizing");
  await expect(navigation).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "命运手记", exact: true })).toBeVisible();
  await expect(navigation).toHaveCount(0);
  const summaryBody = page.getByRole("region", { name: "整体分析正文", exact: true });
  await expect(page.getByRole("heading", { name: "命运手记", exact: true })).toBeFocused();
  await summaryBody.press("End");
  await expect.poll(() => summaryBody.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  // End scrolls asynchronously: record the final position, not the last few pixels of motion.
  await expect.poll(() => summaryBody.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop)).toBeLessThan(1);
  const rememberedScroll = await summaryBody.evaluate((element) => element.scrollTop);
  await page.locator(".cosmic-summary-cards button").first().click();
  await expect(page.getByText("过去 · 第 1 / 3 张", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "返回整体解读", exact: true }).click();
  await expect(page.getByRole("heading", { name: "命运手记", exact: true })).toBeFocused();
  await expect.poll(async () => Math.abs(await summaryBody.evaluate((element) => element.scrollTop) - rememberedScroll)).toBeLessThan(2);
  await page.screenshot({ path: "output/ring-3d-2026-11-04/03-summary.png" });
  expect((await snapshot()).filter((card) => card.selected === "true")).toEqual(chosen);
  await page.getByRole("button", { name: "保存示例手记", exact: true }).click();
  await page.getByRole("button", { name: "命运回廊，返回首页", exact: true }).click();
  await expect(page.getByTestId("cosmic-experience")).toHaveAttribute("data-stage", "home");
  await expect(navigation).toBeVisible();
  await page.getByRole("button", { name: "历史记录", exact: true }).click();
  await expect(page.getByText("本次浏览 · 示例", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "如何为接下来的学习找到方向？", exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("tarot_reading_records"))).toBeNull();
  expect(apiCalls).toEqual([]);
  expect(errors).toEqual([]);
});

test("reading card drag is stronger, has soft thresholds and returns to the uninterrupted timeline", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "开始占卜", exact: true }).click();
  await page.getByRole("button", { name: "单牌 1 张", exact: true }).click();
  await page.getByLabel("你想问星空什么？").fill("如何更好地理解此刻的自己？");
  await page.getByRole("button", { name: "开启星轨", exact: true }).click();
  await expect(page.getByTestId("cosmic-experience")).toHaveAttribute("data-stage", "draw");
  await pickFrontCard(page);
  await expect(page.getByRole("button", { name: "查看整体解读", exact: true })).toBeEnabled();
  const card = page.locator(".cosmic-card.is-face-up");
  const identity = await card.evaluate((el) => ({ anchor: el.dataset.anchor, card: el.dataset.cardId, orientation: el.dataset.orientation }));
  const reference = (await samplePresentation(page, 120)).at(-1)!;
  let low = 0, high = readingIdleMotion.swayMs;
  for (let index = 0; index < 24; index++) {
    const middle = (low + high) / 2;
    if (readingIdlePose(middle).yaw < reference.yaw) low = middle;
    else high = middle;
  }
  const referencePhase = (low + high) / 2;
  const rect = (await card.boundingBox())!;
  const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(450);
  const grabbed = (await samplePresentation(page, 70)).at(-1)!;
  const direction = grabbed.yaw > 0 ? -1 : 1;
  await page.mouse.move(x + direction * 40, y, { steps: 6 });
  await expect.poll(async () => (await samplePresentation(page, 70)).at(-1)!.yaw - grabbed.yaw).toBeCloseTo(direction * 11.52, 1);
  await page.mouse.move(x - 200, y, { steps: 12 });
  await expect.poll(async () => (await samplePresentation(page, 70)).at(-1)!.yaw).toBeLessThan(-25);
  const leftEdge = (await samplePresentation(page, 70)).at(-1)!.yaw;
  await page.mouse.move(x - 200, y - 200, { steps: 12 });
  await expect.poll(async () => (await samplePresentation(page, 70)).at(-1)!.pitch).toBeGreaterThan(25);
  await page.mouse.move(x + 200, y - 200, { steps: 12 });
  await expect.poll(async () => (await samplePresentation(page, 70)).at(-1)!.yaw).toBeGreaterThan(25);
  const edge0 = (await samplePresentation(page, 70)).at(-1)!.yaw;
  await page.mouse.move(x + 300, y - 200, { steps: 8 });
  const edge1 = (await samplePresentation(page, 100)).at(-1)!.yaw;
  await page.mouse.move(x + 400, y - 200, { steps: 8 });
  const edge2 = (await samplePresentation(page, 100)).at(-1)!.yaw;
  expect(edge1).toBeGreaterThan(edge0);
  expect(edge2).toBeGreaterThan(edge1);
  expect(edge2 - edge1).toBeLessThan(edge1 - edge0);
  const heldStill = await samplePresentation(page, 150);
  expect(heldStill.at(-1)!.yaw).toBeCloseTo(heldStill[0].yaw, 2);
  await page.mouse.move(x - 200, y - 200, { steps: 12 });
  await expect.poll(async () => (await samplePresentation(page, 70)).at(-1)!.yaw).toBeCloseTo(leftEdge, 1);
  await page.mouse.move(x + 200, y - 200, { steps: 12 });
  await page.mouse.move(x + 200, y + 200, { steps: 12 });
  await expect.poll(async () => (await samplePresentation(page, 70)).at(-1)!.pitch).toBeLessThan(-25);
  const released = (await samplePresentation(page, 70)).at(-1)!;
  // Hold through an entire cycle, then release while the original timeline is on its front arc.
  const cycleMs = readingIdleMotion.swayMs + readingIdleMotion.turnMs;
  const now = await page.evaluate(() => performance.now());
  const releaseAt = reference.clock + Math.ceil((now - reference.clock + 100) / cycleMs) * cycleMs + 300;
  await page.waitForTimeout(Math.max(0, releaseAt - now));
  await page.mouse.up();
  const resumed = await samplePresentation(page, 1000);
  expect(resumed[0].yaw).toBeCloseTo(released.yaw, 0);
  expect(resumed[0].pitch).toBeCloseTo(released.pitch, 0);
  const caughtUp = resumed.filter((frame) => frame.time >= readingIdleMotion.returnMs + 30);
  expect(caughtUp.length).toBeGreaterThan(1);
  for (const frame of caughtUp) {
    const scheduled = readingIdlePose(referencePhase + frame.clock - reference.clock);
    const difference = (frame.yaw - scheduled.yaw) * Math.PI / 180;
    expect(Math.abs(Math.atan2(Math.sin(difference), Math.cos(difference)) * 180 / Math.PI)).toBeLessThan(0.5);
    expect(Math.abs(frame.pitch - scheduled.pitch)).toBeLessThan(0.5);
  }
  expect(resumed.every((frame) => Math.abs(Math.abs(frame.flip) - 180) < 0.01)).toBe(true);
  expect(await card.evaluate((el) => ({ anchor: el.dataset.anchor, card: el.dataset.cardId, orientation: el.dataset.orientation }))).toEqual(identity);
  await expect(page.locator('.cosmic-card[data-selected="true"]')).toHaveCount(1);
  await page.getByRole("button", { name: "查看整体解读", exact: true }).click();
  await expect(page.getByRole("heading", { name: "命运手记", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("reading card accepts repeated grabs during its return to the original idle timeline", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "开始占卜", exact: true }).click();
  await page.getByRole("button", { name: "单牌 1 张", exact: true }).click();
  await page.getByLabel("你想问星空什么？").fill("如何理解反复出现的想法？");
  await page.getByRole("button", { name: "开启星轨", exact: true }).click();
  await expect(page.getByTestId("cosmic-experience")).toHaveAttribute("data-stage", "draw");
  await pickFrontCard(page);
  await expect(page.getByRole("button", { name: "查看整体解读", exact: true })).toBeEnabled();
  const card = page.locator(".cosmic-card.is-face-up");
  const identity = await card.evaluate((el) => ({ anchor: el.dataset.anchor, card: el.dataset.cardId, orientation: el.dataset.orientation }));
  const reference = (await samplePresentation(page, 70)).at(-1)!;
  let low = 0, high = readingIdleMotion.swayMs;
  for (let index = 0; index < 24; index++) {
    const middle = (low + high) / 2;
    if (readingIdlePose(middle).yaw < reference.yaw) low = middle;
    else high = middle;
  }
  const referencePhase = (low + high) / 2;
  const rect = (await card.boundingBox())!;
  const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
  let lastRelease: number | null = null;
  for (const direction of [1, -1, 1, -1]) {
    await page.mouse.move(x, y);
    const beforeGrab = lastRelease === null ? null : (await samplePresentation(page, 20)).at(-1)!;
    await page.mouse.down();
    const held = await samplePresentation(page, lastRelease === null ? readingIdleMotion.holdMs + 140 : 140);
    const grabbed = held.at(-1)!;
    if (beforeGrab) {
      expect(Math.abs(held[0].yaw - beforeGrab.yaw)).toBeLessThan(0.5);
      expect(Math.abs(held[0].pitch - beforeGrab.pitch)).toBeLessThan(0.5);
    }
    // A returning card is grabbed immediately; only the initial idle grab needs a long press.
    const tail = held.filter((frame) => frame.time >= (lastRelease === null ? readingIdleMotion.holdMs + 60 : 0));
    expect(tail.length).toBeGreaterThan(1);
    expect(Math.max(...tail.map((frame) => frame.yaw)) - Math.min(...tail.map((frame) => frame.yaw))).toBeLessThan(0.05);
    expect(Math.max(...tail.map((frame) => frame.pitch)) - Math.min(...tail.map((frame) => frame.pitch))).toBeLessThan(0.05);
    await page.mouse.move(x + direction * 30, y - direction * 20, { steps: 4 });
    const moved = (await samplePresentation(page, 70)).at(-1)!;
    expect(moved.yaw - grabbed.yaw).toBeCloseTo(direction * 8.64, 1);
    expect(moved.pitch - grabbed.pitch).toBeCloseTo(direction * 5.76, 1);
    if (lastRelease !== null) expect(moved.clock - lastRelease).toBeLessThan(readingIdleMotion.returnMs);
    await page.mouse.up();
    lastRelease = await page.evaluate(() => performance.now());
    await page.waitForTimeout(50);
  }
  const resumed = await samplePresentation(page, 1000);
  for (const frame of resumed.filter((item) => item.time >= readingIdleMotion.returnMs + 30)) {
    const scheduled = readingIdlePose(referencePhase + frame.clock - reference.clock);
    const difference = (frame.yaw - scheduled.yaw) * Math.PI / 180;
    expect(Math.abs(Math.atan2(Math.sin(difference), Math.cos(difference)) * 180 / Math.PI)).toBeLessThan(0.5);
    expect(Math.abs(frame.pitch - scheduled.pitch)).toBeLessThan(0.5);
  }
  expect(await card.evaluate((el) => ({ anchor: el.dataset.anchor, card: el.dataset.cardId, orientation: el.dataset.orientation }))).toEqual(identity);
  expect(errors).toEqual([]);
});

for (const [name, count] of [["单牌", 1], ["是非牌", 1], ["三牌阵", 3], ["十字牌阵", 5], ["恋人十字牌阵", 5], ["暗恋牌阵", 4], ["心之声", 4]] as const) {
  test(`${name} completes at ${count} cards with manual review`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.getByRole("button", { name: "开始占卜", exact: true }).click();
    await page.getByRole("button", { name: `${name} ${count} 张`, exact: true }).click();
    const question = name === "十字牌阵" ? "如何在接下来的学习中平衡自己的期待与实际安排？".repeat(20).slice(0, 500) : "我该如何理解此刻的感受？";
    await page.getByLabel("你想问星空什么？").fill(question);
    await page.getByRole("button", { name: "开启星轨", exact: true }).click();
    await expect(page.getByTestId("cosmic-experience")).toHaveAttribute("data-stage", "draw");
    for (let index = 0; index < count; index++) {
      await pickFrontCard(page);
      await expect(page.locator('.cosmic-card[data-selected="true"]')).toHaveCount(index + 1);
    }
    await expect(page.getByTestId("cosmic-experience")).toHaveAttribute("data-stage", "reading");
    await expect(page.locator('.cosmic-card[data-selected="true"]')).toHaveCount(count);
    if (name === "单牌") {
      const still = await samplePresentation(page, 300);
      expect(still.length).toBeGreaterThan(1);
      expect(still.every((frame) => Math.abs(Math.abs(frame.flip) - 180) < 0.01 && Math.abs(frame.yaw) < 0.01 && Math.abs(frame.pitch) < 0.01)).toBe(true);
    }
    for (let index = 1; index < count; index++) await page.getByRole("button", { name: "下一张", exact: true }).click();
    await page.getByRole("button", { name: "查看整体解读", exact: true }).click();
    await expect(page.getByRole("heading", { name: "命运手记", exact: true })).toBeVisible();
    await expect(page.locator(".cosmic-summary-cards button")).toHaveCount(count);
    await expect(page.getByRole("heading", { name: "命运手记", exact: true })).toBeFocused();
    const controls = page.locator(".cosmic-summary-actions");
    const originalControls = (await controls.boundingBox())!;
    expect(originalControls.y).toBeGreaterThan(0);
    expect(originalControls.y + originalControls.height).toBeLessThan(720);
    const thumbnails = await page.locator(".cosmic-summary-cards button").evaluateAll((buttons) => buttons.map((button) => {
      const rect = button.getBoundingClientRect();
      return { x: rect.x, top: rect.top, right: rect.right, bottom: rect.bottom,
        hit: button.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)) };
    }));
    for (const thumbnail of thumbnails) {
      expect(thumbnail.x).toBeGreaterThan(0);
      expect(thumbnail.top).toBeGreaterThan(0);
      expect(thumbnail.right).toBeLessThan(1280);
      expect(thumbnail.bottom).toBeLessThan(720);
      expect(thumbnail.hit).toBe(true);
    }
    const body = page.getByRole("region", { name: "整体分析正文", exact: true });
    await expect(body).toContainText(question);
    await body.press("End");
    await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    const scrolledControls = (await controls.boundingBox())!;
    expect(scrolledControls.y).toBeCloseTo(originalControls.y, 0);
    if (count === 5) {
      await page.setViewportSize({ width: 1159, height: 668 });
      const overflow = await page.locator(".cosmic-summary-overview").evaluate((element) => element.scrollHeight - element.clientHeight);
      expect(overflow).toBeLessThanOrEqual(1);
    }
  });
}
