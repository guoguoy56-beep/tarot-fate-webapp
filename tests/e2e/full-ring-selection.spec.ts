import { expect, test, type Page } from "@playwright/test";

async function exposedCards(page: Page) {
  return page.locator('.cosmic-card:not([disabled])').evaluateAll((cards) => cards.flatMap((card) => {
    const box = card.getBoundingClientRect();
    const fractions = [0.04, 0.12, 0.22, 0.34, 0.5, 0.66, 0.78, 0.88, 0.96];
    for (const fy of fractions) {
      for (const fx of fractions) {
        const x = box.left + box.width * fx;
        const y = box.top + box.height * fy;
        if (card.contains(document.elementFromPoint(x, y))) {
          return [{ anchor: card.getAttribute("data-anchor")!, x, y, cx: box.left + box.width / 2, cy: box.top + box.height / 2 }];
        }
      }
    }
    return [];
  }));
}

for (const scenario of [{ width: 1920, height: 1080, turn: 0 }, { width: 1280, height: 720, turn: 0 }, { width: 1280, height: 720, turn: 1.8 }]) {
  const viewport = { width: scenario.width, height: scenario.height };
  test(`every orbital card is physically clickable at ${viewport.width}x${viewport.height}${scenario.turn ? " after dragging and adjacent selections" : ""}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.getByRole("button", { name: "开始占卜", exact: true }).click();
    await page.getByRole("button", { name: "十字牌阵 5 张", exact: true }).click();
    await page.getByLabel("你想问星空什么？").fill("接下来我应该关注什么？");
    await page.getByRole("button", { name: "开启星轨", exact: true }).click();
    await expect(page.getByTestId("cosmic-experience")).toHaveAttribute("data-stage", "draw");
    // Each card needs an actually exposed hit point, rather than just an enabled DOM button.
    await expect.poll(async () => (await exposedCards(page)).length).toBe(78);
    if (scenario.turn) {
      const cx = viewport.width * 0.5;
      const cy = viewport.height * 0.6;
      // Follow actual projected anchors: a perspective orbit's screen angle is not its world angle.
      const orbit = await page.locator('.cosmic-card').evaluateAll((cards) => cards.map((card) => {
        const rect = card.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      }));
      await page.mouse.move(orbit[0].x, orbit[0].y);
      await page.mouse.down();
      for (let step = 1; step <= 22; step++) {
        await page.mouse.move(orbit[step].x, orbit[step].y);
      }
      // Finish with a slow final pixel so a frame between release and the center click cannot fling the ring.
      await page.mouse.move(orbit[22].x + 1, orbit[22].y);
      await page.mouse.up();
      // In reduced-motion mode there is no release inertia; an empty-center click must not select a card.
      await page.mouse.click(cx, cy);
      await expect(page.locator('.cosmic-card[data-selected="true"]')).toHaveCount(0);
      expect(Number(await page.getByTestId("cosmic-scene").getAttribute("data-rotation"))).toBeCloseTo(1.4, 1);
      await expect.poll(async () => (await exposedCards(page)).length).toBe(78);
    }
    const facts = () => page.locator(".cosmic-card").evaluateAll((cards) => cards.map((card) => ({
      anchor: card.getAttribute("data-anchor"), id: card.getAttribute("data-card-id"), orientation: card.getAttribute("data-orientation"),
    })));
    const before = await facts();
    const chosen: string[] = [];
    const regions = scenario.turn ? ["0", "1", "2", "77", "back"] : ["back", "left", "right", "front", "back"];
    for (const region of regions) {
      const visible = await exposedCards(page);
      expect(visible).toHaveLength(78 - chosen.length);
      const target = /^\d+$/.test(region) ? visible.find((card) => card.anchor === region)! : visible.sort((a, b) => region === "back" ? a.cy - b.cy : region === "front" ? b.cy - a.cy : region === "left" ? a.cx - b.cx : b.cx - a.cx)[0];
      expect(target, `card in region ${region} must have a real hit point`).toBeTruthy();
      if (region === "back") expect(target.cy).toBeLessThan(viewport.height * 0.5);
      if (region === "front") expect(target.cy).toBeGreaterThan(viewport.height * 0.7);
      await page.mouse.click(target.x, target.y);
      chosen.push(target.anchor);
      await expect(page.getByTestId(`orbit-card-${target.anchor}`)).toHaveAttribute("data-selected", "true");
      await expect(page.getByTestId(`orbit-card-${target.anchor}`).locator(".cosmic-card-marker")).toHaveText(String(chosen.length));
      await expect(page.locator('.cosmic-card[data-selected="true"]')).toHaveCount(chosen.length);
      expect(await facts()).toEqual(before);
    }
    expect(new Set(chosen).size).toBe(5);
    await expect(page.getByTestId("cosmic-experience")).toHaveAttribute("data-stage", "reading");
    expect(errors).toEqual([]);
  });
}
