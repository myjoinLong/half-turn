export type V3 = [number, number, number];
export type P2 = [number, number];
export type SurfaceFinish = { tint: string; strength: number };
type Decal = { points: V3[]; color: string };
export type Face = {
  points: V3[];
  color: string;
  finish?: SurfaceFinish;
  decals?: Decal[];
};
export const add = (a: V3, b: V3): V3 => [
  a[0] + b[0],
  a[1] + b[1],
  a[2] + b[2],
];
export const sub = (a: V3, b: V3): V3 => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];
export const mul = (a: V3, n: number): V3 => [a[0] * n, a[1] * n, a[2] * n];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const unit = (a: V3) => mul(a, 1 / (Math.hypot(...a) || 1));
export const average = (points: V3[]) =>
  mul(points.reduce(add, [0, 0, 0]), 1 / points.length);
export const near = 0.8;
export function placeAboveSnow(
  faces: Face[],
  transform: (v: V3) => V3,
  ground: (x: number) => number,
  breaks: number[],
) {
  const placed = new Map<V3, V3>();
  let lift = 0;
  const check = (point: V3) => {
    lift = Math.max(lift, point[1] - ground(point[0]));
  };
  for (const face of faces) {
    const points = face.points.map((point) => {
      let world = placed.get(point);
      if (!world) {
        world = transform(point);
        placed.set(point, world);
        check(world);
      }
      return world;
    });
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length];
      check(mul(add(a, b), 0.5));
      for (const x of breaks)
        if ((a[0] - x) * (b[0] - x) < 0) {
          const ratio = (x - a[0]) / (b[0] - a[0]);
          check(add(a, mul(sub(b, a), ratio)));
        }
    }
  }
  const above = ([x, y, z]: V3): V3 => [x, y - lift, z];
  return {
    lift,
    faces: faces.map((face) => ({
      ...face,
      points: face.points.map((point) => above(placed.get(point)!)),
      decals: face.decals?.map((decal) => ({
        ...decal,
        points: decal.points.map((point) => above(transform(point))),
      })),
    })),
  };
}

export function nearClip(points: V3[], plane = near) {
  const clipped: V3[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[(i + points.length - 1) % points.length];
    const b = points[i];
    const aVisible = a[2] >= plane,
      bVisible = b[2] >= plane;
    if (aVisible !== bVisible) {
      const t = (plane - a[2]) / (b[2] - a[2]);
      clipped.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, plane]);
    }
    if (bVisible) clipped.push(b);
  }
  return clipped;
}
export function fill(
  c: CanvasRenderingContext2D,
  points: P2[],
  color: string,
  outline?: string,
) {
  if (points.length < 3) return;
  c.beginPath();
  c.moveTo(...points[0]);
  for (let i = 1; i < points.length; i++) c.lineTo(...points[i]);
  c.closePath();
  c.fillStyle = color;
  c.fill();
  if (outline) {
    c.strokeStyle = outline;
    c.lineWidth = 0.65;
    c.stroke();
  }
}

