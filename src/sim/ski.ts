import type { Jump } from "../content/routes";
export const simVersion = 1,
  courseVersion = 1,
  dt = 1 / 60;
export function height(j: Jump, x: number) {
  const z = x - j.lip;
  if (z < -5) return -1.1 + (z + 5) * 0.09;
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
  yaw = 0;
  landingAngle = 0;
  landingX = 0;
  contactTick = 0;
  private flightTicks = 0;
  private releaseTick = 0;
  private releaseYaw = 0;
  manual = false;
  phase: "run" | "air" | "land" | "crash" = "run";
  result?: Result;
  constructor(
    public j: Jump,
    public auto = false,
    public combo = 0,
  ) {
    this.y = height(j, 0);
    this.angle = tangent(j, 0);
  }
  step(pressed: boolean) {
    if (this.phase === "crash") return;
    const release = this.held && !pressed;
    this.held = pressed;
    this.tick++;
    const j = this.j;
    if (this.phase === "run") {
      if (pressed) this.charge = Math.min(1, this.charge + dt * 2.8);
      this.x += j.speed * dt;
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
        this.omega = 0;
        if (j.showcase) {
          const flight = Object.assign(Object.create(Ski.prototype), this, {
            j: { ...j, showcase: undefined },
          }) as Ski;
          while (!flight.result) flight.step(false);
          this.flightTicks = flight.airTicks;
          this.landingX = flight.x;
        }
      }
      if (!pressed) this.charge = 0;
    } else if (this.phase === "air") {
      this.airTicks++;
      this.tuckTicks = pressed
        ? this.tuckTicks + 1
        : j.showcase
          ? this.tuckTicks
          : 0;
      if (j.showcase) {
        if (release && this.canReleaseShowcase && !this.releaseTick) {
          this.releaseTick = this.airTicks;
          this.releaseYaw = this.yaw;
        }
        if (this.releaseTick) {
          const remaining = Math.max(1, this.flightTicks - this.releaseTick);
          const progress = (this.airTicks - this.releaseTick) / remaining;
          this.yaw =
            this.releaseYaw +
            (j.showcase - this.releaseYaw) * (1 - (1 - progress) ** 2);
        } else if (pressed) {
          this.yaw = Math.min(
            j.showcase,
            this.yaw + j.showcase / (this.flightTicks * 0.56),
          );
        }
        this.angle =
          -12 - 22 * Math.sin((Math.PI * this.airTicks) / this.flightTicks);
      } else {
        this.omega +=
          ((pressed ? -240 : 0) - this.omega) * (pressed ? 0.1 : 0.17);
        this.angle += this.omega * dt;
      }
      // Limit swept distance and refine first contact on the terrain segment.
      const steps = Math.ceil(
          (Math.max(j.speed, Math.abs(this.vy) + 1) * dt) / 0.09,
        ),
        h = dt / steps;
      for (let i = 0; i < steps; i++) {
        const ox = this.x,
          oy = this.y;
        this.x += j.speed * h;
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
          this.result = j.showcase
            ? judge(
                this.landingAngle +
                  (this.canReleaseShowcase && this.yaw >= j.showcase * .9
                    ? -j.showcase + (this.releaseTick ? 0 : 22)
                    : 60),
                this.landingAngle,
                this.combo,
              )
            : judge(this.angle, this.landingAngle, this.combo);
          if (this.result.grade !== "摔倒") this.angle = this.landingAngle;
          this.phase = this.result.grade === "摔倒" ? "crash" : "land";
          break;
        }
      }
    } else {
      this.x += j.speed * dt;
      this.y = height(j, this.x);
      this.angle = tangent(j, this.x);
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
}
