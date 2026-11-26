import { drawDeckMotif, type Gear } from "../content/gear";
import { trailSample } from "../scenes/trail-art";
import { panorama } from "../scenes/art";

export type ScenicFeature = "daily" | "practice";
function shape(
  c: CanvasRenderingContext2D,
  outline: number[][],
  color: string,
) {
  c.fillStyle = color;
  c.beginPath();
  outline.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fill();
}

function canyon(c: CanvasRenderingContext2D) {
  const sky = c.createLinearGradient(0, 0, 0, 206);
  sky.addColorStop(0, "#eabd9a");
  sky.addColorStop(0.9, "#d0998c");
  c.fillStyle = sky;
  c.fillRect(0, 0, 540, 206);
  c.fillStyle = "#f6d1a3";
  c.beginPath();
  c.arc(368, 51, 29, 0, Math.PI * 2);
  c.fill();
  shape(
    c,
    [
      [0, 97],
      [60, 87],
      [116, 32],
      [171, 38],
      [206, 66],
      [244, 141],
      [271, 132],
      [319, 119],
      [353, 91],
      [396, 94],
      [433, 45],
      [540, 71],
      [540, 206],
      [0, 206],
    ],
    "#9f737a",
  );
  shape(
    c,
    [
      [0, 132],
      [97, 116],
      [136, 68],
      [174, 60],
      [208, 99],
      [240, 152],
      [267, 138],
      [306, 151],
      [348, 134],
      [419, 83],
      [469, 76],
      [540, 94],
      [540, 206],
      [0, 206],
    ],
    "#684f60",
  );
  shape(
    c,
    [
      [82, 106],
      [136, 68],
      [174, 60],
      [207, 98],
      [178, 88],
      [159, 82],
      [142, 86],
      [133, 83],
    ],
    "#f0d8bf",
  );
  shape(
    c,
    [
      [357, 127],
      [419, 83],
      [469, 76],
      [496, 82],
      [461, 87],
      [446, 96],
      [424, 91],
    ],
    "#e7ccbd",
  );
  shape(
    c,
    [
      [0, 161],
      [92, 145],
      [155, 148],
      [215, 173],
      [256, 157],
      [326, 167],
      [402, 151],
      [480, 147],
      [540, 133],
      [540, 206],
      [0, 206],
    ],
    "#503e51",
  );
  shape(
    c,
    [
      [254, 161],
      [291, 161],
      [328, 174],
      [293, 189],
      [365, 206],
      [188, 206],
      [238, 185],
      [290, 173],
    ],
    "#bda8a9",
  );
}
export function scenicArt(
  mountain: number,
  night = false,
  feature?: ScenicFeature,
) {
  const canvas = document.createElement("canvas");
  canvas.width = 540;
  canvas.height = 206;
  canvas.className = "scenic-art";
  canvas.setAttribute("aria-hidden", "true");
  const c = canvas.getContext("2d")!;
  if (mountain === 1 && !night) canyon(c);
  else panorama(c, 540, 206, mountain, night);
  if (feature === "practice") {
    shape(
      c,
      [
        [0, 161],
        [159, 132],
        [201, 99],
        [255, 91],
        [195, 154],
        [162, 174],
        [540, 159],
        [540, 206],
        [0, 206],
      ],
      "#a4c3cb",
    );
    shape(
      c,
      [
        [0, 174],
        [168, 145],
        [225, 101],
        [255, 91],
        [195, 154],
        [162, 174],
        [540, 159],
        [540, 206],
        [0, 206],
      ],
      "#526d7c",
    );
    shape(
      c,
      [
        [173, 133],
        [201, 99],
        [255, 91],
        [226, 108],
      ],
      "#e8f3ee",
    );
  } else if (feature === "daily") {
    for (const [x, y, s] of [
      [285, 92, 0.62],
      [366, 120, 1],
      [455, 137, 1.3],
    ]) {
      c.fillStyle = "#ebdab5";
      c.fillRect(x, y, 2 * s, 44 * s);
      shape(
        c,
        [
          [x, y],
          [x + 34 * s, y + 3 * s],
          [x + 22 * s, y + 12 * s],
          [x + 34 * s, y + 21 * s],
          [x, y + 19 * s],
        ],
        "#df855a",
      );
    }
  }
  return canvas;
}

