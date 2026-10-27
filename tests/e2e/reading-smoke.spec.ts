import { expect, test, type Page } from "@playwright/test";

import type { ReadingRecord, ReadingRequest } from "../../src/types/reading";
import { createReadingRequest, createReadingResponse } from "../fixtures/reading";

const question = createReadingRequest().question;
const reading = createReadingResponse();

async function dragCardToPosition(page: Page, title: string, remaining: number) {
  const cards = page.locator(".cursor-grab");
  await expect(cards).toHaveCount(remaining);
  await cards.last().hover();
  const source = await cards.last().boundingBox();
  const target = await page.getByText(title, { exact: true }).locator("..").locator("..").boundingBox();
  if (!source || !target) {
    throw new Error(`Missing card or ${title} drop target`);
  }

  const x = source.x + source.width / 2;
  const y = source.y + source.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 10, y - 10, { steps: 3 });
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 24 });
  await page.mouse.up();
  await expect(cards).toHaveCount(remaining === 76 ? 0 : remaining - 1);
}

test("question, shuffle, draw, reveal, journal, save and reload history", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const externalRequests: string[] = [];
  const submittedReadings: ReadingRequest[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.route("**/*", async (route) => {
    if (new URL(route.request().url()).origin !== "http://127.0.0.1:3000") {
      externalRequests.push(route.request().url());
      await route.abort();
      return;
    }
    await route.continue();
  });
  await page.route("**/api/reading", async (route) => {
    expect(route.request().method()).toBe("POST");
    submittedReadings.push(route.request().postDataJSON() as ReadingRequest);
    await route.fulfill({ status: 200, json: reading });
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "命运之牌", exact: true })).toBeVisible();
  const questionStage = page.locator("section").filter({
    has: page.getByRole("heading", { name: "命运之牌", exact: true }),
  });
  await expect(questionStage).toHaveCSS("filter", "blur(0px)");
  await page.getByRole("textbox").fill(question);
  await page.screenshot({ path: "output/playwright/reference/home.png" });
  await page.getByRole("button", { name: "开始仪式", exact: true }).click();

  const finishShuffle = page.getByRole("button", { name: "命运已乱，开始抽牌", exact: true });
  await expect(finishShuffle).toBeVisible();
  await page.mouse.move(960, 540);
  await page.mouse.move(820, 500, { steps: 10 });
  await page.mouse.move(1080, 560, { steps: 14 });
  await finishShuffle.click();

  await dragCardToPosition(page, "过去", 78);
  await dragCardToPosition(page, "现在", 77);
  await dragCardToPosition(page, "未来", 76);
  await expect(page.getByText(reading.past, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "继续揭示下一张", exact: true }).click();
  await expect(page.getByText(reading.present, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "继续揭示下一张", exact: true }).click();
  await expect(page.getByText(reading.future, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "进入命运手记", exact: true }).click();

  await expect(page.getByRole("button", { name: "保存", exact: true, includeHidden: true })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "命运手记", exact: true })).toBeVisible();
  const journalStage = page.locator("section").filter({
    has: page.getByRole("heading", { name: "命运手记", exact: true }),
  });
  await expect(journalStage).toHaveCSS("transform", "none");
  await expect(page.locator('img[src^="/cards/rws/"]')).toHaveCount(3);
  await expect.poll(() => page.locator('img[src^="/cards/rws/"]').evaluateAll(
    (images) => images.every((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0),
  )).toBe(true);
  await expect(page.getByText(`你的问题：${question}`, { exact: true })).toBeVisible();
  await expect(page.getByText(`女巫的箴言：${reading.summary}`, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("已保存 1 条历史记录", { exact: true })).toBeVisible();
  await page.screenshot({ path: "output/playwright/reference/journal.png" });

  expect(submittedReadings).toHaveLength(1);
  const submitted = submittedReadings[0];
  expect(submitted).toEqual({
    question,
    cards: ["past", "present", "future"].map((position) => ({
      cardId: expect.any(String),
      position,
      orientation: expect.stringMatching(/^(upright|reversed)$/),
    })),
  });
  expect(new Set(submitted.cards.map((card) => card.cardId)).size).toBe(3);
  const records: ReadingRecord[] = await page.evaluate(() => JSON.parse(
    localStorage.getItem("tarot_reading_records") ?? "[]",
  ));
  expect(records).toEqual([{
    id: expect.any(String),
    createdAt: expect.any(String),
    question,
    spread: submitted.cards.map((card) => ({ ...card, interpretation: reading[card.position] })),
    summary: reading.summary,
  }]);

  await page.reload();
  await expect(page.getByText("已保存 1 条命运手记", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "历史记录", exact: true }).click();
  await expect(page.getByRole("heading", { name: "历史记录", exact: true })).toBeVisible();
  await expect(page.getByText(question, { exact: true })).toBeVisible();
  await expect(page.getByText(reading.summary, { exact: true })).toBeVisible();
  await expect(page.getByText("3 张牌", { exact: true })).toBeVisible();
  expect(submittedReadings).toHaveLength(1);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(externalRequests).toEqual([]);
});
