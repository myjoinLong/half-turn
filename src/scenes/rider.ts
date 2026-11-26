import { boardGear, deckMotif, suitGear } from "../content/gear";
import type { Grab } from "../content/tricks";
import type { Ski } from "../sim/ski";
import {
  add,
  sub,
  mul,
  dot,
  cross,
  unit,
  average,
  paintFaces,
  type Face,
  type SurfaceFinish,
  type V3,
} from "./geometry";

type Point = [number, number];
type Pose = {
  hips: Point;
  shoulders: Point;
  rearKnee: Point;
  frontKnee: Point;
  rearElbow: Point;
  frontElbow: Point;
  rearHand: Point;
  frontHand: Point;
};

const cruise: Pose = {
  hips: [-4, -23],
  shoulders: [2, -40],
  rearKnee: [-12, -14],
  frontKnee: [9, -15],
  rearElbow: [-7, -32],
  frontElbow: [10, -33],
  rearHand: [-12, -24],
  frontHand: [16, -25],
};
const crouch: Pose = {
  hips: [-7, -13],
  shoulders: [5, -25],
  rearKnee: [-10, -9],
  frontKnee: [10, -10],
  rearElbow: [-2, -19],
  frontElbow: [13, -20],
  rearHand: [-7, -13],
  frontHand: [17, -14],
};
const jump: Pose = {
  ...cruise,
  hips: [-1, -26],
  shoulders: [2, -45],
  rearElbow: [-13, -39],
  frontElbow: [16, -40],
  rearHand: [-23, -35],
  frontHand: [25, -33],
};
const reach: Pose = {
  ...cruise,
  shoulders: [3, -36],
  rearElbow: [-13, -33],
  frontElbow: [15, -34],
  rearHand: [-25, -29],
  frontHand: [27, -30],
};
const kneel: Pose = {
  ...crouch,
  hips: [-9, -11],
  shoulders: [1, -18],
  rearElbow: [-10, -11],
  frontElbow: [10, -12],
  rearHand: [-14, -5],
  frontHand: [17, -5],
};
const grabPoses: Record<Grab, Pose> = {
  indy: {
    ...crouch,
    hips: [-5, -15],
    shoulders: [3, -28],
    rearElbow: [-8, -14],
    rearHand: [0, 1],
    frontElbow: [15, -28],
    frontHand: [24, -24],
  },
  nose: {
    ...crouch,
    hips: [-2, -14],
    shoulders: [10, -24],
    frontKnee: [13, -11],
    frontElbow: [20, -14],
    frontHand: [22, -3],
    rearElbow: [-12, -25],
    rearHand: [-20, -25],
  },
  tail: {
    ...crouch,
    hips: [-11, -15],
    shoulders: [-6, -30],
    frontKnee: [4, -10],
    rearElbow: [-20, -13],
    rearHand: [-22, -3],
    frontElbow: [11, -33],
    frontHand: [22, -36],
  },
  melon: {
    ...crouch,
    hips: [-6, -15],
    shoulders: [-1, -28],
    frontKnee: [4, -10],
    frontElbow: [12, -16],
    frontHand: [2, -5],
    rearElbow: [-16, -23],
    rearHand: [-26, -19],
  },
  stalefish: {
    ...crouch,
    hips: [-10, -13],
    shoulders: [0, -30],
    rearKnee: [-16, -11],
    rearElbow: [-20, -11],
    rearHand: [-4, -5],
    frontElbow: [14, -27],
    frontHand: [23, -33],
  },
  japan: {
    ...crouch,
    hips: [-8, -15],
    shoulders: [3, -31],
    frontKnee: [4, -5],
    frontElbow: [12, -13],
    frontHand: [1, 1],
    rearElbow: [-12, -24],
    rearHand: [-24, -24],
  },
};

