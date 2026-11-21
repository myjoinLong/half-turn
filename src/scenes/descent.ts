import type { Jump } from "../content/routes";
import {
  gateOffset,
  height,
  roadCenter,
  roadWidth,
  sectionEnd,
  Ski,
} from "../sim/ski";
import { buildRider } from "./rider";
import { nearClip, near, paintFaces, placeAboveSnow } from "./geometry";
import { clipTree, visibleTreeHeight } from "./forest";
import { visibleSnowRuns } from "./snow";

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
  const priorLength = previous ? sectionEnd(previous) : 0;
  const nextHeight = upcoming ? height(j, span) - height(upcoming, 0) : 0;
  const priorHeight = previous
    ? height(j, 0) - height(previous, priorLength)
    : 0;
  function snowHeight(x: number) {
    if (x > span && upcoming) return height(upcoming, x - span) + nextHeight;
    if (x < 0 && previous)
      return height(previous, x + priorLength) + priorHeight;
    return height(j, x);
  }
  function surface(x: number): Surface {
    const next = x > span && upcoming;
    const last = x < 0 && previous;
    const jump = next || last || j;
    const local = next ? x - span : last ? x + priorLength : x;
    return {
      center: roadCenter(jump, local),
      half: roadWidth(jump, local),
      y: snowHeight(x),
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
  const distance = 9.6 + rush * 2.2 + (air ? 1.1 : 0);
  const cameraX = s.x - distance;
  const eye: Vec = [
    cameraX,
    Math.min(cameraY - 5.8 - (air ? 0.9 : 0), snowHeight(cameraX) - 2.6),
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
  function camera([x, y, z]: Vec): Vec {
    const v: Vec = [x - eye[0], y - eye[1], z - eye[2]];
    return [-dot(v, right), dot(v, down), dot(v, forward)];
  }
  function screen([x, y, z]: Vec): Point {
    const scale = focal / z;
    return [w * 0.57 - x * scale, h * 0.39 + y * scale];
  }
  function project(x: number, y: number, z: number): Point {
    const view = camera([x, y, z]);
    view[2] = Math.max(near, view[2]);
    return screen(view);
  }
  function worldPoly(vertices: Vec[], color: string) {
    const visible = nearClip(vertices.map(camera));
    if (visible.length < 3) return;
    polygon(c, visible.map(screen), color);
  }
  function worldLine(a: Vec, b: Vec, color: string, width: number) {
    let p = camera(a),
      q = camera(b);
    if (p[2] < near && q[2] < near) return;
    if (q[2] < near) [p, q] = [q, p];
    if (p[2] < near) {
      const t = (near - p[2]) / (q[2] - p[2]);
      p = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, near];
    }
    line(c, screen(p), screen(q), color, width);
  }
  const start = eye[0] - 2.6;
  const bands = [start];
  let cursor = start;
  while (cursor < s.x + 223) {
    cursor += cursor < s.x + 52 ? 1.45 : 3.8;
    bands.push(cursor);
  }
  const terrainBreaks = [0, span];
  const takeoffs: number[] = [];
  for (const [offset, jump] of [
    [-priorLength, previous],
    [0, j],
    [span, upcoming],
  ] as const) {
    if (jump) {
      takeoffs.push(offset + jump.lip);
      terrainBreaks.push(
        offset + jump.lip - (jump.showcase ? 9 : 5),
        offset + jump.lip,
        offset + jump.lip + (jump.showcase ? 15 : 5),
      );
    }
  }
  for (const position of terrainBreaks)
    if (position > start && position < cursor) bands.push(position);
  for (const lip of takeoffs)
    for (const mark of [lip - 3.6, lip - 0.52, lip - 0.14])
      if (mark > start && mark < cursor) bands.push(mark);
  bands.sort((a, b) => a - b);
  const ribbon = (x: number, p: Surface, offset: number): Vec => [
    x,
    p.y,
    p.center + p.half * offset,
  ];
  const bank = c.createLinearGradient(0, h * 0.24, w * 0.21, h);
  bank.addColorStop(0, night ? "#a5c0d8" : "#c5d8d8");
  bank.addColorStop(1, night ? "#8caccc" : "#acc9ca");
  const piste = c.createLinearGradient(w * 0.74, h * 0.21, 0, h);
  piste.addColorStop(0, night ? "#e2f0fc" : "#f6f8ec");
  piste.addColorStop(1, night ? "#a8c8e7" : "#c9e0de");
  const surfaces = bands.map(surface);
  const snowEdges = bands.map((x, i) => {
    const p = surfaces[i];
    return {
      x,
      y: p.y,
      left: p.center - p.half * 2.8,
      right: p.center + p.half * 2.8,
    };
  });
  function paintRibbon(
    first: number,
    last: number,
    left: number,
    right: number,
    fill: CanvasGradient | string,
  ) {
    if (first >= last) return;
    c.beginPath();
    for (let i = first + 1; i <= last; i++) {
      const a = bands[i - 1],
        b = bands[i],
        p = surfaces[i - 1],
        q = surfaces[i];
      const face = [
        ribbon(a, p, left),
        ribbon(b, q, left),
        ribbon(b, q, right),
        ribbon(a, p, right),
      ];
      const points = nearClip(face.map(camera)).map(screen);
      if (points.length < 3) continue;
      // Neighboring strips share an edge in one fill, so antialiasing never strokes the mesh grid.
      c.moveTo(...points[0]);
      for (const point of points.slice(1)) c.lineTo(...point);
      c.closePath();
    }
    c.fillStyle = fill;
    c.fill();
  }
  for (const [first, last] of visibleSnowRuns(
    snowEdges,
    eye[0],
    eye[1],
  ).reverse()) {
    paintRibbon(first, last, -2.8, 2.8, bank);
    paintRibbon(first, last, -1, 1, piste);
    for (const lip of takeoffs) {
      if (bands[last] < lip - 3.6 || bands[first] > lip - 0.14) continue;
      const begin = bands.findIndex((x) => x >= lip - 3.6);
      const stripe = bands.findIndex((x) => x >= lip - 0.52);
      const end = bands.findIndex((x) => x >= lip - 0.14);
      if (begin < 0 || stripe < 0 || end < 0) continue;
      paintRibbon(
        Math.max(first, begin),
        Math.min(last, stripe),
        -0.99,
        -0.9,
        "#e4a661",
      );
      paintRibbon(
        Math.max(first, begin),
        Math.min(last, stripe),
        0.9,
        0.99,
        "#e4a661",
      );
      paintRibbon(
        Math.max(first, stripe),
        Math.min(last, end),
        -0.99,
        0.99,
        "#f4b362",
      );
    }
  }

  const objects: { depth: number; draw: () => void }[] = [];
  const atDepth = (position: Vec, draw: () => void) => {
    const depth = camera(position)[2];
    if (depth > near) objects.push({ depth, draw });
  };
  function gatePole(
    x: number,
    z: number,
    y: number,
    flag: string,
    bend = 0,
    side = 0,
  ) {
    atDepth([x, y - 1, z], () => {
      const foot: Vec = [x, y + 0.035, z];
      const top: Vec = [
        x + bend * 1.3,
        y - 2.45 + bend * 0.8,
        z + side * bend * 1.25,
      ];
      worldLine(
        foot,
        top,
        "#293e57",
        Math.max(1, Math.min(7, 12 / camera(foot)[2])),
      );
      worldPoly(
        [
          top,
          [top[0], top[1] + 0.1, top[2] + 1.05],
          [top[0], top[1] + 0.64, top[2] + 0.79],
          [top[0], top[1] + 0.84, top[2]],
        ],
        flag,
      );
    });
  }
  const stages = [
    [previous, -priorLength],
    [j, 0],
    [upcoming, span],
  ] as const;
  for (const [jump, offset] of stages) {
    if (!jump) continue;
    for (const [index, gate] of (jump.trail?.gates || []).entries()) {
      const x = offset + gate * jump.lip;
      if (x < start || x > s.x + 142) continue;
      const road = surface(x);
      const center = road.center + gateOffset(jump, index);
      const flag =
        jump === j && index < s.gateIndex
          ? "#83bead"
          : index % 2
            ? "#ee8063"
            : "#40c8bd";
      for (const side of [-1, 1]) {
        const touch =
          jump === j
            ? s.gateTouches.find((t) => t.index === index && t.side === side)
            : undefined;
        const bend = touch ? Math.max(0, 1 - (s.tick - touch.tick) / 36) : 0;
        const z = center + side * 2.05;
        gatePole(x, z, road.y, flag, bend, side);
      }
      worldLine(
        [x, road.y - 0.045, center - 2],
        [x, road.y - 0.045, center + 2],
        flag,
        2,
      );
    }
    const lip = offset + jump.lip;
    if (lip >= start && lip < s.x + 150) {
      const road = surface(lip);
      for (const side of [-1, 1])
        gatePole(
          lip,
          road.center + side * (road.half - 0.35),
          road.y,
          "#ef8951",
        );
    }
  }

  const passed = jumps
    .slice(0, stage)
    .reduce((sum, jump) => sum + sectionEnd(jump), 0);
  for (
    let k = Math.floor((s.x + passed + 146) / 8);
    k * 8 > start + passed + 2;
    k--
  ) {
    const x = k * 8 - passed,
      road = surface(x),
      seed = Math.abs(Math.sin(k * 54.1));
    for (const side of [-1, 1]) {
      // Keep the full crown outside the riding line, the chase camera and kicker shoulders.
      const takeoff = road.jump.lip;
      if (
        road.local >= takeoff - 13 &&
        road.local <= takeoff + (road.jump.showcase ? 19 : 9)
      )
        continue;
      const treeY = road.y;
      const size = 4 + seed * 4.8;
      const edge = Math.max(
        ...[surface(x - size * 0.24), road, surface(x + size * 0.24)].map(
          (p) => side * p.center + p.half,
        ),
      );
      const lateral = side * (edge + (side === 1 ? 12 : 6) + seed * 7);
      const cameraDistance = Math.hypot(x - eye[0], lateral - eye[2]);
      if (x < eye[0] + 3.5 || cameraDistance < 5.8) continue;
      const screenTop = project(x, treeY - size, lateral);
      const screenBase = project(x, treeY, lateral);
      const screenRadius = Math.abs(screenBase[1] - screenTop[1]) * 0.46;
      if (
        Math.min(screenTop[0], screenBase[0]) - screenRadius > w ||
        Math.max(screenTop[0], screenBase[0]) + screenRadius < 0
      )
        continue;
      atDepth([x, treeY - size * 0.32, lateral], () => {
        const gaps = new Map<Vec, number>();
        const clearance = (point: Vec) => {
          const known = gaps.get(point);
          if (known !== undefined) return known;
          const limit = Math.min(
            snowHeight(point[0]),
            visibleTreeHeight(eye, snowEdges, point[0], point[2]),
          );
          const gap = Math.max(-600, limit - point[1]);
          gaps.set(point, gap);
          return gap;
        };
        const colors = night
          ? ["#38566a", "#233e54", "#1c3449"]
          : ["#53816e", "#356454", "#254c44"];
        c.save();
        c.globalAlpha *= Math.min(1, (cameraDistance - 5.8) / 4);
        const root = Math.min(
          treeY,
          visibleTreeHeight(eye, snowEdges, x, lateral),
        );
        const trunkTop: Vec = [x, treeY - size * 0.65, lateral];
        if (root > trunkTop[1])
          worldLine([x, root, lateral], trunkTop, "#635448", 2);
        for (let tier = 0; tier < 3; tier++) {
          const y = treeY - size * 0.22 - tier * size * 0.23;
          const width = size * (0.24 - tier * 0.044);
          const apex: Vec = [x + 0.1, y - size * 0.51, lateral];
          const a: Vec = [x - width, y, lateral - width * 0.62],
            b: Vec = [x + width, y, lateral - width * 0.55];
          const d: Vec = [x - 0.19, y, lateral + width * 0.79];
          worldPoly(clipTree([apex, a, b], clearance), colors[1]);
          worldPoly(clipTree([apex, b, d], clearance), colors[2]);
          worldPoly(clipTree([apex, d, a], clearance), colors[0]);
        }
        c.restore();
      });
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
  const shadow = project(s.x, ground.y - 0.12, boardZ);
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
  const cosRoll = Math.cos(roll),
    sinRoll = Math.sin(roll);
  const cosPitch = Math.cos(pitch),
    sinPitch = Math.sin(pitch);
  const cosYaw = Math.cos(yaw),
    sinYaw = Math.sin(yaw);
  const rig = placeAboveSnow(
    buildRider(s, wear, !lite),
    ([advance, up, side]) => {
      const x = advance * 0.043,
        y = up * 0.043,
        z = side * 0.043;
      const yy = y * cosRoll - z * sinRoll;
      const zz = y * sinRoll + z * cosRoll;
      const xx = x * cosPitch - yy * sinPitch;
      const dy = x * sinPitch + yy * cosPitch;
      return [
        s.x + xx * cosYaw - zz * sinYaw,
        s.y + dy,
        boardZ + xx * sinYaw + zz * cosYaw,
      ];
    },
    snowHeight,
    terrainBreaks.filter((x) => Math.abs(x - s.x) < 3),
  );
  const feet = project(s.x, s.y - rig.lift, boardZ);
  atDepth([s.x, s.y - rig.lift - 0.66, boardZ], () =>
    paintFaces(c, rig.faces, camera, screen),
  );
  objects.sort((a, b) => b.depth - a.depth).forEach((object) => object.draw());

  const intensity = Math.min(1, Math.max(rush, (s.speed - 16) / 18));
  if (s.tick && rush > 0.32 && !lite) {
    for (let i = 0; i < 10; i++) {
      const f = (i * 0.381 + s.tick * (0.008 + 0.012 * intensity)) % 1;
      const edge = i % 2 ? -1 : 1;
      const x = w * (0.5 + (0.38 + f * 0.22) * edge),
        y = h * (0.37 + f * (0.25 + (i % 6) * 0.075));
      line(
        c,
        [x, y],
        [x + edge * (6 + intensity * 18) * f, y + (8 + intensity * 19) * f],
        "rgba(236,250,255," + intensity * 0.29 * f + ")",
        1.15,
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
