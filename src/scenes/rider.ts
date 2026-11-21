import { boardColors, suitColors } from "../content/routes";
import type { Grab } from "../content/tricks";
import type { Ski } from "../sim/ski";

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
  if (s.phase === "crash") return crouch;
  if (s.phase === "land") {
    const recovery = Math.min(1, (s.tick - s.contactTick) / 22);
    return blend(crouch, cruise, 1 - (1 - recovery) ** 3);
  }
  const takeoff = Math.min(1, s.airTicks / 11);
  const grab =
    s.activeGrab && s.grabbing
      ? blend(crouch, grabPoses[s.activeGrab], s.gripBlend)
      : crouch;
  const aerial = blend(reach, grab, s.tuckAmount);
  return blend(jump, aerial, takeoff);
}

type Context = CanvasRenderingContext2D;
function stroke(c: Context, points: Point[], color: string, width: number) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.lineCap = "round";
  c.lineJoin = "round";
  c.beginPath();
  c.moveTo(...points[0]);
  for (const point of points.slice(1)) c.lineTo(...point);
  c.stroke();
}
function dot(c: Context, point: Point, radius: number, color: string) {
  c.fillStyle = color;
  c.beginPath();
  c.arc(...point, radius, 0, Math.PI * 2);
  c.fill();
}
const color = (rgb: number) => "#" + rgb.toString(16).padStart(6, "0");
export function rider(
  c: Context,
  x: number,
  y: number,
  size: number,
  s: Ski,
  wear: number[],
) {
  const p = pose(s);
  c.save();
  c.translate(x, y);
  c.scale(size, size);
  c.rotate((s.angle * Math.PI) / 180);
  if (s.j.showcase && s.phase === "air") {
    const radians = (s.yaw * Math.PI) / 180;
    const sideways = Math.cos(radians);
    c.scale((sideways < 0 ? -1 : 1) * (0.45 + 0.55 * Math.abs(sideways)), 1);
    c.transform(1, 0, Math.sin(radians) * 0.24, 1, 0, 0);
  }
  if (s.phase === "land" && s.result && s.result.halves % 2) c.scale(-1, 1);
  if (s.phase === "crash") {
    c.translate(0, 4);
    c.rotate(-0.57);
  }

  const jacket = color(suitColors[wear[1]]);
  stroke(
    c,
    [
      [-23, -4],
      [-18, 0],
      [17, 0],
      [24, -4],
    ],
    "#101e31",
    5.7,
  );
  stroke(
    c,
    [
      [-23, -4.6],
      [-18, -1.5],
      [17, -1.5],
      [24, -4.6],
    ],
    color(boardColors[wear[0]]),
    3.4,
  );
  stroke(
    c,
    [
      [-17, 0.7],
      [17, 0.7],
    ],
    "#d6edf5",
    0.8,
  );

  const rearBoot: Point = [-9, -3];
  const frontBoot: Point = [9, -3];
  const drawLeg = (knee: Point, boot: Point, fabric: string) => {
    stroke(c, [p.hips, knee, boot], "#101c2d", 7.5);
    stroke(c, [p.hips, knee, boot], fabric, 5);
    stroke(
      c,
      [
        [boot[0] - 1, -5],
        [boot[0] + 3.6, -4],
      ],
      "#171d2c",
      5,
    );
    stroke(
      c,
      [
        [boot[0] - 1.5, -5.5],
        [boot[0] + 2, -5],
      ],
      "#d1d8e2",
      0.8,
    );
  };
  const drawArm = (elbow: Point, hand: Point, sleeve: string) => {
    stroke(c, [p.shoulders, elbow, hand], "#122338", 6.7);
    stroke(c, [p.shoulders, elbow, hand], sleeve, 4.7);
    dot(c, hand, 2.8, "#ffc96e");
  };
  const forwardGrip =
    s.activeGrab === "nose" ||
    s.activeGrab === "melon" ||
    s.activeGrab === "japan";
  const frontArmOver = !s.grabbing || forwardGrip;
  if (frontArmOver) drawArm(p.rearElbow, p.rearHand, "#39465e");
  else drawArm(p.frontElbow, p.frontHand, "#39465e");
  drawLeg(p.rearKnee, rearBoot, "#243448");
  drawLeg(p.frontKnee, frontBoot, "#3b5365");
  stroke(c, [p.hips, p.shoulders], "#192d42", 14);
  stroke(c, [p.hips, p.shoulders], jacket, 11.2);
  stroke(
    c,
    [
      [p.hips[0] + 2, p.hips[1]],
      [p.shoulders[0] + 3, p.shoulders[1] + 2],
    ],
    "#f6e1b9",
    1.1,
  );
  if (frontArmOver) drawArm(p.frontElbow, p.frontHand, jacket);
  else drawArm(p.rearElbow, p.rearHand, jacket);

  const head: Point = [p.shoulders[0] + 4, p.shoulders[1] - 7];
  dot(c, head, 7.2, "#162237");
  stroke(
    c,
    [
      [head[0] - 4, head[1] - 4],
      [head[0] + 1, head[1] - 6],
    ],
    "#8598ab",
    1.2,
  );
  stroke(
    c,
    [
      [head[0] + 1, head[1]],
      [head[0] + 7, head[1] - 1],
    ],
    "#ffab54",
    3.5,
  );
  stroke(
    c,
    [
      [head[0] + 3, head[1] - 1],
      [head[0] + 6, head[1] - 1.5],
    ],
    "#fff0a8",
    1,
  );
  c.restore();
}
