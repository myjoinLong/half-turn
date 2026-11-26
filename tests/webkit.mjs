import { webkit } from "playwright-core";
import { markOpeningSeen } from "./career-fixture.mjs";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const browser = await webkit.launch();
try {
  const p = await browser.newPage({
    viewport: { width: 667, height: 375 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("requestfailed", (r) =>
    console.log("request failure", r.url(), r.failure()?.errorText),
  );
  p.on("response", (r) => console.log(r.status(), new URL(r.url()).pathname));
  await markOpeningSeen(p);
  await p.goto(process.env.SKI_URL || "http://127.0.0.1:4187", {
    waitUntil: "commit",
    timeout: 65000,
  });
  await p.waitForSelector("#game canvas", { timeout: 60000 });
  await p.locator("#menu").tap();
  await p.getByRole("button", { name: "练习公园" }).tap();
  await p.getByRole("button", { name: "落地小台" }).tap();
  const box = await p.locator("#game canvas").boundingBox();
  await p.touchscreen.tap(box.x + box.width * 0.4, box.y + box.height * 0.6);
  await p
    .getByRole("heading", { name: "练习完成" })
    .waitFor({ timeout: 30000 });
  await p.getByRole("button", { name: "最佳一跳回看" }).tap();
  await p
    .getByRole("heading", { name: "练习完成" })
    .waitFor({ timeout: 30000 });
  assert.deepEqual(errors, []);
  const report = {
    engine: browser.version(),
    platform: "Windows WebKit",
    viewport: "667×375 @2x",
    canvasTouch: true,
    finish: true,
    replay: true,
    errors,
  };
  console.log(report);
  await writeFile("release/webkit-test.json", JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
