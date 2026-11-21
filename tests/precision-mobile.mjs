import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_EXE ||
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  args: [
    "--disable-gpu",
    "--disable-renderer-backgrounding",
    "--disable-background-timer-throttling",
  ],
});
const url = process.env.SKI_URL || "http://127.0.0.1:4187";
const errors = [],
  results = [];
await mkdir("release/store", { recursive: true });
try {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ]) {
    const context = await browser.newContext({
      viewport,
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    const cdp = await context.newCDPSession(page);
    await page.goto(url, { timeout: 60000 });
    await page.waitForSelector("canvas");
    const ride = page.locator("#ride");
    const buttonNames = ["boost", "brake", "grab-toggle", "ride"];
    const buttons = {};
    for (const id of buttonNames) {
      const rect = await page.locator("#" + id).boundingBox();
      assert.ok(rect.width >= 44 && rect.height >= 44, id);
      assert.ok(
        rect.x >= 0 &&
          rect.y >= 0 &&
          rect.x + rect.width <= viewport.width &&
          rect.y + rect.height <= viewport.height,
        id,
      );
      buttons[id] = [rect.width, rect.height];
    }
    const before = await ride.boundingBox();
    await page.locator("#grab-toggle").tap();
    assert.equal(
      await page.locator("#grab-toggle").getAttribute("aria-expanded"),
      "true",
    );
    assert.equal(await page.locator("#grab-choices button").count(), 6);
    assert.deepEqual(await ride.boundingBox(), before);
    await page
      .getByRole("button", { name: "抓板头 · 前手抓板头", exact: true })
      .tap();
    assert.equal(
      await page.locator("#grab-toggle").getAttribute("aria-expanded"),
      "false",
    );
    assert.equal(
      await page.evaluate(
        () =>
          document.body.scrollWidth > innerWidth ||
          document.body.scrollHeight > innerHeight,
      ),
      false,
    );
    const x = before.x + before.width * 0.59,
      y = before.y + before.height * 0.53;
    const send = (type, dx = 0, dy = 0) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints:
          type === "touchEnd" || type === "touchCancel"
            ? []
            : [{ x: x + dx, y: y + dy }],
      });
    const speed = async () =>
      parseInt(await page.locator("#speed").textContent(), 10);
    async function wait(what, check, limit = 5000) {
      const start = Date.now();
      do {
        if (await check()) return;
        await page.waitForTimeout(90);
      } while (Date.now() - start < limit);
      throw Error(what + " " + (await page.locator("#app").innerText()));
    }
    if (viewport.width === 390)
      await page.screenshot({ path: "release/store/精修-单手操控.png" });
    const base = await speed();
    await send("touchStart");
    await send("touchMove", 0, -38);
    await wait("上滑冲刺", async () => (await speed()) >= base + 10);
    const boosted = await speed();
    await send("touchMove", -24, 27);
    await wait(
      "拇指压刃",
      async () =>
        (await page.locator("#brake").getAttribute("aria-pressed")) === "true",
    );
    await wait("压刃减速", async () => (await speed()) < base - 2);
    const braked = await speed();
    await send("touchCancel");
    await wait(
      "触摸取消后松开压刃",
      async () =>
        (await page.locator("#brake").getAttribute("aria-pressed")) === "false",
    );
    await send("touchStart");
    await wait(
      "空中选定抓板",
      async () =>
        (await page.locator("#trick").textContent()).startsWith("抓板头"),
      9500,
    );
    await send("touchMove", 43, 0);
    await wait("空中横滑换抓板", async () =>
      (await page.locator("#trick").textContent()).startsWith("抓板尾"),
    );
    await wait("提示松手", async () =>
      (await page.locator("#feedback").textContent()).includes("现在松手"),
    );
    if (viewport.width === 390)
      await page.screenshot({ path: "release/store/精修-雪板抓握.png" });
    await send("touchEnd");
    await wait("完美落地", async () =>
      (await page.locator("#hint").textContent()).includes("完美落地"),
    );
    if (viewport.width === 390) {
      await page.locator("#menu").tap();
      await page
        .getByRole("button", { name: "从松林山起步", exact: true })
        .tap();
      await page.locator("#menu").tap();
      await page.getByRole("button", { name: "衣柜与收藏", exact: true }).tap();
      const bounds = await page
        .locator(".outfit-preview")
        .evaluate((canvas) => {
          const alpha = canvas
            .getContext("2d")
            .getImageData(0, 0, canvas.width, canvas.height).data;
          let top = canvas.height,
            bottom = -1;
          for (let index = 3; index < alpha.length; index += 4)
            if (alpha[index] > 32) {
              const y = Math.floor((index - 3) / 4 / canvas.width);
              top = Math.min(top, y);
              bottom = Math.max(bottom, y);
            }
          return { top, bottom, height: canvas.height };
        });
      assert.ok(
        bounds.top >= 6 &&
          bounds.bottom < bounds.height - 5 &&
          bounds.bottom - bounds.top > 80,
        JSON.stringify(bounds),
      );
      await page.screenshot({ path: "release/store/精修-角色与装备.png" });
    }
    results.push({
      viewport,
      buttons,
      base,
      boosted,
      braked,
      stableControls: true,
      gestureLanding: true,
    });
    await context.close();
  }
  assert.deepEqual(errors, []);
  const report = { browser: browser.version(), results, errors };
  await writeFile(
    "release/精修手机触控回归.json",
    JSON.stringify(report, null, 2),
  );
  console.log(report);
} finally {
  await browser.close();
}
