import test from "node:test";
import assert from "node:assert/strict";
import { fields } from "../src/content/season-field";
import { stations } from "../src/content/season-routes";
import { register, settleRace, withdraw } from "../src/platform/season";
import { read } from "../src/platform/save";
import {
  eligibility,
  raceProgress,
  rankEntries,
  referenceRival,
  standings,
  type Meeting,
  type Round,
} from "../src/sim/season";
import { RivalRide, simulateRival } from "../src/sim/rival";
import { releaseForecast, Ski } from "../src/sim/ski";

test("opponents and a winning line reproduce on the real slope simulation", () => {
  for (const [i, station] of stations.entries()) {
    const { qualifying, final, benchmark } = fields[i];
    for (const run of [...qualifying.flat(), ...final.flat(), benchmark]) {
      assert.deepEqual(simulateRival(station.route, run.seed), run);
    }
    assert.ok(
      benchmark.splits.at(-1)! >
        Math.max(...final.flat().map((run) => run.splits.at(-1)!)),
    );
  }
});

test("the season landing cue predicts a released board without changing the run", () => {
  for (const [i, station] of stations.entries()) {
    const rival = new RivalRide(station.route, fields[i].benchmark.seed);
    let tested = 0;
    while (!rival.done) {
      const ski = rival.ski;
      if (ski.phase === "air" && ski.airTicks > 0 && ski.airTicks % 12 === 0) {
        const release = Object.assign(new Ski(ski.j), ski);
        const estimate = releaseForecast(ski);
        while (!release.result) release.step(false);
        assert.equal(estimate?.score, release.result.score);
        assert.equal(estimate?.grade, release.result.grade);
        assert.equal(ski.phase, "air");
        tested++;
      }
      rival.step();
    }
    assert.ok(tested > 3);
  }
});

test("ties share a rank and a tie on the qualifying line still advances", () => {
  assert.deepEqual(
    rankEntries(
      [25, 50, 50].map((score, id) => ({
        id,
        name: String(id),
        scores: [score],
      })),
    ).map((row) => row.rank),
    [1, 1, 3],
  );
  const meet: Meeting = { id: "tie", station: 0, qualifying: [], final: [] };
  const line = referenceRival(meet, "qualifying").best;
  meet.qualifying.push(
    { id: "A", points: 0, clips: [] },
    { id: "B", points: line, clips: [] },
  );
  const cutoff = standings(meet, "qualifying").find((row) => row.id === -1)!;
  assert.ok(cutoff.rank <= 4);
  assert.equal(raceProgress(meet).round, "final");
});

test("old progress migrates, rounds resume, slots settle once, and a champion unlocks all three stations", () => {
  const key = "half-turn.ski.v1";
  const storage = new Map([
    [key, JSON.stringify({ openingSeen: true, tickets: 120 })],
  ]);
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, value: string) => storage.set(k, value),
    },
  });
  try {
    assert.equal(read().tickets, 120);
    assert.deepEqual(read().season, { active: null, honors: {} });
    assert.equal(register(1, "locked"), undefined);
    assert.equal(register(2, "locked"), undefined);
    const enter = register(0, "pine-eliminated")!;
    assert.ok(enter);
    assert.equal(register(0, "abandon-by-overwrite"), undefined);
    const race = (
      meetId: string,
      round: Round,
      index: number,
      points: number,
      id = meetId + "/" + round + "/" + index,
    ) => settleRace({ meetId, round, index }, { id, points, clips: [] });
    assert.equal(race(enter.id, "final", 0, 0).recorded, false);
    assert.equal(race(enter.id, "qualifying", 0, 0).recorded, true);
    assert.equal(raceProgress(read().season.active!).next, 1);
    assert.equal(race(enter.id, "qualifying", 0, 900).recorded, false);
    assert.equal(race(enter.id, "qualifying", 1, 0).recorded, true);
    assert.ok(raceProgress(read().season.active!).finished);
    assert.equal(read().tickets, 120);
    for (const [i, station] of stations.entries()) {
      assert.equal(eligibility(read().season, i), "");
      const { id } = register(i, "win-" + i)!;
      const winning = fields[i].benchmark.splits.at(-1)!;
      race(id, "qualifying", 0, winning);
      race(id, "qualifying", 1, 0);
      assert.deepEqual(raceProgress(read().season.active!), {
        round: "final",
        next: 0,
        finished: false,
      });
      assert.ok(!race("stale-id", "final", 0, winning).recorded);
      race(id, "final", 0, winning);
      assert.equal(race(id, "final", 1, 0).bonus, 100);
      assert.equal(race(id, "final", 1, winning).recorded, false);
      assert.equal(read().season.honors[station.id].rank, 1);
      assert.equal(read().tickets, 120 + (i + 1) * 100);
    }
    const replayMeet = register(2, "night-rematch")!;
    race(replayMeet.id, "qualifying", 0, 10000);
    race(replayMeet.id, "qualifying", 1, 10000);
    race(replayMeet.id, "final", 0, 10000);
    assert.equal(race(replayMeet.id, "final", 1, 10000).bonus, 0);
    withdraw(replayMeet.id);
    assert.equal(read().season.active, null);
    assert.equal(read().tickets, 420);
    assert.equal(read().season.honors.night.rank, 1);
  } finally {
    Reflect.deleteProperty(globalThis, "localStorage");
  }
});
