import { chromium } from "playwright-core";
import { markOpeningSeen } from "./career-fixture.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_EXE ||
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
  args: ["--disable-gpu", "--disable-background-timer-throttling"],
});
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 1,
});
const page = await ctx.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (e) => {
  if (e.type() === "error") console.log(e.text());
});
const url = process.env.SKI_URL || "http://127.0.0.1:4187";
const cdp = await ctx.newCDPSession(page);
await mkdir("release/store", { recursive: true });
await mkdir(".cache/frames", { recursive: true });
const touch = async (on) => {
  const r = await page.locator("#ride").boundingBox();
  await cdp.send("Input.dispatchTouchEvent", {
    type: on ? "touchStart" : "touchEnd",
    touchPoints: on ? [{ x: r.x + r.width / 2, y: r.y + r.height / 2 }] : [],
  });
};
async function until(check, limit = 7000) {
  for (let ms = 0; ms <= limit; ms += 64) {
    if (await check()) return;
    await page.clock.runFor(64);
  }
  throw Error(
    "Unexpected game state: " + (await page.locator("#app").innerText()),
  );
}
const waitText = (id, part) =>
  until(async () =>
    (await page.locator("#" + id).textContent()).includes(part),
  );
const angle = (n) =>
  until(() =>
    page.evaluate((n) => {
      const t = document.querySelector("#meter").textContent;
      return t.includes("空翻") && Number(t.match(/\d+/)?.[0]) >= n;
    }, n),
  );
try {
  const epoch = Date.now();
  await page.clock.install({ time: epoch });
  await markOpeningSeen(page);
  await page.goto(url);
  await page.waitForSelector("canvas");
  await waitText("action", "触碰出发");
  await page.waitForTimeout(350);
  await page.screenshot({ path: "release/store/首屏.png" });
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1500);
  await page.evaluate(() => {
    window.skiFrames = [];
    const miniature = document.createElement("canvas");
    miniature.width = 240;
    miniature.height = 400;
    window.captureId = setInterval(() => {
      const source = document.querySelector("#game canvas");
      miniature.getContext("2d").drawImage(source, 0, 0, 240, 400);
      window.skiFrames.push([
        miniature.toDataURL("image/jpeg", 0.83).split(",")[1],
        document.querySelector("#feedback").textContent ||
          document.querySelector("#action").textContent,
      ]);
    }, 140);
  });
  await touch(true);
  await angle(64);
  await touch(false);
  await waitText("action", "再来一跳");
  await page.screenshot({ path: "release/store/失误反馈.png" });
  const before = performance.now();
  await touch(true);
  await waitText("action", "准备空翻");
  const retry = Math.round(performance.now() - before);
  assert.ok(retry < 1000);
  await touch(false);
  await waitText("meter", "空翻");
  await touch(true);
  await angle(148);
  await touch(false);
  await waitText("feedback", "落地");
  await page.screenshot({ path: "release/store/落地.png" });
  const grade = await page.locator("#feedback").innerText();
  await page.clock.runFor(500);
  const frames = await page.evaluate(() => {
    clearInterval(window.captureId);
    return window.skiFrames;
  });
  await writeFile(".cache/frames/capture.json", JSON.stringify(frames));
  await page.locator("#menu").dispatchEvent("click");
  await page.getByRole("button", { name: "练习公园" }).dispatchEvent("click");
  await page.getByRole("button", { name: "转体中台" }).dispatchEvent("click");
  await touch(true);
  await until(() =>
    page.evaluate(() => {
      let m = document.querySelector("#meter").textContent;
      return m.includes("台沿") && parseFloat(m.replace(/[^0-9.]/g, "")) < 2.7;
    }),
  );
  await touch(false);
  await waitText("meter", "空翻");
  await touch(true);
  await angle(145);
  await touch(false);
  await waitText("panel", "练习完成");
  await page
    .getByRole("button", { name: "最佳一跳回看" })
    .dispatchEvent("click");
  await until(() => page.locator("dialog").evaluate((e) => e.open));
  await page.clock.resume();
  await page.reload();
  await waitText("action", "触碰出发");
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(500);
  assert.equal(
    await page.evaluate(() => document.body.scrollWidth > innerWidth),
    false,
  );
  const events = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("half-turn.ski.v1")).events.map(
      (e) => e.name,
    ),
  );
  for (const n of [
    "摔倒",
    "失误后重试",
    "成功落地",
    "手动起跳",
    "完赛",
    "回看",
  ])
    assert.ok(events.includes(n), n);
  assert.deepEqual(errors, []);
  const report = {
    browser: browser.version(),
    viewports: ["390×844", "320×568"],
    retryMs: retry,
    landing: grade,
    events,
    errors,
  };
  console.log(report);
  await writeFile("release/mobile-test.json", JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
