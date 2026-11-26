type C = CanvasRenderingContext2D;
type Point = [number, number];
function poly(c: C, p: Point[], color: string | CanvasGradient) {
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
  const canyon = m === 1;
  const grad = c.createLinearGradient(0, 0, 0, h);
  const sky = aurora
    ? ["#07102c", "#1c3464", "#67a4b8"]
    : night
      ? ["#1d2e54", "#5c85a6", "#bfd0d2"]
      : canyon
        ? ["#3c557a", "#d68d7b", "#f6ce9f"]
        : ["#3f7d99", "#d8c8a8", "#f7cca0"];
  grad.addColorStop(0, sky[0]);
  grad.addColorStop(0.46, sky[1]);
  grad.addColorStop(1, sky[2]);
  c.fillStyle = grad;
  c.fillRect(0, 0, w, h);

  if (aurora || night) {
    // Richer starfield
    for (let i = 0; i < (aurora ? 140 : 70); i++) {
      const bright = i % 9 === 0;
      c.fillStyle = bright ? "#ffffffd8" : "#c7deff88";
      const sz = bright ? 2 : 1.2;
      c.fillRect(noise(i) * w, noise(i + 200) * h * 0.44, sz, sz);
    }
  }
  if (aurora) {
    // Sweeping multi-layered northern aurora curtains with bright luminous core
    for (let i = 0; i < 18; i++) {
      const ribbon: Point[] = [];
      for (let x = 0; x <= w; x += 6)
        ribbon.push([
          x,
          h *
            (0.14 +
              i * 0.0065 +
              0.072 * Math.sin((x / w) * 4.6 + i * 0.065) +
              0.018 * Math.cos((x / w) * 9.2 - i * 0.12)),
        ]);
      line(
        c,
        ribbon,
        ["#5affd832", "#6ce4ff28", "#b38cff2a"][i % 3],
        h * (0.036 - (i % 3) * 0.006),
      );
    }
    // Crisp bright aurora edge filament
    const coreRibbon: Point[] = [];
    for (let x = 0; x <= w; x += 6)
      coreRibbon.push([
        x,
        h * (0.2 + 0.072 * Math.sin((x / w) * 4.6 + 0.5)),
      ]);
    line(c, coreRibbon, "#9dffee48", h * 0.009);
  }

  const sunX = w * (canyon ? 0.67 : 0.79);
  const sunY = h * (aurora || night ? 0.21 : 0.24);
  const sunRadius = Math.min(h * 0.112, w * (aurora || night ? 0.052 : 0.08));
  // Outer atmospheric glow
  const outerHalo = c.createRadialGradient(
    sunX,
    sunY,
    sunRadius * 0.5,
    sunX,
    sunY,
    sunRadius * 4.2,
  );
  outerHalo.addColorStop(
    0,
    aurora || night ? "#baf2ff52" : canyon ? "#ffbf8070" : "#ffdf9c78",
  );
  outerHalo.addColorStop(
    0.45,
    aurora || night ? "#7cd5ff18" : "#ffca8a24",
  );
  outerHalo.addColorStop(1, "#ffffff00");
  c.fillStyle = outerHalo;
  c.fillRect(
    sunX - sunRadius * 4.2,
    sunY - sunRadius * 4.2,
    sunRadius * 8.4,
    sunRadius * 8.4,
  );
  const disc = c.createLinearGradient(
    sunX,
    sunY - sunRadius,
    sunX,
    sunY + sunRadius,
  );
  disc.addColorStop(0, aurora || night ? "#f5ffff" : "#fff1cc");
  disc.addColorStop(1, aurora || night ? "#9ecae2" : "#f0985c");
  c.fillStyle = disc;
  c.beginPath();
  c.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
  c.fill();

  for (let i = 0; i < 6; i++) {
    const x = noise(i + 9) * w,
      y = h * (0.1 + 0.19 * noise(i + 13));
    const length = w * (0.19 + 0.16 * noise(i + 30)),
      high = h * (0.009 + 0.011 * noise(i + 8));
    const light = c.createLinearGradient(x, y - high, x, y + high);
    light.addColorStop(0, "#e9f6f800");
    light.addColorStop(0.48, aurora || night ? "#c2e0ff26" : "#fff6df62");
    light.addColorStop(1, "#e9f6f800");
    c.fillStyle = light;
    c.beginPath();
    c.moveTo(x - length * 0.5, y);
    c.bezierCurveTo(
      x - length * 0.25,
      y - high * 1.4,
      x + length * 0.2,
      y - high,
      x + length * 0.5,
      y,
    );
    c.bezierCurveTo(
      x + length * 0.15,
      y + high,
      x - length * 0.21,
      y + high,
      x - length * 0.5,
      y,
    );
    c.fill();
  }
  const ridge = (pts: Point[], color: string | CanvasGradient) =>
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
    aurora ? "#6781ac" : night ? "#86a5bc" : canyon ? "#c89795" : "#a3c0bd",
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
  const peakShade = c.createLinearGradient(0, h * 0.188, 0, h * 0.51);
  peakShade.addColorStop(
    0,
    aurora ? "#6c95c2" : night ? "#789bb0" : canyon ? "#a86d74" : "#769a9b",
  );
  peakShade.addColorStop(
    1,
    aurora ? "#233d6b" : night ? "#355472" : canyon ? "#5b4462" : "#3f6d73",
  );
  ridge(peak, peakShade);
  const facet = (p: Point[], color: string) =>
    poly(
      c,
      p.map(([x, y]) => [x * w, y * h]),
      color,
    );
  // Crisp sunlit snow-capped alpine ridges (alpenglow in day/canyon, moonlit cyan at night)
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
    aurora || night ? "#d4ecff" : canyon ? "#ffe7cb" : "#fff7e2",
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
    aurora || night ? "#9ac0dc" : canyon ? "#e2b8a8" : "#d3e5de",
  );
  facet(
    [
      [0.42, 0.19],
      [0.4, 0.306],
      [0.32, 0.4],
      [0.365, 0.32],
      [0.34, 0.33],
    ],
    aurora || night ? "#35537c" : canyon ? "#6b4860" : "#446e78",
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
    aurora || night ? "#b6d8eb" : "#f4f1da",
  );

  // Atmospheric valley mist bands between forest ridges for strong aerial depth
  for (let k = 0; k < 3; k++) {
    const mistY = h * (0.41 + k * 0.068);
    const mist = c.createLinearGradient(0, mistY - h * 0.05, 0, mistY + h * 0.07);
    mist.addColorStop(0, "#ffffff00");
    mist.addColorStop(
      0.5,
      aurora || night
        ? "#8dc5e81e"
        : canyon
          ? "#ffd7b228"
          : "#fff4dc2e",
    );
    mist.addColorStop(1, "#ffffff00");
    c.fillStyle = mist;
    c.fillRect(0, mistY - h * 0.05, w, h * 0.12);

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
    const layers =
      aurora || night
        ? ["#486988", "#2d4c68", "#1d354c"]
        : canyon
          ? ["#96808a", "#6d5f7d", "#424666"]
          : ["#789d94", "#517e70", "#305e52"];
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
    // Warm distant ski lodge lights twinkling in the valley on aurora/night scenes
    if ((aurora || night) && k === 1) {
      for (let i = 0; i < 14; i++) {
        const lx = w * (0.12 + noise(i + 55) * 0.76);
        const idx = Math.min(70, Math.floor((lx / w) * 70));
        const ly = pts[idx][1] * h + 12 + noise(i + 99) * 14;
        c.fillStyle = "#ffd98c99";
        c.fillRect(lx, ly, 2.2, 2.2);
      }
    }
  }
  for (let i = 0; i < Math.min(18000, (w * h) / 18); i++) {
    c.fillStyle = i % 2 ? "#fff7da14" : "#274a350e";
    c.fillRect(noise(i) * w, noise(i + 3101) * h, 1, 1);
  }
}