function blend(a: Pose, b: Pose, t: number): Pose {
  return Object.fromEntries(
    Object.entries(a).map(([name, point]) => {
      const target = b[name as keyof Pose];
      return [
        name,
        point.map((position, axis) => position + (target[axis] - position) * t),
      ];
    }),
  ) as Pose;
}
function pose(s: Ski) {
  if (s.phase === "run") {
    const effort = Math.max(s.charge, (s.speed / s.j.speed - 1) * 2.3);
    const stance = blend(cruise, crouch, Math.min(1, effort));
    const turn = s.lean * Math.abs(s.lean);
    stance.shoulders[0] += Math.abs(turn) * 1.8;
    stance.frontHand[1] -= turn * 2.8;
    stance.rearHand[1] += turn * 2.8;
    return stance;
  }
  if (s.phase === "crash") return blend(crouch, reach, 0.5);
  if (s.phase === "recover")
    return blend(kneel, cruise, Math.min(1, (s.tick - s.recoverTick) / 27));
  if (s.phase === "land") {
    const recovery = Math.min(1, (s.tick - s.contactTick) / 22);
    return blend(crouch, cruise, 1 - (1 - recovery) ** 3);
  }
  const takeoff = Math.min(1, s.airTicks / 11);
  const grab =
    s.visualGrab && s.visualGrip > 0.01
      ? blend(crouch, grabPoses[s.visualGrab], s.visualGrip)
      : crouch;
  const aerial = blend(reach, grab, s.tuckAmount);
  return blend(jump, aerial, takeoff);
}
function outward(
  faces: Face[],
  points: V3[],
  center: V3,
  color: string,
  finish?: SurfaceFinish,
) {
  const facing = cross(sub(points[1], points[0]), sub(points[2], points[0]));
  faces.push({
    points:
      dot(facing, sub(average(points), center)) < 0 ? points.reverse() : points,
    color,
    finish,
  });
}

function sleeve(
  faces: Face[],
  start: V3,
  end: V3,
  width: number,
  finish: number,
  color: string,
  trim?: string,
  surface?: SurfaceFinish,
  sides = 8,
) {
  const along = unit(sub(end, start));
  const side = unit(
    cross(along, Math.abs(along[2]) > 0.85 ? [1, 0, 0] : [0, 0, 1]),
  );
  const other = cross(along, side);
  const ring = (center: V3, radius: number) =>
    Array.from({ length: sides }, (_, i) => {
      const angle = (i * Math.PI * 2) / sides;
      return add(
        center,
        mul(
          add(mul(side, Math.cos(angle)), mul(other, Math.sin(angle))),
          radius,
        ),
      );
    });
  const a = ring(start, width),
    b = ring(end, finish),
    mid = average([start, end]);
  for (let i = 0; i < sides; i++) {
    const next = (i + 1) % sides;
    outward(
      faces,
      [a[i], a[next], b[next], b[i]],
      mid,
      i === 1 && trim ? trim : color,
      surface,
    );
  }
  outward(faces, a, mid, color, surface);
  outward(faces, b, mid, color, surface);
}

function capsule(
  faces: Face[],
  center: V3,
  size: V3,
  color: string,
  accent?: string,
  sides = 10,
  surface?: SurfaceFinish,
) {
  const rows = sides >= 14
    ? [-0.98, -0.86, -0.64, -0.35, 0, 0.35, 0.64, 0.86, 0.98]
    : [-0.96, -0.76, -0.42, 0, 0.42, 0.76, 0.96];
  const rings = rows.map((y) =>
    Array.from({ length: sides }, (_, i) => {
      const r = Math.sqrt(1 - y * y),
        angle = (i * Math.PI * 2) / sides;
      return add(center, [
        Math.cos(angle) * r * size[0],
        y * size[1],
        Math.sin(angle) * r * size[2],
      ]);
    }),
  );
  for (let row = 1; row < rings.length; row++)
    for (let i = 0; i < sides; i++) {
      const next = (i + 1) % sides;
      const tint =
        accent && row === 4 && (i === 0 || i === sides - 1) ? accent : color;
      outward(
        faces,
        [
          rings[row - 1][i],
          rings[row - 1][next],
          rings[row][next],
          rings[row][i],
        ],
        center,
        tint,
        surface,
      );
    }
  outward(faces, rings[0], center, color, surface);
  outward(faces, rings.at(-1)!, center, color, surface);
}

