import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_EXE ||
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  args: ["--disable-gpu"],
});
const url = process.env.SKI_URL || "http://127.0.0.1:4187";
const sizes = [
  [568, 320],
  [852, 393],
  [932, 430],
];
await mkdir("release/store", { recursive: true });
try {
  for (const [width, height] of sizes) {
    const page = await browser.newPage({
      viewport: { width, height },
      isMobile: true,
      hasTouch: true,
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const open = () => page.locator("#menu").tap();
    const tap = (name) => page.getByRole("button", { name, exact: true }).tap();
    const getSave = () =>
      page.evaluate(() => JSON.parse(localStorage.getItem("half-turn.ski.v1")));
    await page.addInitScript(() => {
      const key = "half-turn.ski.v1";
      if (!localStorage.getItem(key))
        localStorage.setItem(
          key,
          JSON.stringify({ openingSeen: true, tickets: 220, steady: true }),
        );
    });
    await page.goto(url);
    await page.waitForSelector("#game canvas");
    const rightEdge = await page.locator("#menu").boundingBox();
    assert.ok(width - rightEdge.x - rightEdge.width < 28);
    const screen = page.locator("#screen");
    const pause = page.getByRole("dialog", { name: "滑行暂停" });
    await tap("暂停滑行");
    assert.ok(await pause.isVisible());
    assert.ok(await screen.isHidden());
    assert.ok(await page.locator("#field").isVisible());
    assert.ok((await pause.boundingBox()).width < width);
    await tap("继续滑行");
    assert.ok(await pause.isHidden());
    await open();
    assert.ok(await screen.isVisible());
    assert.ok(await page.locator("#sheet").isHidden());
    assert.ok(await page.locator("#field").isHidden());
    const bounds = await screen.boundingBox();
    assert.equal(bounds.x, 0);
    assert.equal(bounds.y, 0);
    assert.ok(Math.abs(bounds.width - width) < 1);
    assert.ok(Math.abs(bounds.height - height) < 1);
    for (const action of ["滑行设置", "重玩开场表演"]) {
      const entry = await screen
        .getByRole("button", { name: action, exact: true })
        .boundingBox();
      assert.ok(entry.y + entry.height <= height + 1, action);
    }
    if (width === 852)
      await page.screenshot({ path: "release/store/全屏-雪场.png" });
    if (width === 568)
      await page.screenshot({ path: "release/store/全屏-小屏雪场.png" });
    await tap("赛事");
    assert.ok(
      await page
        .getByRole("heading", { name: "人机赛季", exact: true })
        .isVisible(),
    );
    await tap("纪录");
    assert.ok(
      await page
        .getByRole("heading", { name: "个人纪录", exact: true })
        .isVisible(),
    );
    await tap("回到雪道");
    assert.ok(await screen.isHidden());
    await open();
    await tap("巡回赛 · 选山");
    if (width === 852)
      await page.screenshot({ path: "release/store/全屏-选择雪山.png" });
    assert.equal(
      await page
        .getByRole("button", { name: "看视频，用极光灯光滑一趟" })
        .count(),
      0,
    );
    await tap("峡谷山");
    assert.equal(await page.locator(".route-list .resort-row").count(), 5);
    await page.locator(".inspect-route").first().tap();
    const model = page.locator(".course-view");
    const thumbnail = await model.evaluate((canvas) => canvas.toDataURL());
    if (width === 852)
      await page.screenshot({ path: "release/store/全屏-立体赛道.png" });
    await tap("转向谷侧");
    assert.notEqual(
      await model.evaluate((canvas) => canvas.toDataURL()),
      thumbnail,
    );
    await tap("返回上一级");
    await tap("返回上一级");
    await tap("返回上一级");
    await tap("衣柜");
    assert.equal(
      await page.getByRole("button", { name: "全部 16 款" }).count(),
      1,
    );
    assert.equal(await page.locator(".gear-grid button").count(), 3);
    await tap("海盐");
    await tap("收藏此款");
    assert.deepEqual((await getSave()).wear, [0, 0, 0]);
    await tap("已收藏 1 款");
    assert.equal(await page.locator(".gear-grid button").count(), 1);
    await tap("全部 16 款");
    const outfit = screen.locator(".outfit-preview");
    const originalAngle = await outfit.evaluate((canvas) => canvas.toDataURL());
    await tap("向左旋转滑手");
    assert.notEqual(
      await outfit.evaluate((canvas) => canvas.toDataURL()),
      originalAngle,
    );
    if (width === 852)
      await page.screenshot({ path: "release/store/全屏-旋转试穿.png" });
    await tap("向右旋转滑手");
    assert.equal(
      await outfit.evaluate((canvas) => canvas.toDataURL()),
      originalAngle,
    );
    assert.deepEqual((await getSave()).wear, [0, 0, 0]);
    await tap("100 雪票兑换");
    assert.deepEqual((await getSave()).wear, [1, 0, 0]);
    assert.equal((await getSave()).tickets, 120);
    await tap("雪服");
    assert.equal(
      await page.getByRole("button", { name: "全部 12 款" }).count(),
      1,
    );
    await tap("雪迹");
    assert.equal(
      await page.getByRole("button", { name: "全部 8 款" }).count(),
      1,
    );
    await tap("下一页装备");
    await tap("下一页装备");
    assert.equal(await page.locator(".gear-grid button").count(), 2);
    assert.ok(
      await page.getByRole("button", { name: "下一页装备" }).isDisabled(),
    );
    assert.ok(
      await page
        .locator("#panel")
        .evaluate(
          (dialog) =>
            dialog.scrollWidth <= dialog.clientWidth + 1 &&
            dialog.getBoundingClientRect().bottom <= innerHeight + 1,
        ),
    );
    await tap("极光");
    await tap("190 雪票兑换");
    assert.ok(
      await page
        .getByText("还差 70 张雪票。巡回赛完赛可得 20 张。")
        .isVisible(),
    );
    await page.reload();
    await open();
    await tap("衣柜与收藏");
    assert.equal((await getSave()).tickets, 120);
    assert.deepEqual((await getSave()).favorites[0], [1]);
    assert.deepEqual((await getSave()).wear, [1, 0, 0]);
    assert.doesNotMatch(await page.locator("#panel").innerText(), /[a-z]/i);
    await tap("回到雪道");
    await page.locator("#ride").tap();
    await page.waitForFunction(
      () => parseInt(document.querySelector("#progress").textContent) > 2,
    );
    await page.setViewportSize({ width: height, height: width });
    await page.locator("#rotate-screen").waitFor();
    const position = await page.locator("#progress").textContent();
    await page.waitForTimeout(350);
    assert.equal(await page.locator("#progress").textContent(), position);
    await page.setViewportSize({ width, height });
    await page.locator("#rotate-screen").waitFor({ state: "hidden" });
    await page.waitForFunction(
      (paused) => document.querySelector("#progress").textContent !== paused,
      position,
    );
    assert.deepEqual(errors, []);
    await page.close();
    console.log(width + "×" + height + " 雪场、看赛道、衣柜翻页及转屏续滑通过");
  }
} finally {
  await browser.close();
}
