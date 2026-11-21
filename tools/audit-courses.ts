import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { daily, parks, tours } from "../src/content/routes";
import { Ski } from "../src/sim/ski";

const result = [];
for (const route of [
  ...tours,
  ...parks,
  ...Array.from({ length: 14 }, (_, i) => daily(new Date(i * 86400000))),
]) {
  const strategies = [];
  for (const style of ["保守半圈", "台沿整圈"]) {
    let ticks = 0,
      score = 0,
      combo = 0;
    const landings = [];
    for (const j of route.jumps) {
      const ski = new Ski(j, false, combo);
      while (!ski.result && ski.tick < 1200) {
        const pressed =
          ski.phase === "run"
            ? ski.x < j.lip - (style === "保守半圈" ? 2.8 : 0.35)
            : ski.airTicks < (style === "保守半圈" ? 40 : 86);
        ski.step(pressed);
      }
      assert.ok(ski.result, route.name);
      assert.notEqual(ski.result.grade, "摔倒", route.name + "/" + style);
      const { grade, halves, error } = ski.result;
      landings.push({
        grade,
        halves,
        error: Number(error.toFixed(2)),
        distance: Number((ski.x - j.lip).toFixed(2)),
      });
      const landedAt = ski.tick;
      while (
        ski.tick - landedAt <= 35 ||
        ski.x < Math.max(j.lip + 33, j.lip + j.speed * 3.5)
      )
        ski.step(false);
      ticks += ski.tick;
      score += ski.result.score;
      combo = ski.result.combo;
    }
    const seconds = Number((ticks / 60).toFixed(2));
    if (route.mode !== "park")
      assert.ok(seconds >= 35 && seconds <= 55, route.name + "/" + seconds);
    strategies.push({ style, seconds, score, landings });
  }
  result.push({ id: route.id, name: route.name, strategies });
}
writeFileSync("release/course-audit.json", JSON.stringify(result, null, 2));
console.log(result.length + " routes passed two strategies.");
