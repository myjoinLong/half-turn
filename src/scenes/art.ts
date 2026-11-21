import { height, Ski } from "../sim/ski";
import { boardColors, suitColors } from "../content/routes";
type C = CanvasRenderingContext2D;
type Point = [number, number];
const ink = "#163d36",
  snow = "#f4f2d9";
function poly(c: C, p: Point[], color: string) {
  c.fillStyle = color;
  c.beginPath();
  p.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fill();
}
function line(c: C, p: Point[], color: string, w: number) {
  c.strokeStyle = color;
  c.lineWidth = w;
  c.lineCap = "round";
  c.lineJoin = "round";
  c.beginPath();
  p.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.stroke();
}
function noise(i: number) {
  const v = Math.sin(i * 12.9898 + 4.2) * 43758.54;
  return v - Math.floor(v);
}
function pine(c: C, x: number, y: number, h: number, col: string) {
  poly(
    c,
    [
      [x, y - h],
      [x + h * 0.1, y - h * 0.55],
      [x + h * 0.05, y - h * 0.57],
      [x + h * 0.17, y - h * 0.34],
      [x + h * 0.09, y - h * 0.37],
      [x + h * 0.22, y - h * 0.08],
      [x + h * 0.03, y - h * 0.14],
      [x + h * 0.025, y],
      [x - h * 0.023, y],
      [x - h * 0.024, y - h * 0.14],
      [x - h * 0.23, y - h * 0.1],
      [x - h * 0.1, y - h * 0.38],
      [x - h * 0.18, y - h * 0.34],
      [x - h * 0.06, y - h * 0.59],
      [x - h * 0.11, y - h * 0.55],
    ],
    col,
  );
}
export function panorama(
  c: C,
  w: number,
  h: number,
  m: number,
  aurora = false,
) {
  const night = m === 2;
  const grad = c.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, aurora ? "#090f2b" : night ? "#a0b5bc" : "#f3e7c9");
  grad.addColorStop(0.63, aurora ? "#34477b" : night ? "#b7cebe" : "#f5d3ac");
  grad.addColorStop(1, aurora ? "#6787aa" : "#a6c0ab");
  c.fillStyle = grad;
  c.fillRect(0, 0, w, h);
  if (aurora) {
    for (let i = 0; i < 95; i++) {
      c.fillStyle = i % 7 ? "#c2d2fc80" : "#f4fafa";
      c.fillRect(noise(i) * w, noise(i + 200) * h * 0.42, i % 7 ? 1 : 2, 1);
    }
    for (let i = 0; i < 15; i++) {
      const ribbon: Point[] = [];
      for (let x = 0; x <= w; x += 5)
        ribbon.push([
          x,
          h * (0.18 + i * 0.005 + 0.064 * Math.sin((x / w) * 5 + i * 0.047)),
        ]);
      line(
        c,
        ribbon,
        ["#7bffe526", "#7cd5ff20", "#a68fff22"][i % 3],
        h * 0.028,
      );
    }
  }
  c.fillStyle = aurora ? "#e7f5ff" : night ? "#ffdeb2" : "#ed8b56";
  c.beginPath();
  c.arc(w * 0.77, h * 0.265, w * (aurora ? 0.052 : 0.102), 0, 7);
  c.fill();
  for (let i = 0; i < 9; i++) {
    const x = noise(i) * w,
      y = h * (0.17 + 0.15 * noise(i + 13));
    line(
      c,
      [
        [x, y],
        [x + 20 + 40 * noise(i + 2), y],
      ],
      "#f4eacf",
      1,
    );
  }
  const ridge = (pts: Point[], color: string) =>
    poly(
      c,
      [...pts.map(([x, y]): Point => [x * w, y * h]), [w, h], [0, h]],
      color,
    );
  ridge(
    [
      [0, 0.45],
      [0.13, 0.36],
      [0.19, 0.38],
      [0.35, 0.24],
      [0.46, 0.35],
      [0.61, 0.3],
      [0.75, 0.4],
      [0.87, 0.31],
      [1, 0.39],
    ],
    aurora ? "#7f93b5" : "#b3c0a9",
  );
  const peak: Point[] = [
    [0, 0.43],
    [0.08, 0.39],
    [0.13, 0.41],
    [0.27, 0.29],
    [0.3, 0.3],
    [0.42, 0.19],
    [0.475, 0.245],
    [0.51, 0.25],
    [0.61, 0.34],
    [0.67, 0.32],
    [0.73, 0.38],
    [0.85, 0.3],
    [0.89, 0.31],
    [0.95, 0.256],
    [1, 0.29],
  ];
  ridge(peak, aurora ? "#425e89" : "#698d82");
  const facet = (p: Point[], color: string) =>
    poly(
      c,
      p.map(([x, y]) => [x * w, y * h]),
      color,
    );
  facet(
    [
      [0.13, 0.41],
      [0.27, 0.29],
      [0.3, 0.3],
      [0.42, 0.19],
      [0.36, 0.31],
      [0.31, 0.32],
      [0.335, 0.29],
      [0.23, 0.37],
      [0.25, 0.33],
    ],
    aurora ? "#b5c7eb" : "#f7eacb",
  );
  facet(
    [
      [0.42, 0.19],
      [0.475, 0.245],
      [0.51, 0.25],
      [0.61, 0.34],
      [0.5, 0.29],
      [0.47, 0.295],
      [0.455, 0.258],
      [0.44, 0.267],
    ],
    aurora ? "#90aac9" : "#d4d7b9",
  );
  facet(
    [
      [0.42, 0.19],
      [0.4, 0.306],
      [0.32, 0.4],
      [0.365, 0.32],
      [0.34, 0.33],
    ],
    aurora ? "#304d78" : "#48756d",
  );
  facet(
    [
      [0.73, 0.38],
      [0.85, 0.3],
      [0.89, 0.31],
      [0.95, 0.256],
      [0.916, 0.325],
      [0.875, 0.34],
      [0.885, 0.319],
      [0.8, 0.363],
    ],
    aurora ? "#b6d2df" : "#e6e2c5",
  );
  for (let k = 0; k < 3; k++) {
    const pts: Point[] = [];
    for (let i = 0; i <= 70; i++) {
      const x = i / 70,
        y =
          0.44 +
          k * 0.065 +
          0.038 * Math.sin(x * 7 + k * 2.2) +
          0.013 * Math.sin(x * 17 + k);
      pts.push([x, y]);
    }
    const layers = aurora
      ? ["#55728b", "#38566e", "#263f55"]
      : ["#87a49a", "#618979", "#3e6b5b"];
    ridge(pts, layers[k]);
    for (let i = 0; i < 95; i++) {
      const x = noise(i + k) * w,
        idx = Math.min(70, Math.floor((x / w) * 70));
      pine(
        c,
        x,
        pts[idx][1] * h + 4,
        5 + k * 5 + noise(i + 80) * 10,
        layers[k],
      );
    }
  }
  for (let i = 0; i < Math.min(18000, (w * h) / 18); i++) {
    c.fillStyle = i % 2 ? "#fff7da18" : "#274a3510";
    c.fillRect(noise(i) * w, noise(i + 3101) * h, 1, 1);
  }
}
function hex(n: number) {
  return "#" + n.toString(16).padStart(6, "0");
}
export function piste(
  c: C,
  w: number,
  h: number,
  s: Ski,
  look: number,
  items: number[],
  lite: boolean,
  debug: boolean,
) {
  const cinematic = !!s.j.showcase;
  const scale = w / (cinematic ? 48 : 42),
    px = w * (cinematic ? 0.34 : 0.26),
    base = h * (cinematic ? 0.72 : 0.68),
    sy = (y: number) => base + (y - look) * scale,
    sx = (x: number) => px + (x - s.x) * scale;
  const start = s.x - (cinematic ? 18 : 13),
    end = s.x + 36;
  const pts: Point[] = [];
  for (let x = start; x < end; x += 0.22) pts.push([sx(x), sy(height(s.j, x))]);
  const lip = s.j.lip,
    ly = sy(height(s.j, lip)),
    lx = sx(lip);
  for (let i = Math.floor(start / 5); i < end / 5; i++) {
    if (Math.abs(i * 5 - lip) < 12) continue;
    pine(
      c,
      sx(i * 5),
      sy(height(s.j, i * 5)) + 2,
      (0.08 + 0.11 * noise(i)) * h,
      cinematic ? "#233752" : "#325e50",
    );
  }
  poly(c, [...pts, [w, h + 5], [0, h + 5]], cinematic ? "#879dc3" : "#cad8c3");
  poly(
    c,
    [
      ...pts,
      ...pts
        .slice()
        .reverse()
        .map(
          ([x, y]): Point => [
            x,
            y + 16 + 9 * Math.sin((x / w) * 5 + s.x * 0.1),
          ],
        ),
    ],
    cinematic ? "#dfeeff" : snow,
  );
  for (let i = Math.floor(start); i < end; i++) {
    const x = sx(i),
      y = sy(height(s.j, i)) + 30 + noise(i) * 110;
    line(
      c,
      [
        [x, y],
        [x + 6 + noise(i + 1) * 12, y + 1],
      ],
      cinematic ? "#a9b8d5" : "#adbfac",
      1,
    );
  }
  line(
    c,
    [
      [lx, ly - 1],
      [lx, ly - 39],
    ],
    ink,
    2,
  );
  poly(
    c,
    [
      [lx, ly - 39],
      [lx + 24, ly - 39],
      [lx + 17, ly - 33],
      [lx + 22, ly - 28],
      [lx, ly - 28],
    ],
    "#e76837",
  );
  const dash = lip - 4;
  line(
    c,
    [
      [sx(dash), sy(height(s.j, dash)) - 1],
      [lx - 1, ly - 1],
    ],
    "#e89456",
    3,
  );
  if (debug) {
    for (const power of [0.78, 1.04]) {
      const path: Point[] = [];
      for (let t = 0; t < 3; t += 0.03) {
        const x = lip + t * s.j.speed,
          y = height(s.j, lip) - s.j.kick * power * t + 7 * t * t;
        if (t > 0.1 && y >= height(s.j, x)) break;
        path.push([sx(x), sy(y)]);
      }
      line(c, path, "#d56537", 1.3);
    }
  }
  const yy = sy(s.y),
    ground = sy(height(s.j, s.x));
  if (cinematic && s.phase === "air") {
    const landing = sx(s.landingX);
    const landingY = sy(height(s.j, s.landingX));
    line(
      c,
      [
        [landing - 6, landingY - 6],
        [landing, landingY],
        [landing + 7, landingY - 4],
      ],
      "#e3f8ff",
      2,
    );
    if (!lite) {
      for (let i = 0; i < 18; i++) {
        const offset = ((noise(i + 40) + s.tick * 0.013) % 1) * w;
        const y = h * (0.31 + noise(i + 54) * 0.58);
        line(
          c,
          [
            [w - offset, y],
            [w - offset - 6 - noise(i) * 22, y + 1.5],
          ],
          "#daeeff35",
          1,
        );
      }
    }
  }
  c.fillStyle = "#27473330";
  c.beginPath();
  c.ellipse(px, ground + 3, 17, 3, 0, 0, 7);
  c.fill();
  const powder =
    s.phase === "crash"
      ? 38
      : s.phase === "land"
        ? 24
        : s.phase === "run"
          ? 10
          : 0;
  for (let i = 0; i < (lite ? powder / 3 : powder); i++) {
    const f = (noise(i) + s.tick * 0.021) % 1;
    c.fillStyle = ["#ffffeb", "#ffe5ae", "#abe4df"][items[2]];
    c.fillRect(
      px - 9 - f * 35,
      yy - 2 - Math.sin(f * 3) * noise(i + 2) * 14,
      2 + noise(i) * 2,
      2,
    );
  }
  if (
    cinematic &&
    s.contactTick &&
    s.tick - s.contactTick < 32 &&
    s.result?.grade !== "摔倒"
  ) {
    const age = (s.tick - s.contactTick) / 32;
    for (let i = 0; i < (lite ? 16 : 56); i++) {
      const spread = noise(i + 13);
      c.fillStyle = "rgba(233,250,255," + (1 - age) * 0.9 + ")";
      c.beginPath();
      c.arc(
        px + (spread - 0.7) * age * 200,
        yy - Math.sin(age * Math.PI) * noise(i + 43) * 76,
        1 + noise(i) * 3,
        0,
        7,
      );
      c.fill();
    }
  }
  rider(c, px, yy, Math.max(0.8, w / 410) * (cinematic ? 1.55 : 1.1), s, items);
}
export function rider(
  c: C,
  x: number,
  y: number,
  scale: number,
  s: Ski,
  items: number[],
) {
  c.save();
  c.translate(x, y);
  c.scale(scale, scale);
  c.rotate((s.angle * Math.PI) / 180);
  if (s.j.showcase && s.phase === "air") {
    const turn = (s.yaw * Math.PI) / 180;
    const side = Math.cos(turn);
    c.scale((side < 0 ? -1 : 1) * (0.3 + 0.7 * Math.abs(side)), 1);
    c.transform(1, 0, Math.sin(turn) * 0.29, 1, 0, 0);
  } else if (s.phase === "land" && s.result && s.result.halves % 2) {
    c.scale(-1, 1);
  }
  if (s.phase === "crash") {
    c.translate(0, 3);
    c.rotate(-0.56);
  }
  const tucked =
    (s.phase === "run" && s.held) ||
    (s.phase === "air" && s.held) ||
    s.phase === "crash" ||
    (s.phase === "land" && s.tick - s.contactTick < 13);
  const grab = s.grabbing ? s.j.grab : undefined;
  const hip: Point =
      grab === "tail" ? [-9, -12] : tucked ? [-5, -12] : [-3, -20],
    shoulder: Point = tucked ? [2, -20] : [1, -32],
    head: Point = [shoulder[0] + 3, shoulder[1] - 6];
  line(
    c,
    [
      [-17, -3],
      [-14, 0],
      [10, 0],
      [18, -3],
    ],
    ink,
    4,
  );
  line(
    c,
    [
      [-17, -4],
      [-13, -2],
      [11, -2],
      [17, -5],
    ],
    hex(boardColors[items[0]]),
    2.8,
  );
  line(
    c,
    [
      [-11, -1],
      [9, -1],
    ],
    "#ffecac",
    0.9,
  );
  line(
    c,
    [[-8, -3], [-10, -10], hip, [7, tucked ? -11 : -14], [6, -3]],
    ink,
    4.4,
  );
  line(c, [hip, shoulder], hex(suitColors[items[1]]), 10);
  line(
    c,
    [
      [shoulder[0] - 2, shoulder[1] + 3],
      [shoulder[0] + 3, shoulder[1] + 2],
    ],
    "#ecc782",
    2.4,
  );
  const hand: Point =
    grab === "tail"
      ? [-16, -3]
      : grab === "nose"
        ? [15, -4]
        : grab === "indy"
          ? [1, -2]
          : [tucked ? 6 : 15, tucked ? -10 : -21];
  if (grab) {
    const freeHand: Point = grab === "tail" ? [22, -25] : [-20, -17];
    line(c, [shoulder, [freeHand[0] * 0.6, -28], freeHand], "#263942", 3.5);
  }
  line(
    c,
    [
      shoulder,
      grab === "tail" ? [-12, -15] : [shoulder[0] + 8, shoulder[1] + 8],
      hand,
    ],
    ink,
    3.8,
  );
  if (grab) line(c, [hand, [hand[0] + 1.5, hand[1]]], "#ffcb76", 4);
  c.fillStyle = ink;
  c.beginPath();
  c.arc(...head, 5.6, 0, 7);
  c.fill();
  line(
    c,
    [
      [head[0] + 1, head[1]],
      [head[0] + 6, head[1] - 1],
    ],
    "#fa9a50",
    3,
  );
  c.restore();
}
