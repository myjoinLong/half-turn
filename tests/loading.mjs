import { chromium } from "playwright-core";
import { markOpeningSeen } from "./career-fixture.mjs";
import { writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_EXE ||
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  args: ["--disable-gpu"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 40,
    downloadThroughput: 1250000,
    uploadThroughput: 1250000,
  });
  const results = [];
  await markOpeningSeen(page);
  for (const entry of ["cold", "warm"]) {
    if (entry === "cold") await cdp.send("Network.clearBrowserCache");
    await page.goto(process.env.SKI_URL || "http://127.0.0.1:4187");
    await page.waitForFunction(
      () =>
        document.querySelector("#game canvas")?.width > 100 &&
        document.querySelector("#action")?.textContent === "触碰出发",
    );
    results.push({
      entry,
      ...(await page.evaluate(() => ({
        readyMs: Math.round(performance.now()),
        resourceBytes: performance
          .getEntriesByType("resource")
          .reduce((sum, r) => sum + r.transferSize, 0),
      }))),
    });
  }
  await page.locator("#menu").click();
  await page.getByRole("button", { name: "滑行设置" }).click();
  await page.getByRole("switch", { name: "声音", checked: true }).click();
  const before = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("half-turn.ski.v1")),
  );
  assert.equal(before.sound, false);
  execFileSync("python", [
    "-m",
    "zipfile",
    "-e",
    "release/half-turn-local-fallback.zip",
    ".cache/rollback",
  ]);
  await page.route("**/*", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/" || /^\/assets\/[\w.-]+$/.test(path))
      await route.fulfill({
        path: resolve(
          ".cache/rollback",
          path === "/" ? "index.html" : path.slice(1),
        ),
      });
    else await route.continue();
  });
  await page.reload();
  await page.locator("#menu").click();
  await page.getByRole("button", { name: "滑行设置" }).click();
  assert.ok(
    await page
      .getByRole("button", { name: "声音 · 关", exact: true })
      .isVisible(),
  );
  const report = {
    browser: browser.version(),
    network: "10 Mbps / 40 ms latency, desktop emulation",
    results,
    rollbackReadCurrentSettings: true,
  };
  console.log(report);
  await writeFile("release/loading-test.json", JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