export function gearArt(item: Gear, category: number, index: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 200;
  canvas.height = 106;
  canvas.className = "gear-art";
  canvas.setAttribute("aria-hidden", "true");
  const c = canvas.getContext("2d")!;
  const glow = c.createRadialGradient(100, 47, 5, 100, 47, 112);
  glow.addColorStop(0, item.color + "53");
  glow.addColorStop(1, "#0a1820");
  c.fillStyle = glow;
  c.fillRect(0, 0, 200, 106);
  c.strokeStyle = item.accent + "22";
  for (const radius of [34, 49, 64]) {
    c.beginPath();
    c.ellipse(100, 54, radius * 1.55, radius, -0.2, 0, Math.PI * 2);
    c.stroke();
  }
  if (category === 0) {
    c.translate(100, 53);
    c.rotate(-0.32);
    c.fillStyle = "#08131b";
    c.beginPath();
    c.roundRect(-79, -13, 158, 33, 10);
    c.fill();
    c.fillStyle = "#c5d4d8";
    c.beginPath();
    c.roundRect(-78, -17, 156, 34, 10);
    c.fill();
    drawDeckMotif(c, -76, -16, 152, 31, item);
    const sheen = c.createLinearGradient(0, -14, 0, 15);
    sheen.addColorStop(0, "#ffffff43");
    sheen.addColorStop(0.36, "#ffffff00");
    sheen.addColorStop(0.9, "#081a282d");
    c.fillStyle = sheen;
    c.beginPath();
    c.roundRect(-76, -16, 152, 31, 10);
    c.fill();
  } else if (category === 1) {
    const path = (outline: number[][], color: string) => {
      c.fillStyle = color;
      c.beginPath();
      outline.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.closePath();
      c.fill();
    };
    path(
      [
        [72, 39],
        [83, 29],
        [87, 16],
        [100, 10],
        [112, 16],
        [117, 28],
        [130, 38],
        [146, 77],
        [133, 83],
        [121, 61],
        [124, 91],
        [76, 91],
        [78, 61],
        [67, 83],
        [54, 77],
      ],
      "#091820",
    );
    path(
      [
        [74, 41],
        [88, 31],
        [90, 18],
        [100, 13],
        [110, 18],
        [113, 31],
        [128, 41],
        [142, 75],
        [134, 79],
        [118, 52],
        [121, 88],
        [79, 88],
        [82, 52],
        [66, 79],
        [58, 75],
      ],
      item.color,
    );
    if (item.motif === 1 || item.motif === 2)
      path(
        [
          [74, 41],
          [88, 31],
          [99, 37],
          [113, 31],
          [128, 41],
          [125, 48],
          [113, 43],
          [100, 48],
          [87, 43],
          [76, 50],
        ],
        item.accent,
      );
    if (item.motif === 0 || item.motif === 3) {
      path(
        [
          [58, 75],
          [61, 68],
          [70, 72],
          [66, 79],
        ],
        item.accent,
      );
      path(
        [
          [130, 72],
          [139, 68],
          [142, 75],
          [134, 79],
        ],
        item.accent,
      );
    }
    path(
      [
        [93, 22],
        [100, 17],
        [108, 22],
        [109, 31],
        [100, 36],
        [91, 31],
      ],
      "#152530",
    );
    path(
      [
        [87, 63],
        [93, 59],
        [93, 67],
        [87, 72],
      ],
      item.accent,
    );
    path(
      [
        [113, 63],
        [107, 59],
        [107, 67],
        [113, 72],
      ],
      item.accent,
    );
    c.fillStyle = "#132736";
    c.fillRect(99, 43, 2, 44);
    c.fillStyle = item.accent;
    c.fillRect(99, 47, 2, 7);
  } else {
    c.strokeStyle = item.accent + "6e";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(31, 80);
    c.bezierCurveTo(71, 93, 82, 19, 165, 26);
    c.stroke();
    trailSample(c, index, 181, 64, 155);
  }
  return canvas;
}
