import { boardGear, trailGear } from "../content/gear";
import { height, roadCenter, type Ski } from "../sim/ski";
import type { P2, V3 } from "./geometry";
import { paintFlake, trailAppearance } from "./trail-art";

type Flake = {
  point: V3;
  velocity: V3;
  birth: number;
  life: number;
  size: number;
  seed: number;
  style: number;
  edgeLight?: string;
};
type Mark = { point: V3; tick: number; edge: number; style: number };
type Projection = (point: V3) => { screen: P2; scale: number } | null;

function random(seed: number) {
  const value = Math.imul(seed ^ (seed >>> 7), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

export class SnowEffects {
  readonly flakes: Flake[] = [];
  readonly marks: Mark[] = [];
  readonly ribbons: {
    point: V3;
    tick: number;
    style: number;
    air: boolean;
    fever: boolean;
    boost: boolean;
  }[] = [];
  private tick = 0;

  record(s: Ski, wear: number[], lite: boolean) {
    if (s.tick <= this.tick) return;
    this.tick = s.tick;
    const air = s.phase === "air";
    const touched = s.contactTick === s.tick && !!s.result;
    const crash = s.phase === "crash" || s.phase === "recover";
    const launched = air && s.airTicks === 0;
    const surged = !air && s.boostAt === s.tick - 1;
    const sampled = !air && s.tick % (lite ? 5 : 3) === 0;
    const edge = s.braking ? 1 : Math.abs(s.lean) * 0.72;
    const style = crash || !trailGear[wear[2]] ? 0 : wear[2];
    const look = trailAppearance(style);
    const z = roadCenter(s.j, s.x) + s.lateral;
    if (!lite && !crash && s.tick % 2 === 0) {
      const yPos = air ? s.y - 0.06 : height(s.j, s.x) - 0.09;
      this.ribbons.push({
        point: [s.x, yPos, z],
        tick: s.tick,
        style,
        air,
        fever: Boolean((s as { fever?: boolean }).fever),
        boost: s.boostAt !== undefined,
      });
      if (this.ribbons.length > 26) this.ribbons.shift();
    }
    if (
      air &&
      !lite &&
      s.airTicks > 4 &&
      s.tick % 6 === 0 &&
      s.tuckAmount > 0.38 &&
      (look.shape === "ribbon" ||
        look.shape === "spark" ||
        look.shape === "fog")
    ) {
      const turn = (s.yaw * Math.PI) / 180;
      this.flakes.push({
        point: [
          Math.max(0, s.x - 0.52 * Math.cos(turn)),
          s.y - 0.06,
          z - 0.35 * Math.sin(turn),
        ],
        velocity: [s.speed * 0.78, -0.44, Math.cos(turn) * 0.84],
        birth: s.tick,
        life: Math.round(look.life * 0.76),
        size: 0.115 * look.size,
        seed: s.tick,
        style,
      });
    }
    if (sampled && s.phase !== "recover") {
      const mark: Mark = {
        point: [s.x, height(s.j, s.x) - 0.045, z],
        tick: s.tick,
        edge,
        style,
      };
      this.marks.push(mark);
      if (this.marks.length > 26) this.marks.shift();
    }
    if (touched || launched || surged || sampled) {
      const pulse = touched
        ? crash
          ? 1.37
          : 1.17
        : launched
          ? 0.86
          : surged
            ? 1
            : edge * 0.75 + 0.25;
      let count = lite ? 1 : 2;
      if (edge > 0.28 || crash) count = lite ? 2 : style === 0 ? 5 : 7;
      if (launched || surged) count = lite ? 4 : 9;
      if (touched) count = lite ? 9 : 21;
      const light = boardGear[wear[0]]?.accent;
      for (let i = 0; i < count; i++) {
        const seed = s.tick * 37 + i * 73;
        const drift = random(seed + 31) * 2 - 1;
        const x = Math.max(0, s.x - 0.1 - random(seed + 104) * 0.82);
        const side = (Math.sign(s.lean) || (s.braking ? 1 : 0)) * edge * 1.8;
        this.flakes.push({
          point: [x, height(s.j, x) - 0.08, z + drift * (0.16 + pulse * 0.24)],
          velocity: [
            s.speed * (0.24 + random(seed + 67) * 0.45),
            -(random(seed + 2) * 1.4 + 0.55) * (pulse + 0.42) * look.lift,
            (drift * (1.08 + pulse * 2.8) - side) * look.spread,
          ],
          birth: s.tick,
          life: look.life + Math.floor(random(seed + 251) * 10),
          size:
            (0.065 + random(seed + 613) * 0.09) *
            look.size *
            (0.85 + pulse * 0.36),
          seed,
          style,
          edgeLight:
            !lite &&
            !crash &&
            i % 7 === 0 &&
            (launched || surged || edge > 0.65)
              ? light
              : undefined,
        });
      }
    }
    if (s.tick % 8 === 0) {
      for (let i = this.flakes.length - 1; i >= 0; i--) {
        const flake = this.flakes[i];
        if (s.tick >= flake.birth + flake.life) this.flakes.splice(i, 1);
      }
    }
    const cap = lite ? 30 : 82;
    if (this.flakes.length > cap)
      this.flakes.splice(0, this.flakes.length - cap);
  }

  draw(
    c: CanvasRenderingContext2D,
    project: Projection,
    ground: (x: number) => number,
    night: boolean,
    lite: boolean,
  ) {
    c.save();
    c.lineCap = "butt";
    for (let i = 1; i < this.marks.length; i++) {
      const a = this.marks[i - 1],
        b = this.marks[i];
      const age = 1 - (this.tick - b.tick) / 65;
      if (b.tick - a.tick > 6 || age <= 0) continue;
      const start = project(a.point),
        end = project(b.point);
      if (!start || !end) continue;
      c.beginPath();
      c.moveTo(...start.screen);
      c.lineTo(...end.screen);
      c.lineWidth = Math.min(3.8, end.scale * (0.075 + b.edge * 0.07));
      c.strokeStyle = night ? "#334f69" : "#537d8a";
      c.globalAlpha = age * (0.16 + 0.14 * b.edge);
      c.stroke();
      const trail = trailAppearance(b.style);
      if (!lite && trail.shape === "ribbon") {
        const colors = [trailGear[b.style].accent, trailGear[b.style].color];
        for (const side of [-1, 1]) {
          const drift = ({ point: [x, y, z], tick }: Mark): V3 => [
            x,
            y,
            z + side * (0.12 + 0.077 * Math.sin(tick * 0.21)),
          ];
          const near = project(drift(a));
          const far = project(drift(b));
          if (!near || !far) continue;
          c.beginPath();
          c.moveTo(...near.screen);
          c.lineTo(...far.screen);
          c.lineWidth = Math.min(2.5, far.scale * (0.04 + 0.04 * b.edge));
          c.strokeStyle = colors[(side + 1) / 2];
          c.globalAlpha = age * (0.38 + b.edge * 0.22);
          c.stroke();
        }
      } else if (!lite && trail.wake) {
        c.lineWidth *= 0.59;
        c.strokeStyle = trailGear[b.style].accent;
        c.globalAlpha = age * trail.wake * (0.57 + b.edge * 0.43);
        c.stroke();
      }
    }
    c.globalAlpha = 1;
    const first = lite ? Math.max(0, this.flakes.length - 30) : 0;
    for (let i = first; i < this.flakes.length; i++) {
      const f = this.flakes[i];
      const age = this.tick - f.birth;
      if (age >= f.life) continue;
      const seconds = age / 60;
      const [x, y, z] = f.point.map(
        (value, axis) => value + f.velocity[axis] * seconds,
      ) as V3;
      const drop = y + 4.4 * seconds * seconds;
      const surface = ground(x);
      const at = project([x, Math.min(surface - 0.035, drop), z]);
      if (!at) continue;
      const [px, py] = at.screen;
      const fade = (1 - age / f.life) ** 1.4 * (drop > surface ? 0.55 : 1);
      const radius = Math.min(10, at.scale * f.size * (1 + seconds * 0.7));
      paintFlake(
        c,
        f.style,
        px,
        py,
        radius,
        f.seed,
        fade,
        -0.26 + f.velocity[2] * 0.11 + seconds * 0.25,
      );
      if (f.edgeLight && age < 9) {
        c.globalAlpha = fade * 0.67 * (1 - age / 9);
        c.fillStyle = f.edgeLight;
        c.beginPath();
        c.ellipse(
          px,
          py,
          Math.min(4, radius * 0.57),
          Math.min(2, radius * 0.27),
          -0.19,
          0,
          Math.PI * 2,
        );
        c.fill();
        c.globalAlpha = 1;
      }
    }
    // Continuous luminous twin speed ribbons (ground + mid-air!) inspired by extreme downhill racing
    if (!lite && this.ribbons.length > 1) {
      c.lineCap = "round";
      c.lineJoin = "round";
      for (let i = 1; i < this.ribbons.length; i++) {
        const a = this.ribbons[i - 1];
        const b = this.ribbons[i];
        if (b.tick - a.tick > 6) continue;
        const active = b.style > 0 || b.air || b.fever || b.boost;
        if (!active) continue;
        const age = 1 - (this.tick - b.tick) / 52;
        if (age <= 0) continue;
        const t = i / this.ribbons.length;
        const glowCol = b.fever
          ? "#5efce8"
          : b.style > 0
            ? trailGear[b.style].accent
            : b.boost
              ? "#ffbe6b"
              : "#8ce8ff";
        const coreCol = b.fever
          ? "#eafffc"
          : b.style > 0
            ? trailGear[b.style].color
            : "#f2fcff";
        for (const side of [-1, 1]) {
          const offset = side * (b.air ? 0.28 : 0.23);
          const p0 = project([a.point[0], a.point[1], a.point[2] + offset]);
          const p1 = project([b.point[0], b.point[1], b.point[2] + offset]);
          if (!p0 || !p1) continue;
          const width = Math.min(8.5, Math.max(1.8, p1.scale * 0.14 * t));
          // Outer soft neon glow
          c.beginPath();
          c.moveTo(...p0.screen);
          c.lineTo(...p1.screen);
          c.strokeStyle = glowCol;
          c.lineWidth = width * 2.1;
          c.globalAlpha = age * t * (night ? 0.42 : 0.34);
          c.stroke();
          // Razor-sharp bright inner laser core
          c.beginPath();
          c.moveTo(...p0.screen);
          c.lineTo(...p1.screen);
          c.strokeStyle = coreCol;
          c.lineWidth = Math.max(1.1, width * 0.65);
          c.globalAlpha = age * t * (night ? 0.88 : 0.78);
          c.stroke();
        }
      }
      c.globalAlpha = 1;
    }
    c.restore();
  }
}
