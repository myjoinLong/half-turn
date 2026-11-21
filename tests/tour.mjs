import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_EXE ||
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  args: ["--disable-gpu"],
});
const p = await browser.newPage({
  viewport: { width: 360, height: 740 },
  isMobile: true,
  hasTouch: true,
});
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
const data = () =>
  p.evaluate(() => JSON.parse(localStorage.getItem("half-turn.ski.v1")));
const label = async (id) => (await p.locator("#" + id).textContent()) || "";
const click = (name) =>
  p.getByRole("button", { name, exact: true }).dispatchEvent("click");
async function waitFor(check, limit = 15000) {
  for (let i = 0; i < limit; i += 64) {
    if (await check()) return;
    await p.clock.runFor(64);
  }
  throw Error(await p.locator("#app").innerText());
}
try {
  await p.addInitScript(() => {
    if (!localStorage.getItem("half-turn.ski.v1"))
      localStorage.setItem(
        "half-turn.ski.v1",
        JSON.stringify({ version: 0, tickets: 40 }),
      );
  });
  await p.clock.install();
  await p.goto(process.env.SKI_URL || "http://127.0.0.1:4187");
  await p.waitForSelector("canvas");
  await p.clock.pauseAt((await p.evaluate(() => Date.now())) + 60000);
  for (let n = 0; n < 4; n++) {
    await p.keyboard.down("Space");
    await waitFor(async () => {
      const m = await label("meter");
      return m.includes("台沿") && parseFloat(m.replace(/[^0-9.]/g, "")) < 1.6;
    });
    await p.keyboard.up("Space");
    await waitFor(async () => (await label("meter")).includes("空翻"));
    await p.keyboard.down("Space");
    await waitFor(
      async () =>
        parseInt((await label("meter")).replace(/[^0-9]/g, "")) >= 146,
    );
    await p.keyboard.up("Space");
    await waitFor(async () => (await label("feedback")).includes("落地"));
    await waitFor(async () =>
      n < 3
        ? (await label("jump")).includes("0" + (n + 2) + " /")
        : await p.locator("dialog").evaluate((d) => d.open),
    );
  }
  const s = await data();
  assert.ok(s.records["tour-0"].score >= 250);
  assert.equal(s.tickets, 100);
  assert.ok(s.medals["tour-0"] >= 1);
  await click("赛后衣柜");
  await click("海盐 · 试穿");
  await click("100 雪票 · 收藏 海盐");
  assert.equal((await data()).tickets, 0);
  assert.equal((await data()).wear[0], 1);
  await click("看视频，再领 40 张雪票");
  await waitFor(async () => (await label("panel")).includes("暂无可用视频"));
  assert.equal((await data()).tickets, 0);
  await p.clock.resume();
  await p.reload();
  const after = await data();
  assert.equal(after.wear[0], 1);
  assert.deepEqual(after.records, s.records);
  assert.deepEqual(errors, []);
  const report = {
    browser: browser.version(),
    route: "初雪山脊",
    total: s.records["tour-0"].score,
    jumps: s.records["tour-0"].clips.length,
    medal: s.medals["tour-0"],
    ticketsBefore: 40,
    ticketsAfterRace: s.tickets,
    ticketsAfterPurchase: after.tickets,
    upgrade: true,
    noFill: true,
    reload: true,
    errors,
  };
  console.log(report);
  await writeFile("release/tour-test.json", JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