function jointBall(
  faces: Face[],
  center: V3,
  rx: number,
  ry: number,
  rz: number,
  color: string,
  sides = 8,
  surface?: SurfaceFinish,
) {
  const rows = [-0.88, -0.45, 0.45, 0.88];
  const rings = rows.map((y) =>
    Array.from({ length: sides }, (_, i) => {
      const r = Math.sqrt(1 - y * y);
      const angle = (i * Math.PI * 2) / sides;
      return add(center, [
        Math.cos(angle) * r * rx,
        y * ry,
        Math.sin(angle) * r * rz,
      ]);
    }),
  );
  for (let row = 1; row < rings.length; row++) {
    for (let i = 0; i < sides; i++) {
      const next = (i + 1) % sides;
      outward(
        faces,
        [rings[row - 1][i], rings[row - 1][next], rings[row][next], rings[row][i]],
        center,
        color,
        surface,
      );
    }
  }
  outward(faces, rings[0], center, color, surface);
  outward(faces, rings[rings.length - 1], center, color, surface);
}

const deckOutline: V3[] = [
  [-23, -3.8, 0],
  [-21, -2.8, -3.7],
  [-17, -1.3, -5.7],
  [13, -1.3, -5.6],
  [19, -2.1, -4.8],
  [22, -3.3, -2.7],
  [23, -3.8, 0],
  [22, -3.3, 2.7],
  [19, -2.1, 4.8],
  [13, -1.3, 5.6],
  [-17, -1.3, 5.7],
  [-21, -2.8, 3.7],
];
const grip: Record<Grab, { front: boolean; point: V3 }> = {
  indy: { front: false, point: [0.3, -3.6, 7.25] },
  nose: { front: true, point: [22.35, -5.15, -2.8] },
  tail: { front: false, point: [-22.35, -5.15, 2.8] },
  melon: { front: true, point: [1, -3.6, -7.25] },
  stalefish: { front: false, point: [-5, -3.6, -7.25] },
  japan: { front: true, point: [2, -3.6, 7.25] },
};
const joint = ([x, y]: Point, z = 0): V3 => [x, y, z];
const mix3 = (a: V3, b: V3, t: number) => add(a, mul(sub(b, a), t));

const bevelCorners: Point[] = [
  [-0.66, -1],
  [0.66, -1],
  [1, -0.67],
  [1, 0.67],
  [0.66, 1],
  [-0.66, 1],
  [-1, 0.67],
  [-1, -0.67],
];

function boot(faces: Face[], x: number, detail: boolean, trim: string) {
  const soleY = -1.32;
  function ring(y: number, halfWidth: number, heel: number, toe: number) {
    return bevelCorners.map(
      ([u, v]): V3 => [
        x + u * halfWidth,
        y,
        heel + ((v + 1) * (toe - heel)) / 2,
      ],
    );
  }
  const rows = [
    ring(soleY, 3.35, -4.5, 4.5),
    ring(-2.12, 3.5, -4.55, 4.55),
    ring(-3.35, 2.9, -3.76, 4),
    ring(-5.8, 2.15, -2.8, 1.65),
  ];
  const center: V3 = [x, -3, 0];
  outward(faces, rows[0], center, "#233747");
  for (let row = 1; row < rows.length; row++)
    for (let i = 0; i < bevelCorners.length; i++) {
      const next = (i + 1) % bevelCorners.length;
      outward(
        faces,
        [rows[row - 1][i], rows[row - 1][next], rows[row][next], rows[row][i]],
        center,
        row === 1 ? "#566b7e" : "#293d53",
      );
    }
  outward(faces, rows[3], center, "#32485c");
  if (detail) {
    // Each binding wraps across the boot and returns to the base plate.
    for (const [z, height] of [
      [2.05, -4.3],
      [-1.85, -5.75],
    ]) {
      const left: V3 = [x - 3.23, -2.5, z];
      const right: V3 = [x + 3.23, -2.5, z];
      const archLeft: V3 = [x - 1.95, height, z];
      const archRight: V3 = [x + 1.95, height, z];
      sleeve(faces, left, archLeft, 0.63, 0.68, "#546677");
      sleeve(faces, archLeft, archRight, 0.68, 0.68, trim);
      sleeve(faces, archRight, right, 0.68, 0.63, "#546677");
    }
  }
}

