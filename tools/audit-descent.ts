import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import {
  daily,
  opening,
  parks,
  tours,
  type Route,
} from "../src/content/routes";
import { gateOffset, sectionEnd, Ski } from "../src/sim/ski";

const dates = Array.from({ length: 14 }, (_, i) =>
  daily(new Date(i * 86400000)),
);
const aurora: Route = {
  ...tours[11],
  id: "aurora",
  mode: "show",
  name: "极光巡游",
};
const routes = [opening, ...tours, ...parks, ...dates, aurora];

function descend(route: Route, style: "clean" | "recover" | "rush") {
  let combo = 0,
    distance = 0,
    ticks = 0,
    points = 0,
    recoveries = 0,
    gates = 0,
    entrySpeed = route.jumps[0].speed;
  const stages = [];
  for (const [index, jump] of route.jumps.entries()) {
    const ski = new Ski(
      jump,
      route.mode === "intro" || (route.id === "tour-0" && index === 0),
      combo,
      entrySpeed,
    );
    if (style === "rush" && route.mode !== "daily") ski.boost();
    let reachedAir = false,
      hitAt = 0;
    while (ski.tick < 3500) {
      if (
        ski.result &&
        ski.phase === "land" &&
        ski.tick - ski.contactTick > 35 &&
        ski.x >= sectionEnd(jump)
      )
        break;
      const gate = jump.trail?.gates[ski.gateIndex];
      ski.steer =
        gate !== undefined && ski.phase === "run"
          ? Math.max(
              -1,
              Math.min(
                1,
                (gateOffset(jump, ski.gateIndex) - ski.lateral) * 0.78,
              ),
            )
          : 0;
      ski.braking =
        style === "recover" &&
        ski.phase === "run" &&
        ski.x > jump.lip * 0.25 &&
        ski.x < jump.lip * 0.36;
      const press =
        ski.phase === "run"
          ? ski.x < jump.lip - (style === "rush" ? 0.45 : 1.75)
          : ski.phase === "air"
            ? style === "recover"
              ? ski.airTicks >= 5 && ski.airTicks < 19
              : jump.showcase
                ? !ski.releaseWindow
                : ski.airTicks < 40
            : ski.phase === "recover";
      ski.step(press);
      reachedAir ||= ski.phase === "air";
      if (ski.phase === "crash" && !hitAt) hitAt = ski.x;
    }
    assert.ok(
      reachedAir &&
        ski.result &&
        ski.phase === "land" &&
        ski.x >= sectionEnd(jump),
      route.name,
    );
    if (style === "clean")
      assert.notEqual(ski.result.grade, "摔倒", route.name);
    if (hitAt) {
      assert.ok(ski.x > hitAt);
      recoveries++;
    }
    gates += ski.gateHits;
    combo = ski.result.combo;
    points += ski.result.score + ski.gateHits * 25;
    distance += sectionEnd(jump);
    ticks += ski.tick;
    entrySpeed = ski.speed;
    stages.push({
      grade: ski.result.grade,
      gates: ski.gateHits,
      meters: sectionEnd(jump),
    });
  }
  return {
    style,
    distance,
    seconds: Number((ticks / 60).toFixed(1)),
    points,
    recoveries,
    gates,
    stages,
  };
}
const report = routes.map((route) => ({
  name: route.name,
  mode: route.mode,
  id: route.id,
  runs: (["clean", "recover", "rush"] as const).map((style) =>
    descend(route, style),
  ),
}));
assert.ok(
  report.filter((r) => r.mode === "tour").every((r) => r.runs[0].seconds > 53),
);
assert.ok(report.find((r) => r.mode === "intro")?.runs[1].recoveries);
writeFileSync("release/立体雪道全线路.json", JSON.stringify(report, null, 2));
const tour = report
  .filter((r) => r.mode === "tour")
  .map((r) => r.runs[0].seconds);
console.log({
  routes: report.length,
  runs: report.length * 3,
  tourSeconds: [Math.min(...tour), Math.max(...tour)],
});