// Painterly stylized alpine lighting: warm golden key sun + cool indigo shadows + snow bounce + Fresnel rim
const light = unit([-0.46, -0.84, 0.28]);
const bounceDir = unit([0.12, 0.96, -0.24]);
const specularDirection = unit(add(light, [0, 0, -1]));
const shades = new Map<string, string>();
function shade(
  color: string,
  keyDot: number,
  finish?: SurfaceFinish,
  gleam = 0,
  rim = 0,
  bounce = 0,
) {
  // Stylized cel-influenced ramp keeps colors saturated instead of muddy grey
  const ramp = keyDot * 0.65 + (keyDot > 0.36 ? 0.35 : keyDot > 0.12 ? 0.16 : 0);
  const level = Math.round(ramp * 20);
  const shine = Math.round(gleam * (finish?.strength ?? 0) * 16);
  const rimStep = Math.round(rim * 10);
  const bounceStep = Math.round(bounce * 10);
  const tint = shine ? finish?.tint : undefined;
  const key =
    color + "/" + level + "/" + (tint ?? "") + "/" + shine + "/" + rimStep + "/" + bounceStep;
  const saved = shades.get(key);
  if (saved) return saved;
  const rgb = parseInt(color.slice(1), 16);
  const highlight = tint ? parseInt(tint.slice(1), 16) : 0;
  // Cool indigo shadow tint (#1c3456), warm golden sun tint (#fff3d4), snow bounce (#bfe8ff), rim (#eef8ff)
  const shadowRgb = [28, 52, 86];
  const sunRgb = [255, 243, 212];
  const bounceRgb = [191, 232, 255];
  const rimRgb = [238, 248, 255];
  const t = level / 20;
  const channels = [16, 8, 0].map((shift, idx) => {
    const base = (rgb >> shift) & 255;
    // Shift shadows toward cool indigo rather than muddy black
    const darkMix = Math.max(0, 1 - t * 1.45);
    let val = base * (0.78 + 0.34 * t);
    val = val * (1 - darkMix * 0.38) + shadowRgb[idx] * (darkMix * 0.38);
    // Warm sunlit lift on key-facing planes
    if (t > 0.55) {
      const sunAmt = (t - 0.55) * 0.32;
      val = val + (sunRgb[idx] - val) * sunAmt;
    }
    if (bounceStep > 0) {
      const bAmt = (bounceStep / 10) * 0.16;
      val = val + (bounceRgb[idx] - val) * bAmt;
    }
    if (rimStep > 0) {
      const rAmt = (rimStep / 10) * 0.22;
      val = val + (rimRgb[idx] - val) * rAmt;
    }
    if (shine > 0) {
      const target = (highlight >> shift) & 255;
      val = val + ((target - val) * shine) / 16;
    }
    return Math.round(Math.max(0, Math.min(255, val)));
  });
  const css = "rgb(" + channels.join(",") + ")";
  shades.set(key, css);
  return css;
}
export function paintFaces(
  c: CanvasRenderingContext2D,
  faces: Face[],
  camera: (v: V3) => V3,
  screen: (v: V3) => P2,
) {
  const ordered: {
    screenPts: P2[];
    depth: number;
    color: string;
    decals?: { screenPts: P2[]; color: string }[];
  }[] = [];
  for (const face of faces) {
    const points = face.points.map(camera);
    const normal = unit(
      cross(sub(points[1], points[0]), sub(points[2], points[0])),
    );
    const center = average(points);
    if (dot(normal, center) >= 0) continue;
    const visible = nearClip(points);
    if (visible.length < 3) continue;
    const keyDot = Math.max(0, dot(normal, light));
    const viewDir = unit(mul(center, -1));
    const grazing = Math.max(0, 1 - Math.abs(dot(normal, viewDir)));
    const rim = grazing ** 2.8;
    const bounce = Math.max(0, dot(normal, bounceDir));
    ordered.push({
      screenPts: visible.map(screen),
      depth: center[2],
      color: shade(
        face.color,
        keyDot,
        face.finish,
        face.finish ? Math.max(0, dot(normal, specularDirection)) ** 6 : 0,
        rim,
        bounce,
      ),
      decals: face.decals?.map((decal) => ({
        screenPts: nearClip(decal.points.map(camera)).map(screen),
        color: shade(decal.color, keyDot, undefined, 0, rim * 0.4, bounce * 0.4),
      })),
    });
  }
  ordered.sort((a, b) => b.depth - a.depth);
  // Pass 1: crisp outer silhouette contour (internal seams are painted over in Pass 2)
  c.save();
  c.strokeStyle = "rgba(13, 27, 42, 0.78)";
  c.lineWidth = 2.6;
  c.lineJoin = "round";
  c.lineCap = "round";
  for (const face of ordered) {
    if (face.screenPts.length < 3) continue;
    c.beginPath();
    c.moveTo(...face.screenPts[0]);
    for (let i = 1; i < face.screenPts.length; i++)
      c.lineTo(...face.screenPts[i]);
    c.closePath();
    c.stroke();
  }
  c.restore();
  // Pass 2: painterly shaded faces & decals
  for (const face of ordered) {
    fill(c, face.screenPts, face.color, face.color);
    for (const decal of face.decals ?? [])
      fill(c, decal.screenPts, decal.color);
  }
}
