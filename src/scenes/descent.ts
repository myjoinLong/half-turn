import type { Jump } from "../content/routes";
import {
  gateOffset,
  height,
  roadCenter,
  roadWidth,
  sectionEnd,
  Ski,
} from "../sim/ski";
import { rider } from "./rider";

type Vec = [number, number, number];
type Point = [number, number];
type Surface = {
  center: number;
  half: number;
  y: number;
  jump: Jump;
  local: number;
};
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a: Vec): Vec => {
  const length = Math.hypot(...a);
  return [a[0] / length, a[1] / length, a[2] / length];
};
function polygon(c: CanvasRenderingContext2D, points: Point[], color: string) {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(...points[0]);
  for (const point of points.slice(1)) c.lineTo(...point);
  c.closePath();
  c.fill();
}
function line(
  c: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  color: string,
  width: number,
) {
  c.beginPath();
  c.moveTo(...start);
  c.lineTo(...end);
  c.lineWidth = width;
  c.strokeStyle = color;
  c.stroke();
}

export function drawDescent(
  c: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: Ski,
  jumps: Jump[],
  stage: number,
  wear: number[],
  lite: boolean,
  night: boolean,
  steady: boolean,
  cameraY: number,
) {
  const j = s.j;
  const span = sectionEnd(j);
  const upcoming = jumps[stage + 1];
  const previous = jumps[stage - 1];
  function surface(x: number): Surface {
    const next = x > span && upcoming;
    const last = x < 0 && previous;
    const jump = next || last || j;
    const local = next ? x - span : last ? x + sectionEnd(last) : x;
    const yOffset = next
      ? height(j, span) - height(next, 0)
      : last
        ? height(j, 0) - height(last, sectionEnd(last))
        : 0;
    return {
      center: roadCenter(jump, local),
      half: roadWidth(jump, local),
      y: height(jump, local) + yOffset,
      jump,
      local,
    };
  }
  const ground = surface(s.x);
  const boardZ = ground.center + s.lateral;
  const rush =
    s.boostAt !== undefined
      ? Math.min(1, Math.max(0, (s.speed / j.speed - 1) * 2))
      : 0;
  const air = s.phase === "air";
  const distance = 10 + rush * 3 + (air ? 4 : 0);
  const eye: Vec = [
    s.x - distance,
    cameraY - 5.8 - (air ? 0.9 : 0),
    boardZ + 6.6,
  ];
  const nextGround = surface(s.x + 24);
  const yawBias = steady ? 0 : s.lean * 0.72;
  const forward = unit([
    distance + 20,
    (air ? 3.6 : Math.max(3, Math.min(10, nextGround.y - cameraY + 4))) + 5.8,
    nextGround.center - eye[2] - 3.3 + yawBias,
  ]);
  const right = unit([-forward[2], 0, forward[0]]);
  const down: Vec = [
    -right[2] * forward[1],
    right[2] * forward[0] - right[0] * forward[2],
    right[0] * forward[1],
  ];
  const focal = Math.min(w * 1.08, h * 0.8) * (1 - rush * 0.1);
  function project(x: number, y: number, z: number): Point {
    const v: Vec = [x - eye[0], y - eye[1], z - eye[2]];
    const scale = focal / Math.max(0.8, dot(v, forward));
    return [w * 0.57 + dot(v, right) * scale, h * 0.39 + dot(v, down) * scale];
  }
  const start = s.x - distance + 2.2;
  const bands = [start];
  let cursor = start;
  while (cursor < s.x + 223) {
    cursor += cursor < s.x + 52 ? 1.45 : 3.8;
    bands.push(cursor);
  }
  if (j.lip > start && j.lip < cursor)
    bands.push(j.lip - 0.035, j.lip, j.lip + 0.06);
  bands.sort((a, b) => a - b);
  const ribbon = (x: number, p: Surface, offset: number) =>
    project(x, p.y, p.center + p.half * offset);
  const foreground = surface(start);
  const nearLeft = ribbon(start, foreground, -2.8),
    nearRight = ribbon(start, foreground, 2.8);
  polygon(
    c,
    [
      nearLeft,
      nearRight,
      [Math.max(w, nearRight[0]), h],
      [Math.min(0, nearLeft[0]), h],
    ],
    night ? "#a1bdd2" : "#b6d2d3",
  );
  const nightSnow = night
    ? ["#9bb8d2", "#b2cbe1", "#c0d6e6"]
    : ["#bfd9dd", "#d7e8e6", "#ecf1de"];
  for (let i = bands.length - 1; i > 0; i--) {
    const a = bands[i - 1],
      b = bands[i],
      p = surface(a),
      q = surface(b);
    const altitudeShift = Math.max(
      -2,
      Math.min(3, ((q.y - p.y) / (b - a)) * 2),
    );
    const snow =
      nightSnow[altitudeShift > 1 ? 0 : altitudeShift < -0.2 ? 2 : 1];
    polygon(
      c,
      [
        ribbon(a, p, -2.8),
        ribbon(b, q, -2.8),
        ribbon(b, q, 2.8),
        ribbon(a, p, 2.8),
      ],
      night ? "#53728e" : "#92afb0",
    );
    polygon(
      c,
      [ribbon(a, p, -1), ribbon(b, q, -1), ribbon(b, q, 1), ribbon(a, p, 1)],
      snow,
    );
    c.strokeStyle = snow;
    c.lineWidth = 0.65;
    c.stroke();
    polygon(
      c,
      [
        ribbon(a, p, -1),
        ribbon(b, q, -1),
        ribbon(b, q, -0.87),
        ribbon(a, p, -0.87),
      ],
      night ? "#7196b8" : "#acc9ca",
    );
    polygon(
      c,
      [
        ribbon(a, p, 0.86),
        ribbon(b, q, 0.86),
        ribbon(b, q, 1),
        ribbon(a, p, 1),
      ],
      night ? "#dce8f3" : "#fcf6df",
    );
    if (p.local < p.jump.lip && p.local > p.jump.lip - 5)
      polygon(
        c,
        [ribbon(a, p, -1), ribbon(b, q, -1), ribbon(b, q, 1), ribbon(a, p, 1)],
        "#faa651",
      );
  }
  const gatePole = (x: number, z: number, y: number, flag: string) => {
    const top = project(x, y - 2.45, z),
      foot = project(x, y, z);
    line(
      c,
      top,
      foot,
      "#293e57",
      Math.max(1, Math.abs(top[1] - foot[1]) * 0.065),
    );
    polygon(
      c,
      [
        top,
        project(x, y - 2.34, z + 1.05),
        project(x, y - 1.72, z + 0.79),
        project(x, y - 1.52, z),
      ],
      flag,
    );
  };
  for (let i = 0; i < (j.trail?.gates.length || 0); i++) {
    const x = j.trail!.gates[i] * j.lip;
    if (x < start || x > s.x + 142) continue;
    const gate = surface(x),
      z = gate.center + gateOffset(j, i);
    const flag = i < s.gateIndex ? "#83bead" : i % 2 ? "#ee8063" : "#40c8bd";
    gatePole(x, z - 2.05, gate.y, flag);
    gatePole(x, z + 2.05, gate.y, flag);
    line(
      c,
      project(x, gate.y - 0.05, z - 2),
      project(x, gate.y - 0.05, z + 2),
      flag,
      2,
    );
  }
  if (j.lip >= start && j.lip < s.x + 150) {
    gatePole(j.lip, roadWidth(j, j.lip) - 0.4, height(j, j.lip), "#ef8951");
    gatePole(j.lip, -roadWidth(j, j.lip) + 0.4, height(j, j.lip), "#ef8951");
  }
  for (let k = Math.floor((s.x + 146) / 8); k * 8 > start + 2; k--) {
    const x = k * 8,
      p = surface(x),
      seed = Math.abs(Math.sin(k * 54.1));
    const stripe = seed * 1.35 - 0.65;
    const cx = p.center + stripe * p.half;
    line(
      c,
      project(x, p.y - 0.04, cx),
      project(x + 1.35, surface(x + 1.35).y - 0.04, cx),
      "#8caead",
      0.7,
    );
    for (const side of [-1, 1]) {
      const z = p.center + side * (p.half + 2 + seed * 6);
      const base = project(x, p.y, z),
        top = project(x, p.y - 3.5 - seed * 5, z);
      const wide = Math.min(25, Math.abs(base[1] - top[1]) * 0.29);
      polygon(
        c,
        [
          top,
          [base[0] + wide * 0.54, top[1] + (base[1] - top[1]) * 0.6],
          [base[0] + wide, base[1]],
          [base[0] - wide, base[1]],
        ],
        night ? "#26435a" : "#2f635a",
      );
      polygon(
        c,
        [top, [base[0] - wide, base[1]], [base[0], base[1] - wide * 0.2]],
        night ? "#3d6076" : "#4a8272",
      );
    }
  }
  if (air && s.landingX > s.x) {
    const p = surface(s.landingX),
      [x, y] = project(s.landingX, p.y - 0.12, p.center + s.lateral);
    const mark: Point = [
      Math.max(28, Math.min(w - 28, x)),
      Math.max(52, Math.min(h - 23, y)),
    ];
    line(c, [mark[0] - 7, mark[1] - 4], mark, "#ec7546", 2);
    line(c, mark, [mark[0] + 7, mark[1] - 4], "#ec7546", 2);
  }
  const feet = project(s.x, s.y, boardZ),
    shadow = project(s.x, ground.y - 0.12, boardZ);
  c.fillStyle = "#172f4749";
  c.beginPath();
  c.ellipse(shadow[0], shadow[1], 12, 4, 0, 0, 7);
  c.fill();
  const airborne = air
    ? j.showcase
      ? s.airProgress
      : Math.min(1, s.airTicks / 100)
    : 0;
  const radians = Math.PI / 180;
  const tumble = Math.max(0, Math.min(1, (s.tick - s.contactTick) / 34));
  const lastHeading = s.yaw % 360;
  const slideHeading = ((lastHeading + 540) % 360) - 180;
  const edgeAngle =
    s.braking && !air ? (Math.sign(s.lean) || 1) * 0.52 : s.lean * 0.26;
  const yaw =
    (air
      ? s.yaw
      : s.phase === "crash"
        ? slideHeading * (1 - tumble) + 38 * tumble
        : s.phase === "recover"
          ? 38 * Math.max(0, 1 - (s.tick - s.recoverTick) / 25)
          : s.phase === "land" &&
              s.result?.grade !== "摔倒" &&
              s.result?.halves &&
              s.result.halves % 2
            ? 180
            : 0) *
      radians +
    edgeAngle;
  const pitch =
    (air
      ? -5 + s.vy * 0.43
      : s.phase === "crash" || s.phase === "recover"
        ? s.landingAngle
        : s.angle) * radians;
  const roll =
    s.phase === "crash"
      ? Math.sin(tumble * Math.PI * 0.9) * 1.55
      : s.phase === "recover"
        ? Math.max(0, 1 - (s.tick - s.recoverTick) / 28) * 0.95
        : s.lean * 0.42 +
          (air ? Math.sin(airborne * Math.PI) * s.tuckAmount * 0.23 : 0);
  const vertical = cameraScale(project, s.x, s.y, boardZ);
  rider(c, feet[0], feet[1], vertical, s, wear, ([advance, up], side) => {
    const x = advance * 0.043,
      y = up * 0.043,
      z = side * 0.043;
    const yy = y * Math.cos(roll) - z * Math.sin(roll);
    const zz = y * Math.sin(roll) + z * Math.cos(roll);
    const xx = x * Math.cos(pitch) - yy * Math.sin(pitch);
    const dy = x * Math.sin(pitch) + yy * Math.cos(pitch);
    return project(
      s.x + xx * Math.cos(yaw) - zz * Math.sin(yaw),
      s.y + dy,
      boardZ + xx * Math.sin(yaw) + zz * Math.cos(yaw),
    );
  });

  const intensity = Math.min(1, Math.max(rush, (s.speed - 16) / 18));
  if (s.tick && (!air || rush > 0) && !lite) {
    for (let i = 0; i < 22; i++) {
      const f = (i * 0.381 + s.tick * (0.008 + 0.012 * intensity)) % 1;
      const edge = i % 2 ? -1 : 1;
      const x = w * (0.5 + f * 0.61 * edge),
        y = h * (0.37 + f * (0.25 + (i % 6) * 0.075));
      line(
        c,
        [x, y],
        [x + edge * (6 + intensity * 18) * f, y + (8 + intensity * 19) * f],
        "rgba(236,250,255," + intensity * 0.52 * f + ")",
        rush > 0.35 ? 1.8 : 0.8,
      );
    }
  }
  if (!air && s.tick) {
    const powder =
      s.braking || s.phase === "crash" ? 1 : 0.4 + intensity * 0.45;
    for (let i = 0; i < (lite ? 12 : 32); i++) {
      const f = (i * 0.381 + s.tick * 0.045) % 1,
        d = Math.sin(i * 53.1);
      const px = feet[0] + f * d * 51 * powder,
        py = feet[1] + f * 22 - f * (1 - f) * 61 * powder;
      c.fillStyle = "rgba(244,252,255," + (1 - f) * powder + ")";
      c.fillRect(px, py, 1 + f * 4, 1 + f * 3);
    }
  }
}
function cameraScale(
  project: (x: number, y: number, z: number) => Point,
  x: number,
  y: number,
  z: number,
) {
  return Math.max(
    0.48,
    Math.abs(project(x, y - 1, z)[1] - project(x, y, z)[1]) * 0.043,
  );
}
