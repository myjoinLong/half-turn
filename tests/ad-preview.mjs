import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const url = "http://127.0.0.1:5197";
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "5197",
    "--strictPort",
  ],
  {
    windowsHide: true,
    stdio: "ignore",
    env: {
      ...process.env,
      VITE_HALF_TURN_TICKETS_AD: "local-test-tickets",
      VITE_HALF_TURN_AURORA_AD: "local-test-aurora",
    },
  },
);
let browser;
try {
  let ready = false;
  for (let n = 0; n < 180; n++) {
    if (server.exitCode !== null)
      throw Error("Development fixture server stopped");
    try {
      if ((await fetch(url)).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  assert.ok(ready);
  browser = await chromium.launch({
    executablePath:
      process.env.BROWSER_EXE ||
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    args: ["--disable-gpu"],
  });
  const p = await browser.newPage({
    viewport: { width: 812, height: 375 },
    hasTouch: true,
    isMobile: true,
  });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.addInitScript(() => {
    const key = "half-turn.ski.v1";
    if (!localStorage.getItem(key))
      localStorage.setItem(
        key,
        JSON.stringify({
          openingSeen: true,
          firstSeenAt: Date.now() - 61000,
          lite: true,
        }),
      );
    window.tap = {
      createRewardedVideoAd: ({ adUnitId }) => {
        let close, error;
        return {
          onClose: (f) => (close = f),
          onError: (f) => (error = f),
          load: async () => {},
          show: async () => {
            window.testAd = { adUnitId, close, error };
          },
          destroy: () => {
            window.testAd = null;
          },
        };
      },
    };
  });
  await p.goto(url, { timeout: 90000 });
  await p.waitForSelector("canvas");
  const button = (name) => p.getByRole("button", { name, exact: true }).click();
  const mountainMenu = async () => {
    await p.locator("#menu").click();
    await button("巡回赛 · 选山");
  };
  const show = async (name, unit) => {
    await button(name);
    await p.waitForFunction(() => !!window.testAd);
    assert.ok(await p.getByRole("dialog", { name: "激励视频" }).isVisible());
    assert.ok(await p.locator("#screen").isVisible());
    assert.equal(await p.evaluate(() => window.testAd.adUnitId), unit);
  };
  const save = () =>
    p.evaluate(() => JSON.parse(localStorage.getItem("half-turn.ski.v1")));
  const aurora = "看视频，用极光灯光滑一趟";
  const tickets = "看视频，再领 40 张雪票";
  const complete = () =>
    p.evaluate(() => {
      const callback = window.testAd.close;
      callback({ isEnded: true });
      callback({ isEnded: true });
    });
  await mountainMenu();
  assert.equal(await p.getByRole("button", { name: aurora }).count(), 0);
  await button("回到雪道");
  await p.keyboard.press("Space");
  await p
    .getByRole("heading", { name: "冲过终点" })
    .waitFor({ timeout: 120000 });
  const base = (await save()).tickets;
  assert.ok(base >= 20);
  await show(tickets, "local-test-tickets");
  await p.evaluate(() => window.testAd.error());
  await p.getByText("暂无可用视频，请稍后再试。", { exact: true }).waitFor();
  assert.equal((await save()).tickets, base);
  await show(tickets, "local-test-tickets");
  await complete();
  await p.getByText("已领取 40 张雪票", { exact: true }).waitFor();
  assert.equal((await save()).tickets, base + 40);
  assert.equal(await p.getByRole("button", { name: tickets }).count(), 0);
  await button("雪场菜单");
  await button("巡回赛 · 选山");
  await show(aurora, "local-test-aurora");
  await p.evaluate(() => window.testAd.close({ isEnded: false }));
  await p.getByText("视频已关闭。", { exact: true }).waitFor();
  assert.equal((await save()).passes, 0);
  await show(aurora, "local-test-aurora");
  await complete();
  await p.getByRole("heading", { name: "极光巡游" }).waitFor();
  assert.equal((await save()).passes, 1);
  await p.reload();
  await p.getByRole("heading", { name: "极光巡游" }).waitFor();
  assert.equal((await save()).passes, 1);
  assert.equal((await save()).tickets, base + 40);
  assert.equal((await save()).adDay.count, 2);
  assert.deepEqual(errors, []);
  const result = {
    fixture: "local development host",
    firstCourseAdFree: true,
    emptyAdReturnedToResult: true,
    earlyClose: true,
    duplicateComplete: true,
    auroraRestored: true,
    ticketBonusAfterReload: 40,
    totalClaims: 2,
    errors,
  };
  console.log(result);
  await writeFile(
    "release/ad-preview-test.json",
    JSON.stringify(result, null, 2),
  );
} finally {
  if (browser) await browser.close();
  server.kill();
}
