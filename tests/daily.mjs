import { chromium } from "playwright-core";
import { markOpeningSeen } from "./career-fixture.mjs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_EXE ||
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  args: ["--disable-gpu"],
});
try {
  const p = await browser.newPage({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
  });
  await p.clock.install();
  await markOpeningSeen(p);
  await p.goto(process.env.SKI_URL || "http://127.0.0.1:4187");
  await p.waitForSelector("canvas");
  await p.clock.pauseAt((await p.evaluate(() => Date.now())) + 60000);
  await p.clock.setSystemTime(new Date("2026-11-21T15:59:57Z"));
  const click = (name) =>
    p.getByRole("button", { name, exact: true }).dispatchEvent("click");
  const menu = () => p.locator("#menu").dispatchEvent("click");
  await menu();
  await click("每日表演赛");
  assert.match(await p.locator("#panel").innerText(), /2026-11-21/);
  await click("开始同题挑战");
  const original = await p.locator("#line").textContent();
  await p.keyboard.down("Space");
  await p.clock.runFor(500);
  await p.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      value: true,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const checkpoint = await p.locator("#meter").textContent();
  await p.clock.runFor(2000);
  assert.equal(await p.locator("#meter").textContent(), checkpoint);
  await p.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await p.clock.runFor(128);
  assert.equal(await p.locator("#feedback").textContent(), "2");
  assert.equal(await p.locator("#meter").textContent(), checkpoint);
  await p.clock.runFor(2100);
  await p.keyboard.up("Space");
  await p.clock.setSystemTime(new Date("2026-11-21T16:02:00Z"));
  assert.equal(await p.locator("#line").textContent(), original);
  await menu();
  await click("每日表演赛");
  assert.match(await p.locator("#panel").innerText(), /2026-11-22/);
  await click("开始同题挑战");
  assert.notEqual(await p.locator("#line").textContent(), original);
  await p.clock.resume();
  await p.goto(pathToFileURL(resolve("release/私测看板.html")).href);
  const now = Date.now() - 2 * 86400000,
    sample = {
      build: "0.9.0-rc.1",
      source: "preview",
      events: ["开局", "开始滑行", "摔倒", "失误后重试", "完赛"].map(
        (name, i) => ({ name, t: now + i * 100, value: "tour-0" }),
      ),
    };
  await p
    .locator("#files")
    .setInputFiles({
      name: "sample.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(sample)),
    });
  const row = p.locator("tr").filter({ hasText: "失误后主动重试" });
  await row.waitFor();
  assert.match(await row.innerText(), /100.0%/);
  const report = {
    beijingRollover: true,
    activeChallengeLocked: true,
    visibilityEventPause: true,
    countdown: true,
    offlineMetrics: true,
  };
  console.log(report);
  await writeFile("release/daily-test.json", JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
