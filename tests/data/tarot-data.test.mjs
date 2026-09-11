import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { tarotCardMap, tarotCards } from "../../src/data/tarotCards.ts";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const cardAssetsDirectory = path.join(projectRoot, "public", "cards", "rws");
const minorSuits = ["wands", "cups", "swords", "pentacles"];

function assertNonEmptyText(value, label) {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.notEqual(value.trim(), "", `${label} must not be empty`);
}

test("the deck contains 78 uniquely addressable cards", () => {
  const ids = tarotCards.map((card) => card.id);
  const images = tarotCards.map((card) => card.image);

  assert.equal(tarotCards.length, 78);
  assert.equal(new Set(ids).size, 78, "card IDs must be unique");
  assert.equal(new Set(images).size, 78, "card image paths must be unique");
  assert.equal(tarotCardMap.size, 78, "tarotCardMap must contain every card");

  for (const card of tarotCards) {
    assert.equal(tarotCardMap.get(card.id), card, `tarotCardMap must preserve ${card.id}`);
  }
});

test("the deck contains the complete major and minor arcana", () => {
  const majorArcana = tarotCards.filter((card) => card.arcana === "major");
  const minorArcana = tarotCards.filter((card) => card.arcana === "minor");

  assert.equal(majorArcana.length, 22);
  assert.equal(minorArcana.length, 56);
  assert.deepEqual(
    majorArcana.map((card) => card.number).sort((left, right) => left - right),
    Array.from({ length: 22 }, (_, index) => index),
    "major arcana numbers must cover 0 through 21",
  );

  for (const card of majorArcana) {
    assert.equal(card.suit, null, `${card.id} must not have a minor-arcana suit`);
  }

  for (const suit of minorSuits) {
    const suitedCards = minorArcana.filter((card) => card.suit === suit);
    assert.equal(suitedCards.length, 14, `${suit} must contain 14 cards`);
    assert.deepEqual(
      suitedCards.map((card) => card.number).sort((left, right) => left - right),
      Array.from({ length: 14 }, (_, index) => index + 1),
      `${suit} numbers must cover 1 through 14`,
    );
  }
});

test("every card has the required names, meaning, and orientation keywords", () => {
  for (const card of tarotCards) {
    assertNonEmptyText(card.id, "card.id");
    assertNonEmptyText(card.nameCn, `${card.id}.nameCn`);
    assertNonEmptyText(card.nameEn, `${card.id}.nameEn`);
    assertNonEmptyText(card.meaning, `${card.id}.meaning`);

    for (const [field, keywords] of [
      ["uprightKeywords", card.uprightKeywords],
      ["reversedKeywords", card.reversedKeywords],
    ]) {
      assert.ok(Array.isArray(keywords) && keywords.length > 0, `${card.id}.${field} must not be empty`);

      for (const [index, keyword] of keywords.entries()) {
        assertNonEmptyText(keyword, `${card.id}.${field}[${index}]`);
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

  assert.equal(actualJpegNames.length, 78, "the RWS asset directory must contain 78 JPEG files");
  assert.deepEqual(actualJpegNames, referencedJpegNames, "the JPEG files must exactly match the deck image paths");

  for (const card of tarotCards) {
    assert.match(card.image, /^\/cards\/rws\/[a-z0-9-]+\.jpg$/, `${card.id} has an invalid public image path`);

    const assetPath = path.join(projectRoot, "public", ...card.image.split("/").filter(Boolean));
    const assetStat = await stat(assetPath);
    const image = await readFile(assetPath);

    assert.ok(assetStat.isFile(), `${card.image} must resolve to a file`);
    assert.ok(assetStat.size >= 4, `${card.image} must not be empty`);
    assert.equal(image[0], 0xff, `${card.image} must start with a JPEG marker`);
    assert.equal(image[1], 0xd8, `${card.image} must start with a JPEG marker`);
    assert.equal(image.at(-2), 0xff, `${card.image} must end with a JPEG marker`);
    assert.equal(image.at(-1), 0xd9, `${card.image} must end with a JPEG marker`);
  }
});
