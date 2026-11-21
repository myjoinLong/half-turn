export type V3 = [number, number, number];
export type P2 = [number, number];
export type Face = { points: V3[]; color: string };
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
  return {
    lift,
    faces: faces.map((face) => ({
      color: face.color,
      points: face.points.map((point) => {
        const [x, y, z] = placed.get(point)!;
        return [x, y - lift, z] as V3;
      }),
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
const light = unit([-0.45, -0.86, 0.3]);
const shades = new Map<string, string>();
function shade(color: string, intensity: number) {
  const level = Math.round(intensity * 20);
  const key = color + "/" + level;
  const saved = shades.get(key);
  if (saved) return saved;
  const rgb = parseInt(color.slice(1), 16);
  const shade = [rgb >> 16, (rgb >> 8) & 255, rgb & 255].map((channel) =>
    Math.min(255, Math.round((channel * level) / 20)),
  );
  const css = "rgb(" + shade.join(",") + ")";
  shades.set(key, css);
  return css;
}
export function paintFaces(
  c: CanvasRenderingContext2D,
  faces: Face[],
  camera: (v: V3) => V3,
  screen: (v: V3) => P2,
) {
  const ordered: { points: V3[]; depth: number; color: string }[] = [];
  for (const face of faces) {
    const points = face.points.map(camera);
    const normal = unit(
      cross(sub(points[1], points[0]), sub(points[2], points[0])),
    );
    const center = average(points);
    if (dot(normal, center) >= 0) continue;
    const visible = nearClip(points);
    if (visible.length < 3) continue;
    ordered.push({
      points: visible,
      depth: center[2],
      color: shade(face.color, 0.73 + 0.32 * Math.max(0, dot(normal, light))),
    });
  }
  ordered.sort((a, b) => b.depth - a.depth);
  for (const face of ordered)
    fill(c, face.points.map(screen), face.color, face.color);
}
