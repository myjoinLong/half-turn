import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { stations } from "../src/content/season-routes";
import { simulateRival, type RivalRun } from "../src/sim/rival";

const score = (run: RivalRun) => run.splits.at(-1)!;
const fields = stations.map((station, index) => {
  const pool = Array.from({ length: 101 }, (_, i) =>
    simulateRival(station.route, i + 1),
  );
  pool.sort((a, b) => score(a) - score(b) || a.seed - b.seed);
  const sample = (quality: number) =>
    pool[Math.round(Math.min(1, Math.max(0, quality)) * (pool.length - 1))];
  const qualifying = [0.11, 0.39, 0.47, 0.55, 0.29, 0.22, 0.62];
  const final = [0.34, 0.63, 0.57, 0.71, 0.45, 0.39, 0.76];
  const adjustment = index * 0.049;
  const makeRound = (levels: number[]) =>
    levels.map((level, i) => [
      sample(level + adjustment - 0.075 - 0.018 * (i % 3)),
      sample(level + adjustment),
    ]);
  const field = {
    qualifying: makeRound(qualifying),
    final: makeRound(final),
    benchmark: sample(1),
  };
  const top = Math.max(...field.final.flat().map(score));
  assert.ok(
    score(field.benchmark) > top,
    station.route.name + "的对手阵容需要留冠军余量",
  );
  console.log(station.route.name, {
    qualifier: field.qualifying.map((pair) => Math.max(...pair.map(score))),
    finalists: field.final.map((pair) => Math.max(...pair.map(score))),
    benchmark: score(field.benchmark),
    seconds: Math.round(field.benchmark.ticks / 60),
  });
  return field;
});
const source =
  "// 由 tools/build-season-field.ts 生成，成绩来自同一滑行模拟。\n" +
  'import type { RivalRun } from "../sim/rival";\n\n' +
  "export const fields: { qualifying: RivalRun[][]; final: RivalRun[][]; benchmark: RivalRun }[] = " +
  JSON.stringify(fields, null, 2) +
  ";\n";
writeFileSync("src/content/season-field.ts", source);
