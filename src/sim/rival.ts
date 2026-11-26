import type { Route } from "../content/routes";
import { gateOffset, sectionEnd, Ski } from "./ski";

export type RivalRun = {
  seed: number;
  splits: number[];
  ticks: number;
};
type Tactic = { lip: number; tuck: number; gateError: number; boost: number };

function random(seed: number) {
  const mixed = Math.imul(seed ^ (seed >>> 7), 0x45d9f3b);
  return ((mixed ^ (mixed >>> 16)) >>> 0) / 4294967296;
}

export class RivalRide {
  ski: Ski;
  section = 0;
  elapsed = 0;
  score = 0;
  done = false;
  readonly splits: number[] = [];
  private tactic: Tactic;
  private past = 0;

  constructor(
    readonly route: Route,
    readonly seed: number,
  ) {
    this.ski = new Ski(route.jumps[0]);
    this.tactic = this.plan();
  }

  get distance() {
    return this.past + Math.min(this.ski.x, sectionEnd(this.ski.j));
  }

  private plan(): Tactic {
    const salt = this.seed * 101 + this.section * 487;
    return {
      lip: 0.62 + random(salt + 8) * 2.1,
      tuck: 27 + Math.floor(random(salt + 61) * 26),
      gateError: (random(salt + 155) - 0.5) * 3.8,
      boost:
        random(salt + 218) > 0.58 ? 0.47 + random(salt + 5) * 0.33 : Infinity,
    };
  }

  instruction() {
    const ski = this.ski;
    const jump = ski.j;
    const t = this.tactic;
    const running = ski.phase === "run";
    const boost =
      running && ski.boostAt === undefined && ski.x >= jump.lip * t.boost;
    const gate = jump.trail?.gates[ski.gateIndex];
    const steer =
      running && gate !== undefined
        ? Math.max(
            -1,
            Math.min(
              1,
              (gateOffset(jump, ski.gateIndex) + t.gateError - ski.lateral) *
                0.8,
            ),
          )
        : 0;
    const held = running
      ? ski.x < jump.lip - t.lip
      : ski.phase === "air"
        ? ski.airTicks < t.tuck
        : ski.phase === "recover";
    return { held, boost, steer };
  }

  step() {
    if (this.done) return;
    const ski = this.ski;
    const jump = ski.j;
    const input = this.instruction();
    if (input.boost) ski.boost();
    ski.steer = input.steer;
    const previous = ski.result;
    ski.step(input.held);
    this.elapsed++;
    if (!previous && ski.result) {
      this.score += ski.result.score + ski.gateHits * 25;
      this.splits.push(this.score);
    }
    if (
      ski.phase !== "land" ||
      ski.tick - ski.contactTick <= 35 ||
      ski.x < sectionEnd(jump)
    )
      return;
    this.done = this.section + 1 >= this.route.jumps.length;
    if (this.done) return;
    this.past += sectionEnd(jump);
    this.section++;
    this.ski = new Ski(
      this.route.jumps[this.section],
      false,
      ski.result?.combo ?? 0,
      ski.speed,
    );
    this.tactic = this.plan();
  }
}

export function simulateRival(route: Route, seed: number): RivalRun {
  const ride = new RivalRide(route, seed);
  while (!ride.done && ride.elapsed < 16000) ride.step();
  if (!ride.done || ride.splits.length !== route.jumps.length)
    throw new Error("虚拟滑手未完赛 " + route.id);
  return { seed, splits: ride.splits, ticks: ride.elapsed };
}
