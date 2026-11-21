import test from "node:test";
test("recorded touch edges replay on the same simulation ticks at 30 and 60 Hz", () => {
  const edges = new Set([0, 68, 73, 113]);
  function replay(fps: number) {
    const s = new Ski(parks[0].jumps[0]);
    let held = false,
      elapsed = 0;
    for (let frame = 0; frame < fps * 5 && !s.result; frame++) {
      elapsed += 60;
      while (elapsed >= fps && !s.result) {
        elapsed -= fps;
        if (edges.has(s.tick)) held = !held;
        s.step(held);
      }
    }
    assert.ok(s.manual);
    assert.ok(s.result);
    assert.ok(s.result.score > 0);
    return [s.tick, s.x, s.y, s.angle, s.result];
  }
  assert.deepEqual(replay(30), replay(60));
});
import assert from "node:assert/strict";
import { Ski, judge, height } from "../src/sim/ski";
import { tours, parks, daily } from "../src/content/routes";
import { finish, read, change, credit } from "../src/platform/save";
test("inclusive landing thresholds and switch stance", () => {
  for (const [error, grade] of [
    [0, "完美"],
    [10, "完美"],
    [10.01, "干净"],
    [25, "干净"],
    [25.01, "勉强"],
    [40, "勉强"],
    [40.01, "摔倒"],
  ] as const)
    for (const sign of [-1, 1])
      assert.equal(judge(-180 + 8 + error * sign, 8, 0).grade, grade);
  assert.equal(judge(0, 0, 0).score, 0);
  assert.equal(judge(-180, 0, 99).score, 200);
});
function ride(route: (typeof tours)[number], fps: number) {
  let score = 0,
    combo = 0;
  const ticks = [];
  for (const j of route.jumps) {
    const s = new Ski(j, false, combo);
    let frames = 0;
    while (!s.result && frames++ < 2000) {
      for (let i = 0; i < 60 / fps && !s.result; i++)
        s.step(s.phase === "run" ? s.x < j.lip - 0.5 : s.airTicks < 40);
    }
    assert.ok(s.manual);
    assert.ok(s.result);
    assert.notEqual(s.result.grade, "摔倒");
    assert.equal(s.result.halves, 1);
    assert.ok(Math.abs(s.y - height(j, s.x)) < 0.000001);
    score += s.result.score;
    combo = s.result.combo;
    ticks.push(s.tick);
  }
  return { score, ticks };
}
test("15 tour courses, 3 parks, 14 daily sets at 30/60 fps", () => {
  for (const r of [
    ...tours,
    ...parks,
    ...Array.from({ length: 14 }, (_, i) => daily(new Date(i * 86400000))),
  ])
    assert.deepEqual(ride(r, 30), ride(r, 60));
});
test("high speed sweep and Beijing rollover", () => {
  const s = new Ski({ ...parks[2].jumps[0], speed: 110 });
  for (let i = 0; i < 400 && !s.result; i++) s.step(false);
  assert.ok(s.result);
  assert.equal(s.y, height(s.j, s.x));
  assert.notEqual(
    daily(new Date("2026-11-21T15:59:59Z")).id,
    daily(new Date("2026-11-21T16:00:00Z")).id,
  );
});
test("idempotent finish, medals, same score and reward", () => {
  finish("r1", "tour-t", [], 300, true);
  finish("r1", "tour-t", [], 300, true);
  assert.equal(read().tickets, 60);
  finish("r2", "tour-t", [], 300, true);
  assert.equal(read().tickets, 80);
  change((s) => {
    credit(s, "ad1", 40);
    credit(s, "ad1", 40);
  });
  assert.equal(read().tickets, 120);
});