function goggles(faces: Face[], head: V3, lens: string, finish: SurfaceFinish) {
  const sections = [
    [3.37, -4.6, -0.17, 1.7],
    [4.55, -3.46, -1.25, 2.72],
    [5.59, -1.85, -1.64, 2.94],
    [6.0, 0, -1.72, 2.2],
    [5.59, 1.85, -1.64, 2.94],
    [4.55, 3.46, -1.25, 2.72],
    [3.37, 4.6, -0.17, 1.7],
  ];
  const ring = (margin: number) =>
    sections.map(([x, z, top, bottom], i) => {
      const edge = i === 0 || i === sections.length - 1;
      return [
        add(head, [
          x + margin * 0.18,
          top + margin,
          edge ? z * (1 - margin * 0.16) : z,
        ]),
        add(head, [
          x + margin * 0.18,
          bottom - margin,
          edge ? z * (1 - margin * 0.16) : z,
        ]),
      ];
    });
  const frame = ring(0);
  const glass = ring(0.44);
  for (let i = 1; i < glass.length; i++) {
    const [top, bottom] = glass[i];
    const [beforeTop, beforeBottom] = glass[i - 1];
    outward(faces, [beforeTop, top, bottom, beforeBottom], head, lens, finish);
    outward(
      faces,
      [frame[i - 1][0], frame[i][0], top, beforeTop],
      head,
      "#172c40",
    );
    outward(
      faces,
      [beforeBottom, bottom, frame[i][1], frame[i - 1][1]],
      head,
      "#172c40",
    );
  }
  for (const edge of [0, glass.length - 1])
    outward(
      faces,
      [frame[edge][0], glass[edge][0], glass[edge][1], frame[edge][1]],
      head,
      "#172c40",
    );
  for (const side of [-1, 1]) {
    const front: V3 = [3.38, 0.9, side * 4.48];
    const rear: V3 = [-3.65, 0.54, side * 3.3];
    sleeve(faces, add(head, rear), add(head, front), 0.53, 0.66, "#4a647c");
  }
}

