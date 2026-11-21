export type RidePhase = "run" | "air" | "land" | "crash" | "recover";
type Motion = { steer: number; brake: boolean; boost: boolean; grab: number };
export class RideGesture {
  private originX = 0;
  private originY = 0;
  private lastX = 0;
  private lastY = 0;
  private phase: RidePhase = "run";
  private brake = false;
  private boostSent = false;

  start(x: number, y: number, phase: RidePhase) {
    this.originX = this.lastX = x;
    this.originY = this.lastY = y;
    this.phase = phase;
    this.brake = false;
    this.boostSent = false;
  }
  move(x: number, y: number, phase: RidePhase, canGrab: boolean): Motion {
    if (this.phase !== phase) {
      this.originX = this.lastX;
      this.originY = this.lastY;
      this.phase = phase;
      this.brake = false;
    }
    const dx = x - this.originX,
      dy = y - this.originY;
    this.lastX = x;
    this.lastY = y;
    const result: Motion = { steer: 0, brake: false, boost: false, grab: 0 };
    if (phase === "air") {
      if (canGrab && Math.abs(dx) >= 38 && Math.abs(dx) >= Math.abs(dy) * 0.9) {
        result.grab = Math.sign(dx);
        this.originX = x;
        this.originY = y;
      }
    } else if (phase === "run" || phase === "land") {
      const amount = Math.max(0, Math.abs(dx) - 6);
      result.steer =
        Math.round(Math.sign(dx) * Math.min(1, amount / 52) * 10) / 10;
      if (this.brake) this.brake = dy > 12;
      else this.brake = dy >= 22 && dy >= Math.abs(dx) * 0.52;
      result.brake = this.brake;
      result.boost =
        phase === "run" &&
        !this.boostSent &&
        dy <= -34 &&
        -dy > Math.abs(dx) * 1.32;
      if (result.boost) this.boostSent = true;
    }
    return result;
  }
}
