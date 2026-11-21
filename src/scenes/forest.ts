import type { V3 } from "./geometry";

export type SnowEdge = { x: number; y: number; left: number; right: number };

export function visibleTreeHeight(
  eye: V3,
  snow: SnowEdge[],
  x: number,
  z: number,
) {
  const distance = x - eye[0];
  if (distance <= 0) return -Infinity;
  const raySlope = (z - eye[2]) / distance;
  let ceiling = Infinity;
  for (let i = 1; i < snow.length; i++) {
    const a = snow[i - 1],
      b = snow[i];
    if (a.x >= x) break;
    if (b.x <= eye[0] + 0.04 || b.x - a.x < 1e-6) continue;
    let low = Math.max(a.x, eye[0] + 0.04);
    let high = Math.min(b.x, x - 0.015);
    if (low > high) continue;
    const interpolate = (start: number, end: number, at: number) =>
      start + ((end - start) * (at - a.x)) / (b.x - a.x);
    // Clip the ray interval to the two moving edges of this snow strip.
    for (const side of ["left", "right"] as const) {
      const sign = side === "left" ? 1 : -1;
      const gap = (at: number) =>
        sign *
        (eye[2] + (at - eye[0]) * raySlope - interpolate(a[side], b[side], at));
      const near = gap(low),
        far = gap(high);
      if (near < 0 && far < 0) {
        low = Infinity;
        break;
      }
      if (near < 0 || far < 0) {
        const crossing = low + ((high - low) * near) / (near - far);
        if (near < 0) low = crossing;
        else high = crossing;
      }
    }
    if (low > high) continue;
    for (const at of [low, high]) {
      const y = interpolate(a.y, b.y, at);
      ceiling = Math.min(
        ceiling,
        eye[1] + ((y - eye[1]) * distance) / (at - eye[0]),
      );
    }
  }
  return ceiling;
}

export function clipTree(points: V3[], clearance: (point: V3) => number): V3[] {
  const clipped: V3[] = [];
  const gaps = points.map(clearance);
  for (let i = 0; i < points.length; i++) {
    const previous = (i + points.length - 1) % points.length;
    const a = points[previous],
      b = points[i],
      from = gaps[previous],
      to = gaps[i];
    if (from >= 0 !== to >= 0) {
      const blend = from / (from - to);
      clipped.push([
        a[0] + (b[0] - a[0]) * blend,
        a[1] + (b[1] - a[1]) * blend,
        a[2] + (b[2] - a[2]) * blend,
      ]);
    }
    if (to >= 0) clipped.push(b);
  }
  return clipped;
}
