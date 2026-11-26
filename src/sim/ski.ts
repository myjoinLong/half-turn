import type { Jump } from "../content/routes";
import type { Grab } from "../content/tricks";
export const simVersion = 1,
  courseVersion = 2,
  dt = 1 / 60;
export function roadCenter(j: Jump, x: number) {
  if (!j.trail || x <= 0 || x >= j.lip) return 0;
  const t = x / j.lip;
  return (
    j.trail.bend *
    Math.sin(t * Math.PI) ** 2 *
    Math.sin(t * Math.PI * j.trail.waves * 2)
  );
}
export function roadWidth(j: Jump, x: number) {
  return j.trail ? j.trail.width + Math.sin(x * 0.075) * 0.8 : 12;
}
export function gateOffset(j: Jump, index: number) {
  return (
    (index % 2 ? -1 : 1) *
    Math.sign(j.trail?.bend || 1) *
    roadWidth(j, 0) *
    0.48
  );
}
export const sectionEnd = (j: Jump) =>
  j.lip + (j.trail?.runout ?? (j.showcase ? 164 : 60));
export function height(j: Jump, x: number) {
  const z = x - j.lip;
  if (j.showcase) {
    if (z <= -9) return 1.4 + (z + 9) * 0.42;
    if (z <= 0) return 1.4 - 1.4 * ((z + 9) / 9) ** 2;
    if (z < 15) return j.drop * (z / 15) ** 0.64;
    return j.drop + (z - 15) * j.slope;
  }
  if (z < -5) {
    if (!j.trail) return -1.1 + (z + 5) * 0.09;
    const t = (x / Math.max(1, j.lip - 5)) * Math.PI;
    return (
      -1.1 +
      (z + 5) * 0.19 +
      Math.sin(t * j.trail.waves * 2) * Math.min(4, j.lip * 0.02)
    );
  }
  if (z <= 0) return -1.1 - (z + 5) * 0.22;
  if (z < 5) return -2.2 + ((j.drop + 2.2) * z) / 5;
  return j.drop + (z - 5) * j.slope;
}
export function tangent(j: Jump, x: number) {
  return (
    (Math.atan2(height(j, x + 0.001) - height(j, x - 0.001), 0.002) * 180) /
    Math.PI
  );
}
export function judge(angle: number, slope: number, combo: number) {
  const diff = angle - slope,
    halves = Math.round(Math.abs(diff) / 180),
    error = diff - Math.round(diff / 180) * 180,
    a = Math.abs(error);
  const grade = a <= 10 ? "完美" : a <= 25 ? "干净" : a <= 40 ? "勉强" : "摔倒";
  const score =
    grade === "摔倒"
      ? 0
      : Math.round(
          halves *
            100 *
            ((a <= 10 ? 1.5 : a <= 25 ? 1.2 : 1) +
              (a <= 25 ? Math.min(combo, 5) * 0.1 : 0)),
        );
  return { grade, score, halves, error, combo: a <= 25 ? combo + 1 : 0 };
}
export type Result = ReturnType<typeof judge>;
export function releaseForecast(ski: Ski): Result | undefined {
  if (ski.phase !== "air" || ski.j.showcase) return;
  let { x, y, vy, omega, angle } = ski;
  for (let frame = 0; frame < 240; frame++) {
    omega *= 0.83;
    angle += omega * dt;
    const endX = x + ski.speed * dt;
    const endY = y + vy * dt + 7 * dt * dt;
    if (vy + 14 * dt > 0 && endY >= height(ski.j, endX)) {
      let lower = 0,
        upper = dt;
      for (let i = 0; i < 10; i++) {
        const t = (lower + upper) / 2;
        if (y + vy * t + 7 * t * t >= height(ski.j, x + ski.speed * t))
          upper = t;
        else lower = t;
      }
      return judge(angle, tangent(ski.j, x + ski.speed * upper), ski.combo);
    }
    x = endX;
    y = endY;
    vy += 14 * dt;
  }
}
export class Ski {
  x = 0;
  y = 0;
  vy = 0;
  angle = 0;
  omega = 0;
  tick = 0;
  charge = 0;
  held = false;
  airTicks = 0;
  tuckTicks = 0;
  tuckAmount = 0;
  yaw = 0;
  landingAngle = 0;
  landingX = 0;
  contactTick = 0;
  lateral = 0;
  lean = 0;
  steer = 0;
  braking = false;
  gateIndex = 0;
  gateHits = 0;
  gateTouches: { index: number; side: number; tick: number }[] = [];
  recoverTick = 0;
  boostAt: number | undefined;
  speed: number;
  activeGrab: Grab | undefined;
  visualGrab: Grab | undefined;
  visualGrip = 0;
  performedGrabs: Grab[] = [];
  private grabTicks = 0;
  private targetYaw = 0;
  private predicting = false;
  private flightTicks = 0;
  private releaseTick = 0;
  private releaseYaw = 0;
  manual = false;
  phase: "run" | "air" | "land" | "crash" | "recover" = "run";
  result?: Result;
  constructor(
    public j: Jump,
    public auto = false,
    public combo = 0,
    entrySpeed = j.speed,
  ) {
    this.y = height(j, 0);
    this.angle = tangent(j, 0);
    this.speed = entrySpeed;
    this.activeGrab = j.grab;
    this.visualGrab = j.grab;
    this.targetYaw = j.showcase || 0;
  }
  boost() {
    if (this.phase !== "run" || this.boostAt !== undefined) return;
    this.boostAt = this.tick;
    this.speed = Math.max(this.speed, this.j.speed * 1.19);
  }
  selectGrab(grab: Grab) {
    if (!this.j.showcase || this.activeGrab === grab || this.releaseTick)
      return;
    this.activeGrab = grab;
    this.grabTicks = 0;
  }
  cancelHold() {
    this.held = false;
    this.charge = 0;
  }
  step(pressed: boolean) {
    const release = this.held && !pressed;
    this.held = pressed;
    this.tick++;
    const j = this.j;
    this.lean +=
      ((this.braking ? this.steer * 0.6 : this.steer) - this.lean) * 0.13;
    if (this.phase === "crash" || this.phase === "recover") {
      this.speed = Math.max(
        j.speed * 0.3,
        this.speed * (this.phase === "crash" ? 0.963 : 0.99),
      );
      this.x += this.speed * dt;
      this.y = height(j, this.x);
      if (this.phase === "crash" && this.tick - this.contactTick >= 34) {
        this.phase = "recover";
        this.recoverTick = this.tick;
      }
      if (
        this.phase === "recover" &&
        this.tick - this.recoverTick >= (pressed ? 17 : 58)
      ) {
        this.phase = "land";
        this.angle = tangent(j, this.x);
      }
      return;
    }
    if (this.phase === "run") {
      const slope = j.trail
        ? Math.max(-0.06, Math.min(0.26, tangent(j, this.x) / 85))
        : 0;
      const target =
        j.speed *
        (1 +
          slope +
          (this.boostAt === undefined ? 0 : 0.48) -
          Math.abs(this.lean) * 0.11) *
        (this.braking ? 0.54 : 1);
      this.speed += (target - this.speed) * (this.braking ? 0.09 : 0.05);
      this.lateral = Math.max(
        -roadWidth(j, this.x) + 0.65,
        Math.min(
          roadWidth(j, this.x) - 0.65,
          this.lateral + this.lean * this.speed * dt * 0.36,
        ),
      );
      if (pressed) this.charge = Math.min(1, this.charge + dt * 2.8);
      this.x += this.speed * dt;
      for (
        let i = Math.max(0, this.gateIndex - 1);
        i < Math.min(this.gateIndex + 2, j.trail?.gates.length || 0);
        i++
      ) {
        if (Math.abs(this.x - j.trail!.gates[i] * j.lip) > 1.05) continue;
        for (const side of [-1, 1])
          if (
            Math.abs(this.lateral - gateOffset(j, i) - side * 2.05) < 0.68 &&
            !this.gateTouches.some(
              (touch) => touch.index === i && touch.side === side,
            )
          )
            this.gateTouches.push({ index: i, side, tick: this.tick });
      }
      const gate = j.trail?.gates[this.gateIndex];
      if (gate !== undefined && this.x >= gate * j.lip) {
        if (Math.abs(this.lateral - gateOffset(j, this.gateIndex)) < 2.45)
          this.gateHits++;
        this.gateIndex++;
      }
      this.manual =
        !j.showcase && release && this.x >= j.lip - 4 && this.charge > 0.05;
      const lip = this.x >= j.lip;
      if (lip) this.x = j.lip;
      this.y = height(j, this.x);
      this.angle = tangent(j, this.x - 0.005);
      if (this.manual || lip) {
        this.phase = "air";
        this.vy =
          -j.kick *
          (this.manual ? 0.77 + 0.27 * this.charge : this.auto ? 1 : 0.55);
        this.vy *= 1 + (this.speed / j.speed - 1) * 0.36;
        this.omega = 0;
        if (j.showcase) {
          this.targetYaw = j.showcase + (this.boostAt === undefined ? 0 : 180);
          const flight = Object.assign(Object.create(Ski.prototype), this, {
            predicting: true,
          }) as Ski;
          while (!flight.result) flight.step(false);
          this.flightTicks = flight.airTicks;
          this.landingX = flight.x;
        }
      }
      if (!pressed) this.charge = 0;
    } else if (this.phase === "air") {
      this.airTicks++;
      this.tuckAmount += ((pressed ? 1 : 0) - this.tuckAmount) * 0.2;
      this.tuckTicks = pressed
        ? this.tuckTicks + 1
        : j.showcase
          ? this.tuckTicks
          : 0;
      if (j.showcase && !this.predicting) {
        if (release && this.canReleaseShowcase && !this.releaseTick) {
          this.releaseTick = this.airTicks;
          this.releaseYaw = this.yaw;
        }
        if (this.releaseTick) {
          const remaining = Math.max(1, this.flightTicks - this.releaseTick);
          const progress = (this.airTicks - this.releaseTick) / remaining;
          this.yaw =
            this.releaseYaw +
            (this.targetYaw - this.releaseYaw) * (1 - (1 - progress) ** 2);
        } else if (pressed) {
          this.yaw = Math.min(
            this.targetYaw,
            this.yaw + this.targetYaw / (this.flightTicks * 0.56),
          );
        }
        const progress = this.airTicks / this.flightTicks;
        this.angle =
          -17 - 18 * Math.sin(Math.PI * progress) + 27 * progress ** 3;
        this.grabTicks = this.grabbing ? this.grabTicks + 1 : 0;
        if (
          this.grabTicks === 12 &&
          this.activeGrab &&
          !this.performedGrabs.includes(this.activeGrab)
        )
          this.performedGrabs.push(this.activeGrab);
      } else {
        this.omega +=
          ((pressed ? -240 : 0) - this.omega) * (pressed ? 0.1 : 0.17);
        this.angle += this.omega * dt;
        this.yaw = -this.angle;
      }
      if (this.grabbing && this.visualGrab !== this.activeGrab) {
        this.visualGrip *= 0.62;
        if (this.visualGrip < 0.12) this.visualGrab = this.activeGrab;
      } else {
        this.visualGrip += ((this.grabbing ? 1 : 0) - this.visualGrip) * 0.22;
      }
      // Limit swept distance and refine first contact on the terrain segment.
      const steps = Math.ceil(
          (Math.max(this.speed, Math.abs(this.vy) + 1) * dt) / 0.09,
        ),
        h = dt / steps;
      for (let i = 0; i < steps; i++) {
        const ox = this.x,
          oy = this.y;
        this.x += this.speed * h;
        this.y += this.vy * h + 7 * h * h;
        this.vy += 14 * h;
        if (this.vy > 0 && this.y >= height(j, this.x)) {
          let lo = 0,
            hi = 1;
          for (let k = 0; k < 12; k++) {
            const t = (lo + hi) / 2;
            if (oy + (this.y - oy) * t >= height(j, ox + (this.x - ox) * t))
              hi = t;
            else lo = t;
          }
          this.x = ox + (this.x - ox) * hi;
          this.y = height(j, this.x);
          this.landingAngle = tangent(j, this.x);
          this.contactTick = this.tick;
          this.result =
            j.showcase && !this.predicting
              ? judge(
                  this.landingAngle +
                    (this.canReleaseShowcase && this.yaw >= this.targetYaw * 0.9
                      ? -this.targetYaw + (this.releaseTick ? 0 : 22)
                      : 60),
                  this.landingAngle,
                  this.combo,
                )
              : judge(this.angle, this.landingAngle, this.combo);
          if (j.showcase && !this.predicting && this.result.grade !== "摔倒")
            this.result.score += this.performedGrabs.length * 60;
          if (this.result.grade !== "摔倒") this.angle = this.landingAngle;
          this.phase = this.result.grade === "摔倒" ? "crash" : "land";
          break;
        }
      }
    } else {
      this.speed +=
        (j.speed * (this.braking ? 0.56 : 1.07) - this.speed) * 0.035;
      this.x += this.speed * dt;
      this.y = height(j, this.x);
      this.angle = tangent(j, this.x);
      if (this.result) this.yaw = this.result.halves % 2 ? 180 : 0;
      this.lateral = Math.max(
        -roadWidth(j, this.x) + 0.65,
        Math.min(
          roadWidth(j, this.x) - 0.65,
          this.lateral + this.lean * this.speed * dt * 0.36,
        ),
      );
    }
  }
  get grabbing() {
    return (
      this.phase === "air" &&
      this.held &&
      this.tuckTicks >= 7 &&
      (!this.j.showcase || !this.releaseTick)
    );
  }
  get canReleaseShowcase() {
    return this.tuckTicks >= 32;
  }
  get releaseWindow() {
    return this.canReleaseShowcase && this.airTicks >= this.flightTicks * 0.52;
  }
  get airProgress() {
    return this.flightTicks ? this.airTicks / this.flightTicks : 0;
  }
  get spinTarget() {
    return this.phase === "run"
      ? (this.j.showcase || 0) + (this.boostAt === undefined ? 0 : 180)
      : this.targetYaw;
  }
}
