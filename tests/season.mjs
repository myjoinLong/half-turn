import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";
import { markOpeningSeen } from "./career-fixture.mjs";

const url = "http://127.0.0.1:5201";
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "5201",
    "--strictPort",
  ],
  {
    windowsHide: true,
    stdio: "ignore",
  },
);
// Intercept the dev module only in this browser. Inject controls at the normal
// physics boundary so every point is earned by a real jump and every slot settles normally.
const testControls = `
  import { fields as qaFields } from "/src/content/season-field.ts";
  let qaPilot, qaRun;
  scene.drive = () => {};
  window.qaRace = (limit = 10000, coast = false) => {
    if (!race || route.mode !== "match") throw new Error("赛季未开赛");
    if (qaRun !== runId) {
      qaRun = runId;
      qaPilot = new RivalRide(route, qaFields[race.meeting.station].benchmark.seed);
      down();
    }
    let n = 0;
    while (playing && !paused && n++ < limit) {
      const input = qaPilot.instruction();
      const player = scene.ski;
      steering = coast ? 0 : input.steer;
      held = !coast && input.held;
      if (!coast && input.boost) boost();
      qaPilot.step();
      race.rival.step();
      step();
      scene.recordEffects(player);
    }
    hud();
    return { total, ticks: qaPilot.elapsed, expected: qaFields[race.meeting.station].benchmark.splits.at(-1) };
  };
  window.qaFinishReplay = () => {
    for (let n = 0; n < 10000 && replay; n++) step();
    return !replay;
  };
`;

let browser;
try {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) throw new Error("赛季测试开发服务器退出");
    try {
      ready = (await fetch(url)).ok;
    } catch {}
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(ready);
  await mkdir("release/store", { recursive: true });
  browser = await chromium.launch({
    executablePath:
      process.env.BROWSER_EXE ||
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    args: ["--disable-gpu", "--disable-renderer-backgrounding"],
  });
  const page = await browser.newPage({
    viewport: { width: 852, height: 393 },
    isMobile: true,
    hasTouch: true,
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await markOpeningSeen(page);
  await page.route("**/src/main.ts", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()) + "\n" + testControls,
    });
  });
  await page.goto(url);
  await page.waitForFunction(() => !!window.qaRace);
  const tap = (label) =>
    page.getByRole("button", { name: label, exact: true }).tap();
  const state = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("half-turn.ski.v1")));
  const open = async () => {
    await page.locator("#menu").tap();
    await tap("人机赛季");
  };
  const shot = (name) =>
    page.screenshot({ path: "release/store/赛事-" + name + ".png" });
  await open();
  await shot("大厅");
  await tap("峡谷大跳台分站");
  assert.ok(
    await page
      .getByRole("button", { name: "报名本站", exact: true })
      .isDisabled(),
  );
  await tap("立体看赛道");
  const plan = page.locator(".course-view");
  const original = await plan.evaluate((canvas) => canvas.toDataURL());
  await tap("转向谷侧");
  assert.notEqual(
    await plan.evaluate((canvas) => canvas.toDataURL()),
    original,
  );
  await tap("返回赛事");
  await tap("返回上一级");

  const stationNames = ["松林公开赛", "峡谷大跳台分站", "夜光总决赛"];
  const winners = [];
  for (const [i, station] of stationNames.entries()) {
    await tap(station);
    await tap("报名本站");
    for (const round of ["资格赛", "决赛"]) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        await tap("开始" + round + "第 " + attempt + " 趟");
        assert.ok(await page.locator("#duel").isVisible());
        if (i === 0 && round === "资格赛" && attempt === 1) {
          await page.evaluate(() => window.qaRace(365));
          await page.waitForTimeout(200);
          await shot("追赶参考选手");
        }
        const result = await page.evaluate(() => window.qaRace());
        assert.equal(result.total, result.expected, station + " " + round);
        if (i === 0 && round === "资格赛" && attempt === 1) {
          assert.equal((await state()).season.active.qualifying.length, 1);
          await page.reload();
          await page.waitForFunction(() => !!window.qaRace);
          await open();
          await tap("查看本站进度");
        }
      }
    }
    await page
      .getByRole("heading", { name: "冠军领奖台", exact: true })
      .waitFor();
    assert.equal((await state()).tickets, 100 * (i + 1));
    winners.push({
      station,
      score: (await state()).season.active.final[0].points,
    });
    if (i === 0) {
      await page.setViewportSize({ width: 568, height: 320 });
      const actions = await page.locator(".race-actions").boundingBox();
      assert.ok(actions.y + actions.height <= 320, JSON.stringify(actions));
      await page.setViewportSize({ width: 852, height: 393 });
      await shot("冠军领奖台");
      await tap("回看最好一趟");
      assert.equal(await page.evaluate(() => window.qaFinishReplay()), true);
      assert.equal((await state()).tickets, 100);
    }
    await tap("返回上一级");
  }
  await tap("历站荣誉");
  await page.getByText("已赢得夜光总决赛冠军 · 赛季冠军").waitFor();
  await shot("历站荣誉");
  await tap("返回上一级");
  await tap("松林公开赛");
  await tap("报名本站");
  for (let attempt = 1; attempt <= 2; attempt++) {
    await tap("开始资格赛第 " + attempt + " 趟");
    await page.evaluate(() => window.qaRace(10000, true));
  }
  await page.getByText(/未晋级 · 第/).waitFor();
  assert.equal((await state()).tickets, 300);
  assert.equal((await state()).season.honors.pine.rank, 1);
  await page.setViewportSize({ width: 568, height: 320 });
  const panel = await page.locator("#screen").boundingBox();
  assert.ok(panel.width <= 568 && panel.y + panel.height <= 321);
  await tap("返回赛季大厅");
  await tap("松林公开赛");
  await tap("重报本站");
  await tap("结束本站报名");
  const confirmation = page.getByRole("dialog", { name: "结束本站报名？" });
  assert.ok(await confirmation.isVisible());
  assert.ok(await page.locator("#screen").isVisible());
  await tap("保留报名");
  assert.ok(await confirmation.isHidden());
  assert.equal((await state()).season.active.station, 0);
  await tap("结束本站报名");
  await tap("确认结束报名");
  assert.equal((await state()).season.active, null);
  assert.equal((await state()).season.honors.pine.rank, 1);
  await tap("返回上一级");
  await tap("练习公园");
  await tap("落地小台");
  assert.equal(await page.locator("#duel").isVisible(), false);
  assert.deepEqual(errors, []);
  const report = {
    winners,
    qualifyingReload: true,
    elimination: true,
    withdrawConfirmation: true,
    bestReplay: true,
    tickets: 300,
    smallLandscape: true,
  };
  await writeFile("release/人机赛季回归.json", JSON.stringify(report, null, 2));
  console.log(report);
} finally {
  if (browser) await browser.close();
  server.kill();
}
