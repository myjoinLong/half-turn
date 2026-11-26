import { trailGear } from "../content/gear";

const appearance = [
  { shape: "powder", life: 27, spread: 1, lift: 1, size: 1, wake: 0 },
  {
    shape: "glint",
    life: 32,
    spread: 0.86,
    lift: 1.12,
    size: 1.12,
    wake: 0.12,
  },
  {
    shape: "crystal",
    life: 29,
    spread: 1.11,
    lift: 1.14,
    size: 1.23,
    wake: 0.14,
  },
  { shape: "petal", life: 39, spread: 1.2, lift: 0.92, size: 1.17, wake: 0.19 },
  {
    shape: "needle",
    life: 25,
    spread: 0.82,
    lift: 0.84,
    size: 1.12,
    wake: 0.25,
  },
  { shape: "spark", life: 24, spread: 1.16, lift: 1.1, size: 1.31, wake: 0.18 },
  { shape: "fog", life: 49, spread: 1.3, lift: 0.59, size: 1.66, wake: 0 },
  {
    shape: "ribbon",
    life: 42,
    spread: 1.23,
    lift: 1.22,
    size: 1.31,
    wake: 0.34,
  },
] as const;

export function trailAppearance(index: number) {
  return appearance[index] ?? appearance[0];
}

const sprites = new Map<number, HTMLCanvasElement>();
function sprite(index: number, variant: number) {
  const id = index * 2 + variant;
  const cached = sprites.get(id);
  if (cached) return cached;
  const img = document.createElement("canvas");
  img.width = img.height = 40;
  const c = img.getContext("2d")!;
  c.translate(20, 20);
  const gear = trailGear[index] ?? trailGear[0];
  const color = variant === 1 ? gear.accent : gear.color;
  const { shape } = trailAppearance(index);
  const point = (coords: [number, number][], tone: string) => {
    c.fillStyle = tone;
    c.beginPath();
    c.moveTo(...coords[0]);
    for (const xy of coords.slice(1)) c.lineTo(...xy);
    c.fill();
  };
  const glow = (radius: number, opacity: string) => {
    const fade = c.createRadialGradient(0, 0, 0, 0, 0, radius);
    fade.addColorStop(0, color + opacity);
    fade.addColorStop(0.46, color + "88");
    fade.addColorStop(1, color + "00");
    c.fillStyle = fade;
    c.fillRect(-radius, -radius, 2 * radius, 2 * radius);
  };
  switch (shape) {
    case "powder":
      glow(12, "e8");
      point(
        [
          [-4, -2],
          [2, -5],
          [5, -1],
          [1, 4],
          [-5, 2],
        ],
        color,
      );
      break;
    case "glint":
      glow(14, "d0");
      point(
        [
          [-12, 0],
          [-3, -2],
          [0, -11],
          [2, -2],
          [12, 0],
          [3, 2],
          [0, 9],
          [-2, 2],
        ],
        "#fff4d7",
      );
      break;
    case "crystal":
      point(
        [
          [-9, 2],
          [1, -13],
          [9, -5],
          [6, 6],
          [-2, 13],
        ],
        color,
      );
      point(
        [
          [-9, 2],
          [1, -13],
          [4, 2],
          [-2, 13],
        ],
        "#e9fbff",
      );
      break;
    case "petal":
      c.rotate(-0.34);
      c.scale(1.2, 0.58);
      glow(16, "b5");
      point(
        [
          [-12, 0],
          [-1, -5],
          [11, -2],
          [3, 4],
        ],
        color + "c0",
      );
      break;
    case "needle":
    case "spark": {
      const dart = c.createLinearGradient(-18, 0, 15, 0);
      dart.addColorStop(0, color + "00");
      dart.addColorStop(0.58, color + "b5");
      dart.addColorStop(1, shape === "spark" ? "#fff4c6" : "#ddfff0");
      c.fillStyle = dart;
      c.beginPath();
      c.moveTo(-19, 0);
      c.quadraticCurveTo(3, -5, 16, -1);
      c.quadraticCurveTo(19, 3, 9, 3);
      c.fill();
      if (shape === "spark")
        point(
          [
            [7, -3],
            [12, -4],
            [15, 0],
            [11, 4],
          ],
          "#ffe2a9",
        );
      break;
    }
    case "fog":
      c.scale(1, 0.7);
      glow(19, "a3");
      break;
    case "ribbon":
      glow(17, "a0");
      c.strokeStyle = color;
      c.lineWidth = 3;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(-14, 5);
      c.bezierCurveTo(-5, -11, 5, 11, 14, -5);
      c.stroke();
  }
  sprites.set(id, img);
  return img;
}

export function paintFlake(
  c: CanvasRenderingContext2D,
  index: number,
  x: number,
  y: number,
  radius: number,
  seed: number,
  alpha: number,
  angle = 0,
) {
  if (alpha <= 0.009 || radius < 0.3) return;
  c.save();
  c.globalAlpha *= alpha;
  c.translate(x, y);
  if (angle) c.rotate(angle);
  const size = radius * 2;
  c.drawImage(
    sprite(index, seed % 3 === 1 ? 1 : 0),
    -radius,
    -radius,
    size,
    size,
  );
  c.restore();
}

export function trailSample(
  c: CanvasRenderingContext2D,
  index: number,
  x: number,
  y: number,
  width: number,
  clock = 740,
) {
  const age = (clock % 1480) / 1480;
  const swell = Math.sin(Math.PI * age);
  const look = trailAppearance(index);
  for (let i = 0; i < 32; i++) {
    const f = (i * 0.618 + age * 2) % 1;
    const bias = Math.sin(i * 32.4);
    const rise = f * (8 + swell * 17) * look.lift;
    paintFlake(
      c,
      index,
      x - f * width,
      y - rise + bias * f * (5 + swell * 8) * look.spread,
      (2.2 + ((i * 7) % 5) * 0.77) * look.size,
      i,
      0.75 - f * 0.61,
      -0.19 + bias * 0.42,
    );
  }
}
