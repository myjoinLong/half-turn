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
    viewport: { width: 375, height: 812 },
    hasTouch: true,
    isMobile: true,
  });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.addInitScript(() => {
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
  const open = async () => {
    await p.locator("#menu").click();
    await button("巡回赛 · 选山");
    await button("看视频，用极光灯光滑一趟");
    await p.waitForFunction(() => !!window.testAd);
  };
  const save = () =>
    p.evaluate(() => JSON.parse(localStorage.getItem("half-turn.ski.v1")));
  await open();
  await p.evaluate(() => window.testAd.close({ isEnded: false }));
  await p.getByText("视频已关闭。", { exact: true }).waitFor();
  assert.equal((await save()).passes, 0);
  await button("看视频，用极光灯光滑一趟");
  await p.waitForFunction(() => !!window.testAd);
  await p.evaluate(() => {
    const a = window.testAd;
    a.close({ isEnded: true });
    a.close({ isEnded: true });
  });
  await p.getByRole("heading", { name: "极光巡游" }).waitFor();
  assert.equal((await save()).passes, 1);
  await p.reload();
  await p.getByRole("heading", { name: "极光巡游" }).waitFor();
  assert.equal((await save()).passes, 1);
  await p.locator("#menu").click();
  await button("练习公园");
  await button("落地小台");
  await p.keyboard.press("Space");
  await p
    .getByRole("heading", { name: "练习完成" })
    .waitFor({ timeout: 30000 });
  await button("赛后衣柜");
  await button("看视频，再领 40 张雪票");
  await p.waitForFunction(() => !!window.testAd);
  await p.evaluate(() => {
    const a = window.testAd;
    a.close({ isEnded: true });
    a.close({ isEnded: true });
  });
  await p.getByText("已领取 40 张雪票", { exact: true }).waitFor();
  assert.equal((await save()).tickets, 40);
  await p.reload();
  assert.equal((await save()).tickets, 40);
  assert.deepEqual(errors, []);
  const result = {
    fixture: "local development host",
    earlyClose: true,
    duplicateComplete: true,
    auroraRestored: true,
    ticketsAfterReload: 40,
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
