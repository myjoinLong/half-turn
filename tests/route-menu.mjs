import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";
import { markOpeningSeen } from "./career-fixture.mjs";

const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_EXE ||
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  args: ["--disable-gpu"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await markOpeningSeen(page);
  await page.goto(process.env.SKI_URL || "http://127.0.0.1:4187");
  await page.waitForSelector("canvas");
  const click = (name) =>
    page.getByRole("button", { name, exact: true }).dispatchEvent("click");
  const routes = [];
  for (const mountain of ["松林山", "峡谷山", "夜光山"]) {
    for (let index = 0; index < 5; index++) {
      await page.locator("#menu").dispatchEvent("click");
      await click("巡回赛 · 选山");
      await click(mountain);
      const entry = page.locator(".route-list button").nth(index);
      const label = (await entry.textContent()).trim();
      const match = label.match(/^(.+?)\s+(\d+) 米$/);
      assert.ok(match, label);
      await entry.dispatchEvent("click");
      assert.equal(await page.locator("#line").textContent(), match[1]);
      await page.keyboard.press("Space");
      await page.waitForFunction(
        () => parseInt(document.querySelector("#progress").textContent) > 2,
      );
      routes.push({ mountain, name: match[1], distance: Number(match[2]) });
    }
  }
  assert.equal(routes.length, 15);
  assert.deepEqual(errors, []);
  const report = { browser: browser.version(), launchAndSlide: routes, errors };
  await writeFile(
    "release/立体雪道选关回归.json",
    JSON.stringify(report, null, 2),
  );
  console.log("全部十五条巡回线路可从界面进入并开始滑行。");
} finally {
  await browser.close();
}
