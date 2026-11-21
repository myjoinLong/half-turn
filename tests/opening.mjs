import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";

const url = process.env.SKI_URL || "http://127.0.0.1:4187";
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_EXE ||
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  args: ["--disable-gpu"],
});
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const input = await context.newCDPSession(page);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const text = (id) => page.locator("#" + id).textContent();
  const tap = async (held) => {
    const ride = await page.locator("#ride").boundingBox();
    await input.send("Input.dispatchTouchEvent", {
      type: held ? "touchStart" : "touchEnd",
      touchPoints: held
        ? [{ x: ride.x + ride.width / 2, y: ride.y + ride.height / 2 }]
        : [],
    });
  };
  async function waitFor(id, value) {
    for (let attempt = 0; attempt < 100; attempt++) {
      if ((await text(id)).includes(value)) return;
      await page.clock.runFor(64);
    }
    assert.fail(id + " expected " + value + ", got " + (await text(id)));
  }

  await page.clock.install();
  await page.goto(url);
  await page.waitForSelector("canvas");
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 60000);
  assert.equal(await text("line"), "极光大跳台");
  assert.equal(await text("action"), "按住起飞");
  await mkdir("release/store", { recursive: true });
  await page.screenshot({ path: "release/store/极光大跳台.png" });

  await tap(true);
  await page.clock.runFor(100);
  await tap(false);
  await waitFor("feedback", "再试一次");
  assert.equal(await text("score"), "0000");

  for (const [name, spin] of [
    ["Indy", 360],
    ["Tailgrab", 720],
  ]) {
    await tap(true);
    await waitFor("feedback", "现在松手");
    assert.match(await text("trick"), new RegExp(name));
    await page.screenshot({ path: "release/store/开场-" + name + ".png" });
    await tap(false);
    await waitFor("feedback", name + " " + spin + "°");
    assert.match(await text("hint"), /完美落地/);
    assert.equal(await text("trick"), "");
    await page.clock.runFor(1150);
  }
  assert.equal(
    await page.getByRole("heading", { name: "高光完成" }).count(),
    1,
  );
  await page
    .getByRole("button", { name: "从松林山起步" })
    .dispatchEvent("click");
  assert.equal(await text("line"), "初雪山脊");
  assert.equal(await text("score"), "0000");
  assert.match(await text("jump"), /转体入门/);
  const save = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("half-turn.ski.v1")),
  );
  assert.equal(save.openingSeen, true);
  assert.equal(save.tickets, 0);
  assert.deepEqual(save.records, {});
  await page.clock.resume();
  await page.reload();
  await page.waitForSelector("canvas");
  assert.equal(await text("line"), "初雪山脊");
  await page.locator("#menu").click();
  await page.getByRole("button", { name: "重玩开场表演" }).click();
  assert.equal(await text("line"), "极光大跳台");
  await page.setViewportSize({ width: 320, height: 568 });
  await page.locator("#menu").click();
  await page.getByRole("button", { name: "从松林山起步" }).click();
  assert.equal(await text("line"), "初雪山脊");
  assert.deepEqual(errors, []);

  const report = {
    browser: browser.version(),
    viewport: "390×844",
    narrow: "320×568",
    failedTapThenRetry: true,
    landed: ["Indy 360°", "Tailgrab 720°"],
    careerScore: 0,
    persisted: true,
    replayAndSkip: true,
    errors,
  };
  await writeFile("release/opening-test.json", JSON.stringify(report, null, 2));
  console.log(report);
} finally {
  await browser.close();
}
