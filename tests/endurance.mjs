import { chromium } from "playwright-core";
import { markOpeningSeen } from "./career-fixture.mjs";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_EXE ||
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  args: [
    "--disable-gpu",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
  ],
});
try {
  const p = await browser.newPage({
    viewport: { width: 740, height: 360 },
    isMobile: true,
    hasTouch: true,
  });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await markOpeningSeen(p);
  await p.goto(process.env.SKI_URL || "http://127.0.0.1:4187");
  await p.waitForSelector("canvas");
  await p.evaluate(() => {
    let held = false,
      previous = performance.now();
    window.res = {
      finishes: 0,
      frames: 0,
      slowFrames: 0,
      jumpActions: 0,
      lastProgress: Date.now(),
    };
    const key = (on) => {
      if (on !== held) {
        held = on;
        window.dispatchEvent(
          new KeyboardEvent(on ? "keydown" : "keyup", {
            code: "Space",
            bubbles: true,
          }),
        );
        if (on) window.res.jumpActions++;
      }
    };
    function ride(ts) {
      const stats = window.res;
      stats.frames++;
      if (ts - previous > 50) stats.slowFrames++;
      previous = ts;
      const screen = document.querySelector("#screen");
      if (!screen.hidden) {
        key(false);
        const again = [...screen.querySelectorAll("button")].find(
          (b) => b.textContent === "再滑一趟",
        );
        if (again) {
          stats.finishes++;
          stats.lastProgress = Date.now();
          again.click();
        }
      } else {
        const action = document.querySelector("#action").textContent,
          meter = document.querySelector("#meter").textContent;
        if (action === "触碰出发" || action.includes("撑地起身")) key(true);
        else if (meter.includes("离跳台"))
          key(parseFloat(meter.replace(/[^0-9.]/g, "")) > 1.8);
        else if (meter.includes("转体"))
          key(parseInt(meter.replace(/[^0-9]/g, "")) < 146);
        else key(false);
      }
      requestAnimationFrame(ride);
    }
    requestAnimationFrame(ride);
  });
  const start = Date.now(),
    samples = [];
  while (Date.now() - start < 1200000) {
    await new Promise((r) =>
      setTimeout(
        r,
        Math.min(60000, Math.max(10, 1200000 - (Date.now() - start))),
      ),
    );
    const sample = await p.evaluate(() => ({
      ...window.res,
      heapBytes: performance.memory?.usedJSHeapSize,
    }));
    samples.push({ ...sample, elapsedMs: Date.now() - start });
    console.log(
      Math.round((Date.now() - start) / 1000) +
        "s, completed " +
        sample.finishes +
        " runs",
    );
    assert.ok(
      Date.now() - sample.lastProgress < 180000,
      "No course finish for 3 minutes",
    );
  }
  assert.deepEqual(errors, []);
  assert.ok(samples.at(-1).finishes > 10);
  await writeFile(
    "release/endurance-test.json",
    JSON.stringify(
      {
        browser: browser.version(),
        wallTimeMs: Date.now() - start,
        errors,
        samples,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
