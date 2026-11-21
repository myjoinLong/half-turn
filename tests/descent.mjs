import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_EXE ||
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  args: [
    "--disable-gpu",
    "--disable-renderer-backgrounding",
    "--disable-background-timer-throttling",
  ],
});
const errors = [];
const coverage = [];
const url = process.env.SKI_URL || "http://127.0.0.1:4187";
await mkdir("release/store", { recursive: true });
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  const cdp = await context.newCDPSession(page);
  const text = (id) => page.locator("#" + id).textContent();
  const speed = async () => parseInt(await text("speed"));
  const click = (name) =>
    page.getByRole("button", { name, exact: true }).dispatchEvent("click");
  const openMenu = () => page.locator("#menu").dispatchEvent("click");
  const state = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("half-turn.ski.v1")));
  const testKey = (key, pressed) => page.keyboard[pressed ? "down" : "up"](key);
  const shot = (name) =>
    page.screenshot({ path: "release/store/雪道重做-" + name + ".png" });
  async function wait(check, ms = 15000) {
    for (let elapsed = 0; elapsed < ms; elapsed += 120) {
      if (await check()) return;
      await page.waitForTimeout(120);
    }
    throw Error(
      (await page.locator("#app").innerText()) + "\n" + errors.join("\n"),
    );
  }
  async function touch(type, xShift = 0) {
    const box = await page.locator("#ride").boundingBox();
    await cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints:
        type === "touchEnd"
          ? []
          : [
              {
                x: box.x + box.width * 0.5 + xShift,
                y: box.y + box.height * 0.5,
              },
            ],
    });
  }
  await page.goto(url);
  await page.waitForSelector("canvas");
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  assert.equal(await text("line"), "极光大跳台");
  await shot("开场");
  const initialSpeed = await speed();
  await page.locator("#boost").dispatchEvent("click");
  await touch("touchStart");
  await wait(async () => (await speed()) > initialSpeed * 1.35, 4000);
  const boostedSpeed = await speed();
  assert.ok(boostedSpeed > initialSpeed * 1.35);
  await shot("冲刺");
  await touch("touchEnd");
  await wait(async () => (await text("action")) === "侧滑卸力");
  await shot("倒地");
  await touch("touchStart");
  await wait(async () => (await text("feedback")) === "重新站稳");
  await touch("touchEnd");
  await wait(async () => (await text("jump")).includes("32 米"));
  assert.equal(
    (await state()).events.filter((event) => event.name === "摔倒后起身")
      .length,
    1,
  );
  await touch("touchStart");
  await wait(async () => (await text("trick")).includes("抓板尾"));
  await page.waitForTimeout(450);
  await touch("touchMove", 60);
  await wait(async () => (await text("feedback")).includes("现在松手"));
  await shot("抓板");
  await touch("touchEnd");
  await wait(async () => (await text("hint")).includes("完美落地"));
  await wait(
    async () =>
      (await page.getByRole("heading", { name: "高光完成" }).count()) === 1,
    30000,
  );
  await click("从松林山起步");
  assert.equal(await text("score"), "0000");
  assert.equal((await state()).tickets, 0);
  coverage.push("开场、冲刺、摔倒滑行、按住起身、横滑换抓板、零分入山");
  console.log("开场流程通过", { initialSpeed, boostedSpeed });

  await openMenu();
  await shot("雪场");
  await click("巡回赛 · 选山");
  await shot("选山");
  await click("松林山");
  await page.getByRole("button", { name: /^初雪山脊/ }).dispatchEvent("click");
  // The route driver uses public controls and reads only the same HUD the player sees.
  async function driveTo(heading, limit = 140000) {
    await page.evaluate(() => {
      let holding = false,
        lastDistance = Infinity;
      const emit = (code, key, on) =>
        window.dispatchEvent(
          new KeyboardEvent(on ? "keydown" : "keyup", {
            code,
            key,
            bubbles: true,
          }),
        );
      window.qaDriving = true;
      function drive() {
        if (!window.qaDriving) return;
        if (document.querySelector("dialog").open) {
          if (holding) emit("Space", " ", false);
          return;
        }
        const action = document.querySelector("#action").textContent;
        const meter = document.querySelector("#meter").textContent;
        let wanted = false;
        if (action === "触碰出发" || action === "按住撑地起身") wanted = true;
        else if (meter.startsWith("离跳台")) {
          lastDistance = parseFloat(meter.match(/\d+/)?.[0] || "0");
          wanted = lastDistance > 2.5;
        } else if (meter.startsWith("转体"))
          wanted = parseFloat(meter.match(/\d+/)?.[0] || "0") < 146;
        if (wanted !== holding) {
          holding = wanted;
          emit("Space", " ", holding);
        }
        requestAnimationFrame(drive);
      }
      requestAnimationFrame(drive);
    });
    for (let elapsed = 0; elapsed < limit; elapsed += 1000) {
      await page.waitForTimeout(1000);
      if (
        await page.getByRole("heading", { name: heading, exact: true }).count()
      ) {
        await page.evaluate(() => {
          window.qaDriving = false;
        });
        return;
      }
    }
    assert.fail(
      "没有进入" + heading + "\n" + (await page.locator("#app").innerText()),
    );
  }
  await driveTo("冲过终点");
  const tour = (await state()).records["tour-0"];
  assert.equal(tour.clips.length, 4);
  assert.ok(tour.score >= 250);
  await click("最佳一跳回看");
  await wait(
    async () =>
      (await page.getByRole("heading", { name: "冲过终点" }).count()) === 1,
    32000,
  );
  await click("雪场菜单");
  await click("练习公园");
  await click("落地小台");
  await touch("touchStart");
  await touch("touchMove", 67);
  await testKey("ArrowDown", true);
  await wait(async () => (await speed()) < 43, 4000);
  const brakeSpeed = await speed();
  assert.ok(brakeSpeed < 43);
  await testKey("ArrowDown", false);
  await touch("touchEnd");
  await driveTo("练习完成", 40000);
  coverage.push("巡回赛四跳完赛、得分纪录与回放、练习公园、压刃减速、走线");
  console.log("巡回赛和练习通过", { tourScore: tour.score, brakeSpeed });
  await click("雪场菜单");
  await click("每日表演赛");
  await click("开始同题挑战");
  assert.equal(await page.locator("#boost").isVisible(), false);
  await driveTo("冲过终点");
  assert.ok(
    Object.keys((await state()).records).some((key) =>
      key.startsWith("daily-"),
    ),
  );
  await click("赛后衣柜");
  await click("看视频，再领 40 张雪票");
  assert.match(await page.locator("#panel").innerText(), /暂无可用视频/);
  coverage.push("每日表演赛、衣柜、无广告返回");
  await page.setViewportSize({ width: 320, height: 568 });
  assert.equal(
    await page.evaluate(() => document.body.scrollWidth > innerWidth),
    false,
  );
  await page.reload();
  await page.waitForSelector("canvas");
  assert.ok((await state()).records["tour-0"]);
  assert.doesNotMatch(await page.locator("#app").innerText(), /[a-zA-Z]/);
  assert.deepEqual(errors, []);
  const report = {
    browser: browser.version(),
    coverage,
    initialSpeed,
    boostedSpeed,
    brakeSpeed,
    tourScore: tour.score,
    narrow: true,
    errors,
  };
  await writeFile(
    "release/立体雪道浏览器回归.json",
    JSON.stringify(report, null, 2),
  );
  console.log(report);
} finally {
  await browser.close();
}