export function buildRider(s: Ski, wear: number[], detail = true): Face[] {
  const p = pose(s);
  const faces: Face[] = [];
  const outfit = suitGear[wear[1]] ?? suitGear[0];
  const deck = boardGear[wear[0]] ?? boardGear[0];
  const jacket = outfit.color;
  const board = deck.color;
  const gloss = [0.31, 0.38, 0.56, 0.89, 0.7, 0.24, 0.9, 0.43, 0.53][
    deck.motif
  ];
  const coating = detail ? { tint: deck.accent, strength: gloss } : undefined;
  const steel = detail
    ? { tint: deck.accent, strength: 0.51 + 0.27 * gloss }
    : undefined;
  const lenses = detail ? { tint: outfit.accent, strength: 0.82 } : undefined;
  const sole = deckOutline.map(([x, y, z]): V3 => [x, y + 1.15, z]);
  const within: V3 = [0, -0.65, 0];
  // Longitudinal strips keep the curved deck tessellated without filling across the lifted tips.
  for (let i = 1; i <= 5; i++) {
    const far = 12 - i;
    const corners = i === 5 ? [i, i + 1, far] : [i, i + 1, far - 1, far];
    const top = corners.map((k) => deckOutline[k]);
    const bottom = corners.map((k) => sole[k]);
    outward(faces, top, within, board, coating);
    if (i === 2 && detail) {
      faces.at(-1)!.decals = deckMotif(deck.motif).map((mark) => ({
        color: deck.accent,
        points: mark.map(([u, v]) => [-17 + 0.3 * u, -1.3, -5.4 + 0.108 * v]),
      }));
    }
    outward(faces, bottom, [0, -2, 0], "#1c3d59");
  }
  outward(
    faces,
    [deckOutline[0], deckOutline[1], deckOutline[11]],
    within,
    board,
    coating,
  );
  outward(faces, [sole[0], sole[1], sole[11]], [0, -3.8, 0], "#1c3d59");
  for (let i = 0; i < 12; i++) {
    const next = (i + 1) % 12;
    outward(
      faces,
      [deckOutline[i], deckOutline[next], sole[next], sole[i]],
      within,
      "#a7bdca",
      steel,
    );
  }
  const seg = detail ? 10 : 8;
  const fabric = detail ? { tint: outfit.accent, strength: 0.22 } : undefined;
  const helmetFinish = detail ? { tint: "#d8eeff", strength: 0.46 } : undefined;
  for (const front of [false, true]) {
    const foot: V3 = [front ? 9 : -9, -3, 0];
    boot(faces, foot[0], detail, outfit.accent);
    const knee = joint(front ? p.frontKnee : p.rearKnee, front ? 1.7 : -1.9);
    const thigh = joint(p.hips, front ? 2.9 : -2.9);
    const ankle: V3 = [foot[0], -4.2, 0];
    const pantCol = front ? "#3d5169" : "#2f4054";
    const calfCol = front ? "#394d64" : "#29394b";
    sleeve(faces, thigh, knee, detail ? 4.35 : 3.95, detail ? 3.35 : 2.95, pantCol, undefined, undefined, seg);
    sleeve(faces, knee, ankle, detail ? 3.35 : 2.95, detail ? 2.55 : 2.12, calfCol, undefined, undefined, seg);
    if (detail) {
      jointBall(faces, knee, 3.25, 3.2, 3.15, "#243547", 10);
    }
  }

  const hips = joint(p.hips),
    shoulders = joint(p.shoulders);
  const waist = mix3(hips, shoulders, 0.36);
  const chest = mix3(hips, shoulders, 0.74);
  if (detail) {
    const hemBase = add(hips, [-0.5, 2.2, 0]);
    sleeve(faces, hemBase, hips, 5.75, 5.5, outfit.accent, undefined, fabric, seg);
  }
  sleeve(faces, hips, waist, detail ? 5.55 : 5.15, detail ? 5.1 : 4.65, jacket, undefined, fabric, seg);
  sleeve(
    faces,
    waist,
    chest,
    detail ? 5.1 : 4.65,
    detail ? 6.55 : 6.12,
    jacket,
    detail ? outfit.accent : undefined,
    fabric,
    seg,
  );
  const shoulderColor =
    outfit.motif === 1 || outfit.motif === 2 ? outfit.accent : jacket;
  sleeve(faces, chest, shoulders, detail ? 6.55 : 6.12, detail ? 5.65 : 5.18, shoulderColor, undefined, fabric, seg);
  if (detail) {
    const collar = mix3(hips, shoulders, 0.88);
    sleeve(faces, collar, add(shoulders, [0.4, -2.5, 0]), 5.45, 3.85, "#1d3144", undefined, undefined, 10);
    jointBall(faces, add(shoulders, [-3.9, -2.1, 0]), 3.55, 2.85, 3.95, jacket, 8, fabric);
    const packTop = add(mix3(hips, shoulders, 0.82), [-4.6, 0.2, 0]);
    const packBase = add(mix3(hips, shoulders, 0.24), [-4.2, 0.1, 0]);
    sleeve(faces, packBase, packTop, 3.75, 4.05, "#233749", outfit.accent, undefined, 8);
    jointBall(faces, packTop, 3.6, 2.1, 3.6, "#2c4357", 8);
  }
  const selected = s.visualGrab && grip[s.visualGrab];
  const strength = selected ? s.visualGrip : 0;
  for (const front of [false, true]) {
    const side = front ? 1 : -1;
    const shoulder = add(shoulders, [0, 0.6, side * 4.35]);
    let elbow = joint(front ? p.frontElbow : p.rearElbow, side * 8);
    let hand = joint(front ? p.frontHand : p.rearHand, side * 8.7);
    if (selected && selected.front === front && s.phase === "air") {
      const rimSide = Math.sign(selected.point[2]);
      const elbowX =
        rimSide === side
          ? elbow[0]
          : shoulders[0] +
            side * Math.max(13.2, Math.abs(elbow[0] - shoulders[0]));
      elbow = mix3(
        elbow,
        [elbowX, Math.min(-10, elbow[1]), rimSide * 9.1],
        strength,
      );
      const neutral = front ? crouch.frontHand : crouch.rearHand;
      const extended = front ? reach.frontHand : reach.rearHand;
      hand = mix3(
        mix3(
          joint(extended, side * 8.7),
          joint(neutral, side * 8.7),
          s.tuckAmount,
        ),
        selected.point,
        strength,
      );
    }
    if (detail) {
      jointBall(faces, shoulder, 3.18, 3.18, 3.15, shoulderColor, 10, fabric);
      jointBall(faces, elbow, 2.55, 2.55, 2.55, jacket, 10, fabric);
    }
    sleeve(faces, shoulder, elbow, detail ? 3.25 : 2.98, detail ? 2.62 : 2.36, jacket, undefined, fabric, seg);
    sleeve(faces, elbow, hand, detail ? 2.62 : 2.36, detail ? 1.82 : 1.57, jacket, undefined, fabric, seg);
    const wrist = mix3(elbow, hand, 0.79);
    sleeve(faces, wrist, hand, detail ? 2.15 : 1.85, detail ? 2.05 : 1.8, outfit.accent, undefined, undefined, seg);
    const next = mix3(wrist, hand, 1.24);
    if (detail) {
      jointBall(faces, mix3(hand, next, 0.45), 2.15, 1.85, 1.95, outfit.accent, 8);
    } else {
      sleeve(faces, hand, next, 1.85, 1.32, outfit.accent);
    }
  }
  const neck = add(shoulders, [1, -2.2, 0]);
  const head = add(neck, [2.2, -5.1, 0]);
  sleeve(faces, shoulders, neck, detail ? 3.15 : 2.8, detail ? 2.95 : 2.45, detail ? "#1d3144" : "#b57e57", undefined, undefined, seg);
  if (detail) {
    const speedFactor = Math.min(1.4, Math.max(0.45, s.speed / 16));
    const phase = s.tick * 0.24 + (s.phase === "air" ? s.yaw * 0.05 : 0);
    const s0 = add(shoulders, [-2.4, -1.9, 0.4]);
    const s1 = add(s0, [-5.2 * speedFactor, -0.8 + Math.sin(phase) * 1.4, Math.cos(phase) * 1.6]);
    const s2 = add(s1, [-5.4 * speedFactor, -0.4 + Math.sin(phase - 1.1) * 2.1, Math.cos(phase - 1.1) * 2.4]);
    const s3 = add(s2, [-4.4 * speedFactor, 0.2 + Math.sin(phase - 2.2) * 2.4, Math.cos(phase - 2.2) * 2.2]);
    sleeve(faces, s0, s1, 1.55, 1.25, outfit.accent, undefined, fabric, 8);
    sleeve(faces, s1, s2, 1.25, 0.95, outfit.accent, undefined, fabric, 8);
    sleeve(faces, s2, s3, 0.95, 0.5, "#fff2d6", undefined, undefined, 8);
  }
  capsule(
    faces,
    head,
    [5.65, 6.45, 5.05],
    "#233955",
    detail ? "#8eb2cc" : "#4d6483",
    detail ? 16 : 10,
    helmetFinish,
  );
  const lens = wear[1] === 0 ? "#ecaa60" : outfit.accent;
  if (lenses) {
    goggles(faces, head, lens, lenses);
  } else {
    const visor = add(head, [4.9, 1.05, 0]);
    sleeve(
      faces,
      add(visor, [-0.6, 0, -4]),
      add(visor, [-0.6, 0, 4]),
      1.83,
      1.83,
      "#162b41",
    );
    sleeve(
      faces,
      add(visor, [0.5, -0.2, -3.35]),
      add(visor, [0.5, -0.2, 3.35]),
      1.26,
      1.26,
      lens,
    );
  }
  return faces;
}

export function rider(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  s: Ski,
  wear: number[],
  angle = 0.455,
) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  paintFaces(
    c,
    buildRider(s, wear),
    ([advance, up, side]) => {
      const depth = -advance * sin + side * cos;
      return [
        advance * cos + side * sin,
        up * 0.97 - depth * 0.15,
        depth * 0.66 + up * 0.19 + 31,
      ];
    },
    ([u, v]) => [x + u * size, y + v * size],
  );
}
