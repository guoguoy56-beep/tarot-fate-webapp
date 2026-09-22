import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

import { tarotCardMap, tarotCards } from "@/data/tarotCards";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const cardAssetsDirectory = path.join(projectRoot, "public", "cards", "rws");
const minorSuits = ["wands", "cups", "swords", "pentacles"];

function expectNonEmptyText(value: unknown) {
  expect(typeof value).toBe("string");
  expect((value as string).trim()).not.toBe("");
}

test("the deck contains 78 uniquely addressable cards", () => {
  const ids = tarotCards.map((card) => card.id);
  const images = tarotCards.map((card) => card.image);

  expect(tarotCards).toHaveLength(78);
  expect(new Set(ids).size).toBe(78);
  expect(new Set(images).size).toBe(78);
  expect(tarotCardMap.size).toBe(78);

  for (const card of tarotCards) {
    expect(tarotCardMap.get(card.id)).toBe(card);
  }
});

test("the deck contains the complete major and minor arcana", () => {
  const majorArcana = tarotCards.filter((card) => card.arcana === "major");
  const minorArcana = tarotCards.filter((card) => card.arcana === "minor");

  expect(majorArcana).toHaveLength(22);
  expect(minorArcana).toHaveLength(56);
  expect(majorArcana.map((card) => card.number).sort((left, right) => left - right)).toEqual(
    Array.from({ length: 22 }, (_, index) => index),
  );

  for (const card of majorArcana) {
    expect(card.suit).toBeNull();
  }

  for (const suit of minorSuits) {
    const suitedCards = minorArcana.filter((card) => card.suit === suit);
    expect(suitedCards).toHaveLength(14);
    expect(suitedCards.map((card) => card.number).sort((left, right) => left - right)).toEqual(
      Array.from({ length: 14 }, (_, index) => index + 1),
    );
  }
});

test("every card has the required names, meaning, and orientation keywords", () => {
  for (const card of tarotCards) {
    expectNonEmptyText(card.id);
    expectNonEmptyText(card.nameCn);
    expectNonEmptyText(card.nameEn);
    expectNonEmptyText(card.meaning);

    for (const keywords of [card.uprightKeywords, card.reversedKeywords]) {
      expect(keywords.length).toBeGreaterThan(0);
      for (const keyword of keywords) {
        expectNonEmptyText(keyword);
      }
    }
  }
});

test("every referenced Rider-Waite-Smith image exists and is a non-empty JPEG", async () => {
  const directoryEntries = await readdir(cardAssetsDirectory, { withFileTypes: true });
  const actualJpegNames = directoryEntries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".jpg"))
    .map((entry) => entry.name)
    .sort();
  const referencedJpegNames = tarotCards.map((card) => path.posix.basename(card.image)).sort();

  expect(actualJpegNames).toHaveLength(78);
  expect(actualJpegNames).toEqual(referencedJpegNames);

  for (const card of tarotCards) {
    expect(card.image).toMatch(/^\/cards\/rws\/[a-z0-9-]+\.jpg$/);

    const assetPath = path.join(projectRoot, "public", ...card.image.split("/").filter(Boolean));
    const assetStat = await stat(assetPath);
    const image = await readFile(assetPath);

    expect(assetStat.isFile()).toBe(true);
    expect(assetStat.size).toBeGreaterThanOrEqual(4);
    expect(image[0]).toBe(0xff);
    expect(image[1]).toBe(0xd8);
    expect(image.at(-2)).toBe(0xff);
    expect(image.at(-1)).toBe(0xd9);
  }
});
