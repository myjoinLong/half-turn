import { boardColors, suitColors } from "../content/routes";
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
    return blend(cruise, crouch, Math.min(1, effort));
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
function outward(faces: Face[], points: V3[], center: V3, color: string) {
  const facing = cross(sub(points[1], points[0]), sub(points[2], points[0]));
  faces.push({
    points:
      dot(facing, sub(average(points), center)) < 0 ? points.reverse() : points,
    color,
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
) {
  const along = unit(sub(end, start));
  const side = unit(
    cross(along, Math.abs(along[2]) > 0.85 ? [1, 0, 0] : [0, 0, 1]),
  );
  const other = cross(along, side);
  const sides = 8;
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
    );
  }
  outward(faces, a, mid, color);
  outward(faces, b, mid, color);
}

function capsule(
  faces: Face[],
  center: V3,
  size: V3,
  color: string,
  accent?: string,
) {
  const rows = [-0.96, -0.76, -0.42, 0, 0.42, 0.76, 0.96];
  const sides = 10;
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
      );
    }
  outward(faces, rings[0], center, color);
  outward(faces, rings.at(-1)!, center, color);
}

const renderColor = (rgb: number) => "#" + rgb.toString(16).padStart(6, "0");
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

export function buildRider(s: Ski, wear: number[], detail = true): Face[] {
  const p = pose(s);
  const faces: Face[] = [];
  const jacket = renderColor(suitColors[wear[1]]);
  const board = renderColor(boardColors[wear[0]]);
  const sole = deckOutline.map(([x, y, z]): V3 => [x, y + 1.15, z]);
  const within: V3 = [0, -0.65, 0];
  // Longitudinal strips keep the curved deck tessellated without filling across the lifted tips.
  for (let i = 1; i <= 5; i++) {
    const far = 12 - i;
    const corners = i === 5 ? [i, i + 1, far] : [i, i + 1, far - 1, far];
    const top = corners.map((k) => deckOutline[k]);
    const bottom = corners.map((k) => sole[k]);
    outward(faces, top, within, board);
    outward(faces, bottom, [0, -2, 0], "#1c3d59");
  }
  outward(
    faces,
    [deckOutline[0], deckOutline[1], deckOutline[11]],
    within,
    board,
  );
  outward(faces, [sole[0], sole[1], sole[11]], [0, -3.8, 0], "#1c3d59");
  for (let i = 0; i < 12; i++) {
    const next = (i + 1) % 12;
    outward(
      faces,
      [deckOutline[i], deckOutline[next], sole[next], sole[i]],
      within,
      "#a7bdca",
    );
  }

  for (const front of [false, true]) {
    const foot: V3 = [front ? 9 : -9, -3, 0];
    const heel: V3 = [foot[0] - 0.9, -3, -2.35],
      toe: V3 = [foot[0] + 1.5, -3, 2.25];
    sleeve(faces, heel, toe, 1.65, 1.4, "#273849");
    sleeve(faces, [foot[0], -1.55, 0], foot, 3.7, 3.25, "#283d55");
    const knee = joint(front ? p.frontKnee : p.rearKnee, front ? 1.7 : -1.9);
    const thigh = joint(p.hips, front ? 2.9 : -2.9);
    const ankle: V3 = [foot[0], -4.2, 0];
    sleeve(faces, thigh, knee, 3.95, 2.95, front ? "#3e5068" : "#324155");
    sleeve(faces, knee, ankle, 2.95, 2.12, front ? "#3b4e65" : "#2a3a4b");
  }

  const hips = joint(p.hips),
    shoulders = joint(p.shoulders);
  const waist = mix3(hips, shoulders, 0.38);
  const chest = mix3(hips, shoulders, 0.76);
  sleeve(faces, hips, waist, 5.15, 4.65, jacket);
  sleeve(faces, waist, chest, 4.65, 6.12, jacket);
  sleeve(faces, chest, shoulders, 6.12, 5.18, jacket);
  if (detail) {
    const collar = mix3(hips, shoulders, 0.88);
    sleeve(faces, collar, add(shoulders, [0, -2.4, 0]), 5.3, 3.7, "#20364a");
    const packTop = add(mix3(hips, shoulders, 0.83), [-4.2, 0.4, 0]);
    const packBase = add(mix3(hips, shoulders, 0.23), [-3.9, 0.1, 0]);
    sleeve(faces, packBase, packTop, 3.65, 3.92, "#253a4c", "#72879b");
  }
  const selected = s.visualGrab && grip[s.visualGrab];
  const strength = selected ? s.visualGrip : 0;
  for (const front of [false, true]) {
    const side = front ? 1 : -1;
    const shoulder = add(shoulders, [0, 0.6, side * 4.15]);
    let elbow = joint(front ? p.frontElbow : p.rearElbow, side * 8);
    let hand = joint(front ? p.frontHand : p.rearHand, side * 8.7);
    if (selected && selected.front === front && s.phase === "air") {
      const rimSide = Math.sign(selected.point[2]);
      // Keep the elbow outside the jacket on the same side as the reached edge.
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
    sleeve(faces, shoulder, elbow, 2.98, 2.36, jacket);
    sleeve(faces, elbow, hand, 2.36, 1.57, jacket);
    const wrist = mix3(elbow, hand, 0.81);
    sleeve(faces, wrist, hand, 1.85, 1.8, "#27384a");
    const next = mix3(wrist, hand, 1.23);
    sleeve(faces, hand, next, 1.85, 1.32, "#e5ae6c");
  }
  const neck = add(shoulders, [1, -2.2, 0]);
  const head = add(neck, [2.2, -5.1, 0]);
  sleeve(faces, shoulders, neck, 2.8, 2.45, "#b57e57");
  capsule(faces, head, [5.45, 6.35, 4.75], "#263c59", "#4d6483");
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
    "#ecaa60",
    "#ffe6a7",
  );
  if (detail)
    sleeve(
      faces,
      add(head, [-3.5, 0.6, -3.8]),
      add(head, [-3.5, 0.6, 3.8]),
      0.9,
      0.9,
      "#72909e",
    );
  return faces;
}

export function rider(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  s: Ski,
  wear: number[],
) {
  paintFaces(
    c,
    buildRider(s, wear),
    ([advance, up, side]) => [
      advance * 0.92 - side * 0.39,
      up,
      (advance * 0.39 + side * 0.92) * 0.5 + 31,
    ],
    ([u, v]) => [x + u * size, y + v * size],
  );
}
