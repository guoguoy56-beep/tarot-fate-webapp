import { expect, test, type Page } from "@playwright/test";

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
    const frames: Array<{ time: number; x: number; y: number; width: number; height: number; flip: number; yaw: number; pitch: number; rotation: number; topBottom: number; leftRight: number }> = [];
    const start = performance.now();
    let first = 0;
    await new Promise<void>((resolve) => {
      const record = (now: number) => {
        const card = document.querySelector<HTMLElement>('.cosmic-card.is-face-up');
        if (card && card.dataset.anchor !== previous && (!frames.length || now - first - frames.at(-1)!.time >= 30)) {
          if (!frames.length) first = now;
          const rect = card.getBoundingClientRect();
          const flipper = card.querySelector('.cosmic-card-flipper')!;
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
          frames.push({ time: now - first, x: rect.x, y: rect.y, width: rect.width, height: rect.height,
            flip: Math.atan2(flip.m31, flip.m11) * 180 / Math.PI,
            yaw: Math.atan2(tilt.m31, tilt.m11) * 180 / Math.PI,
            pitch: Math.atan2(-tilt.m32, tilt.m22) * 180 / Math.PI,
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

function expectEaseOutArrival(frames: Awaited<ReturnType<typeof samplePresentation>>) {
  const at = (time: number) => frames.reduce((closest, frame) => Math.abs(frame.time - time) < Math.abs(closest.time - time) ? frame : closest);
  const first = frames[0], last = frames.at(-1)!;
  const progress = (frame: typeof first) => (frame.rotation - first.rotation) / (last.rotation - first.rotation);
  // Both the ring and the flip cover most of their travel early, then settle slowly together.
  expect(progress(at(400))).toBeGreaterThan(0.5);
  expect(Math.abs(at(400).flip) / 180).toBeGreaterThan(0.5);
  expect(progress(at(600)) - progress(at(200))).toBeGreaterThan((progress(at(1400)) - progress(at(1000))) * 3);
  for (const frame of frames.filter((item) => item.time >= 200 && item.time <= 1400)) {
    expect(Math.abs(progress(frame) - Math.abs(frame.flip) / 180)).toBeLessThan(0.08);
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
  await expect(page.getByTestId("cosmic-experience")).toHaveAttribute("data-stage", "reading");
  await expect(navigation).toHaveCount(0);
  const chosen = (await snapshot()).filter((card) => card.selected === "true");
  const settled = arrival.at(-1)!;
  expect(arrival.some((frame) => frame.time > 300 && frame.time < 850 && frame.flip > 5 && frame.flip < 175
    && Math.hypot(frame.x - settled.x, frame.y - settled.y, frame.width - settled.width) > 5)).toBe(true);
  expect(Math.abs(settled.flip)).toBeCloseTo(180, 1);
  expectEaseOutArrival(arrival);
  const idle = await samplePresentation(page, 10_200);
  expect(idle.length).toBeGreaterThan(100);
  for (const dimension of ["x", "y", "width", "height"] as const) {
    expect(Math.max(...idle.map((frame) => frame[dimension])) - Math.min(...idle.map((frame) => frame[dimension]))).toBeLessThan(0.1);
  }
  expect(Math.min(...idle.map((frame) => frame.yaw))).toBeLessThan(-20);
  expect(Math.max(...idle.map((frame) => frame.yaw))).toBeGreaterThan(20);
  expect(Math.max(...idle.map((frame) => frame.pitch))).toBeGreaterThan(23);
  const facing = idle.filter((frame) => Math.abs(Math.abs(frame.flip) - 180) < 0.01);
  // Projected edges must change in the actual viewport, not just in an internal rotation matrix.
  expect(Math.min(...facing.map((frame) => frame.topBottom))).toBeLessThan(0.94);
  expect(Math.min(...facing.map((frame) => frame.leftRight))).toBeLessThan(0.98);
  expect(Math.max(...facing.map((frame) => frame.leftRight))).toBeGreaterThan(1.02);
  let fullTurn = 0;
  for (let index = 1; index < idle.length; index++) {
    const delta = (idle[index].flip - idle[index - 1].flip) * Math.PI / 180;
    fullTurn += Math.atan2(Math.sin(delta), Math.cos(delta)) * 180 / Math.PI;
  }
  expect(fullTurn).toBeCloseTo(360, 0);
  expect((await snapshot()).filter((card) => card.selected === "true")).toEqual(chosen);
  await expect(page.locator(".cosmic-card.is-face-up img")).toBeVisible();
  await expect(page.getByText("示例解读", { exact: true })).toBeVisible();
  const previousAnchor = await page.locator('.cosmic-card.is-face-up').getAttribute("data-anchor");
  const [nextArrival] = await Promise.all([
    samplePresentation(page, 2300, previousAnchor),
    page.getByRole("button", { name: "下一张", exact: true }).click(),
  ]);
  const nextSettled = nextArrival.at(-1)!;
  expect(nextArrival.some((frame) => frame.time > 300 && frame.time < 850 && frame.flip > 5 && frame.flip < 175
    && Math.hypot(frame.x - nextSettled.x, frame.y - nextSettled.y, frame.width - nextSettled.width) > 5)).toBe(true);
  expect(Math.abs(nextSettled.flip)).toBeCloseTo(180, 1);
  expectEaseOutArrival(nextArrival);
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

for (const [name, count] of [["单牌", 1], ["是非牌", 1], ["三牌阵", 3], ["十字牌阵", 5], ["恋人十字牌阵", 5], ["暗恋牌阵", 4], ["心之声", 4]] as const) {
  test(`${name} completes at ${count} cards with manual review`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.getByRole("button", { name: "开始占卜", exact: true }).click();
    await page.getByRole("button", { name: `${name} ${count} 张`, exact: true }).click();
    await page.getByLabel("你想问星空什么？").fill("我该如何理解此刻的感受？");
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
  });
}
