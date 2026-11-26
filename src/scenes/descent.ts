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
import type { SnowEffects } from "./snow-effects";

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
function polygon(
  c: CanvasRenderingContext2D,
  points: Point[],
  color: string | CanvasGradient,
) {
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

export type Callout = {
  text: string;
  sub: string;
  age: number;
  gold: boolean;
};

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
  effects?: SnowEffects,
  rival?: Ski,
  rivalWear: number[] = [15, 11, 7],
  rivalEffects?: SnowEffects,
  callout?: Callout,
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
  const wide = w >= h;
  const distance = 9.6 + (wide ? 2.2 : 0) + rush * 2.2 + (air ? 1.1 : 0);
  const cameraX = s.x - distance;
  const eye: Vec = [
    cameraX,
    Math.min(cameraY - 5.8 - (air ? 0.9 : 0), snowHeight(cameraX) - 2.6),
    boardZ + 6.6,
  ];
  const nextGround = surface(
    s.x + (wide ? 32 + Math.min(7, s.speed * 0.25) : 24),
  );
  const yawBias = steady ? 0 : s.lean * 0.72;
  const pitchTarget = wide
    ? air
      ? 3.2
      : Math.max(3, Math.min(6, (nextGround.y - cameraY) * 0.75 + 1.4))
    : (air ? 3.6 : Math.max(3, Math.min(10, nextGround.y - cameraY + 4))) + 5.8;
  const forward = unit([
    distance + 20,
    pitchTarget,
    nextGround.center - eye[2] - 3.3 + yawBias,
  ]);
  const right = unit([-forward[2], 0, forward[0]]);
  const down: Vec = [
    -right[2] * forward[1],
    right[2] * forward[0] - right[0] * forward[2],
    right[0] * forward[1],
  ];
  const flightFocus = air ? Math.min(1, s.airTicks / 20) * s.tuckAmount : 0;
  const focal =
    Math.min(w * 1.08, h * (wide ? 1.17 : 0.8)) *
    (1 - rush * 0.1 + flightFocus * 0.04);
  function camera([x, y, z]: Vec): Vec {
    const v: Vec = [x - eye[0], y - eye[1], z - eye[2]];
    return [-dot(v, right), dot(v, down), dot(v, forward)];
  }
  function screen([x, y, z]: Vec): Point {
    const scale = focal / z;
    return [
      w * (wide ? 0.52 : 0.57) - x * scale,
      h * (wide ? 0.35 : 0.39) + y * scale,
    ];
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
  bank.addColorStop(0, night ? "#90b0cf" : "#b9d2d6");
  bank.addColorStop(1, night ? "#7497bc" : "#95b9c0");
  const vergeSun = c.createLinearGradient(0, h * 0.22, w * 0.34, h);
  vergeSun.addColorStop(0, night ? "#c5e0f4" : "#eef6ef");
  vergeSun.addColorStop(1, night ? "#a6c7e2" : "#cde1dd");
  const vergeShade = c.createLinearGradient(0, h * 0.22, w * 0.34, h);
  vergeShade.addColorStop(0, night ? "#8aaac9" : "#b0ccd0");
  vergeShade.addColorStop(1, night ? "#6e90b5" : "#8eb2bc");
  const piste = c.createLinearGradient(w * 0.76, h * 0.2, 0, h);
  piste.addColorStop(0, night ? "#ebf6ff" : "#fdfdf4");
  piste.addColorStop(0.55, night ? "#cde3f7" : "#e7f1ec");
  piste.addColorStop(1, night ? "#9fc2e4" : "#bed9db");
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
    const edge: Vec[] = [];
    for (let i = first; i <= last; i++)
      edge.push(camera(ribbon(bands[i], surfaces[i], left)));
    for (let i = last; i >= first; i--)
      edge.push(camera(ribbon(bands[i], surfaces[i], right)));
    // The continuous outline leaves no internal triangle or strip edges to antialias.
    const points = nearClip(edge).map(screen);
    if (points.length >= 3) polygon(c, points, fill);
  }
  for (const [first, last] of visibleSnowRuns(
    snowEdges,
    eye[0],
    eye[1],
  ).reverse()) {
    paintRibbon(first, last, -2.8, 2.8, bank);
    // Asymmetric sunlit left bevel + cool shadowed right bevel give instant 3D piste depth
    paintRibbon(first, last, -1.24, 0, vergeSun);
    paintRibbon(first, last, 0, 1.24, vergeShade);
    paintRibbon(first, last, -1, 1, piste);
    // Subtle groomed corduroy snow lanes along the piste
    if (!lite) {
      const groomCol = night ? "rgba(116, 156, 194, 0.24)" : "rgba(136, 174, 180, 0.22)";
      const centerGlow = night ? "rgba(235, 249, 255, 0.28)" : "rgba(255, 255, 248, 0.42)";
      paintRibbon(first, last, -0.22, 0.22, centerGlow);
      for (const lane of [-0.68, -0.36, 0.36, 0.68]) {
        paintRibbon(first, last, lane - 0.028, lane + 0.028, groomCol);
      }
      // Crisp sunlit snow-edge rim line on the sun-facing border
      paintRibbon(first, last, -1.03, -0.97, night ? "rgba(218, 240, 255, 0.55)" : "rgba(255, 252, 236, 0.72)");
      paintRibbon(first, last, 0.97, 1.03, night ? "rgba(96, 134, 172, 0.45)" : "rgba(118, 158, 168, 0.45)");
    }
    for (const lip of takeoffs) {
      if (bands[last] < lip - 5.2 || bands[first] > lip - 0.14) continue;
      const begin = bands.findIndex((x) => x >= lip - 3.6);
      const stripe = bands.findIndex((x) => x >= lip - 0.52);
      const end = bands.findIndex((x) => x >= lip - 0.14);
      if (begin < 0 || stripe < 0 || end < 0) continue;
      // Glowing runway approach guide stripes & lip highlight
      paintRibbon(
        Math.max(first, begin),
        Math.min(last, stripe),
        -0.99,
        -0.86,
        "#eb9d4d",
      );
      paintRibbon(
        Math.max(first, begin),
        Math.min(last, stripe),
        0.86,
        0.99,
        "#eb9d4d",
      );
      paintRibbon(
        Math.max(first, stripe),
        Math.min(last, end),
        -0.99,
        0.99,
        "#ffb963",
      );
      // Speed chevron arrows on the kicker ramp leading up to the lip
      if (!lite) {
        for (const offset of [4.2, 2.3]) {
          const cx = lip - offset;
          if (cx < bands[first] || cx > bands[last]) continue;
          const pTip = surface(cx + 0.95);
          const pBase = surface(cx);
          const hw = pBase.half * 0.38;
          const col = night ? "rgba(255, 200, 122, 0.52)" : "rgba(235, 132, 62, 0.48)";
          worldLine(
            [cx, pBase.y - 0.04, pBase.center - hw],
            [cx + 0.95, pTip.y - 0.04, pTip.center],
            col,
            2.6,
          );
          worldLine(
            [cx, pBase.y - 0.04, pBase.center + hw],
            [cx + 0.95, pTip.y - 0.04, pTip.center],
            col,
            2.6,
          );
        }
      }
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
        // Soft diagonal cast shadow on the snow grounds every pine tree
        if (!lite && cameraDistance < 55) {
          const shW = size * 0.24;
          const shL = size * 0.56;
          const sy = Math.min(treeY, root) - 0.03;
          worldPoly(
            [
              [x - shW * 0.5, sy, lateral - shW * 0.5],
              [x + shW * 0.5, sy, lateral + shW * 0.5],
              [x + shL * 0.65, snowHeight(x + shL * 0.65) - 0.03, lateral + shL],
              [x + shL * 0.2, snowHeight(x + shL * 0.2) - 0.03, lateral + shL * 0.75],
            ],
            night ? "rgba(22, 46, 74, 0.26)" : "rgba(56, 94, 110, 0.22)",
          );
        }
        const trunkTop: Vec = [x, treeY - size * 0.65, lateral];
        if (root > trunkTop[1])
          worldLine([x, root, lateral], trunkTop, "#5c4a3e", 2.4);
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
          if (!lite && cameraDistance < 48) {
            const snowTip = (point: Vec, amount: number): Vec => [
              apex[0] + (point[0] - apex[0]) * amount,
              apex[1] + (point[1] - apex[1]) * amount,
              apex[2] + (point[2] - apex[2]) * amount,
            ];
            worldPoly(
              clipTree([apex, snowTip(d, 0.62), snowTip(a, 0.44)], clearance),
              night ? "#bad8ee" : "#e2f0ec",
            );
          }
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
  {
    const space = Math.max(0, ground.y - s.y);
    c.save();
    c.translate(...shadow);
    c.scale(1, 0.28);
    const radius = 15 + Math.min(15, space);
    const shade = c.createRadialGradient(0, 0, 1, 0, 0, radius);
    shade.addColorStop(0, air ? "#1634454d" : "#1634458a");
    shade.addColorStop(1, "#16344500");
    c.fillStyle = shade;
    c.fillRect(-radius, -radius, radius * 2, radius * 2);
    c.restore();
  }
  function placeRider(s: Ski, outfit: number[], opacity = 1) {
    const j = s.j;
    const air = s.phase === "air";
    const boardZ = surface(s.x).center + s.lateral;
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
      buildRider(s, outfit, !lite && opacity === 1),
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
    atDepth([s.x, s.y - rig.lift - 0.66, boardZ], () => {
      c.save();
      c.globalAlpha = opacity;
      paintFaces(c, rig.faces, camera, screen);
      c.restore();
    });
  }
  placeRider(s, wear);
  const effectProject = (point: Vec) => {
    const view = camera(point);
    if (view[2] < 2.25) return null;
    const projected = screen(view);
    if (
      projected[0] < -14 ||
      projected[0] > w + 14 ||
      projected[1] < -14 ||
      projected[1] > h + 14
    )
      return null;
    return { screen: projected, scale: focal / view[2] };
  };
  if (rival && rival.tick && Math.abs(rival.x - s.x) < 34) {
    const lateral = surface(rival.x).center + rival.lateral;
    const separation = Math.hypot(rival.x - s.x, lateral - boardZ);
    if (
      separation > 1.25 &&
      visibleTreeHeight(eye, snowEdges, rival.x, lateral) >= rival.y - 0.65
    ) {
      const rivalAlpha = Math.min(0.9, Math.max(0.45, (separation - 1.15) * 0.42));
      placeRider(rival, rivalWear, rivalAlpha);
      rivalEffects?.draw(c, effectProject, snowHeight, night, true);
    }
  }
  effects?.draw(c, effectProject, snowHeight, night, lite);
  objects.sort((a, b) => b.depth - a.depth).forEach((object) => object.draw());

  if (callout && callout.age < 1250) {
    const t = callout.age / 1250;
    const alpha = t < 0.15 ? t / 0.15 : Math.max(0, 1 - (t - 0.15) / 0.85);
    const [rx, ry] = project(s.x, s.y - 2.35, boardZ);
    const cx = Math.max(96, Math.min(w - 96, rx));
    const cy = Math.max(66, Math.min(h - 90, ry - 24 - t * 34));
    const pop = t < 0.18 ? 0.82 + (t / 0.18) * 0.28 : 1.1 - Math.min(0.1, (t - 0.18) * 0.25);
    c.save();
    c.globalAlpha = alpha;
    c.translate(cx, cy);
    c.scale(pop, pop);
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = '800 22px "Microsoft YaHei", sans-serif';
    c.lineWidth = 4;
    c.strokeStyle = "rgba(12, 26, 38, 0.85)";
    c.strokeText(callout.text, 0, 0);
    c.fillStyle = callout.gold ? "#ffd87a" : "#ecf7ff";
    c.fillText(callout.text, 0, 0);
    if (callout.sub) {
      c.font = '700 13px "Microsoft YaHei", sans-serif';
      c.lineWidth = 3;
      c.strokeText(callout.sub, 0, 22);
      c.fillStyle = callout.gold ? "#fff1c7" : "#bfe3f2";
      c.fillText(callout.sub, 0, 22);
    }
    c.restore();
  }

  const intensity = Math.min(1, Math.max(rush, (s.speed - 16) / 18));
  if (s.tick && (rush > 0.24 || s.speed > 18.8) && !lite) {
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
}
