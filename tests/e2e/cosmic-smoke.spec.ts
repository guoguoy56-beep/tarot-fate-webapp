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

test("cosmic ring preserves shuffled anchors through drag, reading and summary", async ({ page }) => {
  const errors: string[] = [];
  const apiCalls: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("request", (request) => { if (request.url().includes("/api/reading")) apiCalls.push(request.url()); });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "命运回廊", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "开始占卜", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("你想问星空什么？").fill("如何为接下来的学习找到方向？");
  await page.getByRole("button", { name: "开启星轨", exact: true }).click();
  await expect(page.getByTestId("cosmic-experience")).toHaveAttribute("data-stage", "draw");
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
  await pickFrontCard(page);
  await expect(page.getByTestId("cosmic-experience")).toHaveAttribute("data-stage", "reading");
  const chosen = (await snapshot()).filter((card) => card.selected === "true");
  await expect(page.locator(".cosmic-card.is-face-up img")).toBeVisible();
  await expect(page.getByText("示例解读", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "下一张", exact: true }).click();
  await expect(page.getByText("现在 · 第 2 / 3 张", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "上一张", exact: true }).click();
  await expect(page.getByText("过去 · 第 1 / 3 张", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "下一张", exact: true }).click();
  await page.getByRole("button", { name: "下一张", exact: true }).click();
  await expect(page.getByText("未来 · 第 3 / 3 张", { exact: true })).toBeVisible();
  expect((await snapshot()).filter((card) => card.selected === "true")).toEqual(chosen);
  await page.getByRole("button", { name: "查看整体解读", exact: true }).click();
  await expect(page.getByTestId("cosmic-experience")).toHaveAttribute("data-stage", "summarizing");
  await expect(page.getByRole("heading", { name: "命运手记", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "保存示例手记", exact: true }).click();
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
    for (let index = 1; index < count; index++) await page.getByRole("button", { name: "下一张", exact: true }).click();
    await page.getByRole("button", { name: "查看整体解读", exact: true }).click();
    await expect(page.getByRole("heading", { name: "命运手记", exact: true })).toBeVisible();
    await expect(page.locator(".cosmic-summary-cards button")).toHaveCount(count);
  });
}
