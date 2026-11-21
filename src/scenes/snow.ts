export type SnowProfilePoint = { x: number; y: number };

// Each run indexes section edges that the rider's camera can see as one snow surface.
export function visibleSnowRuns(
  points: SnowProfilePoint[],
  eyeX: number,
  eyeY: number,
) {
  const runs: [number, number][] = [];
  let start: number | undefined;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    const span = b.x - a.x;
    const visible =
      span > 1e-6 && (a.y - eyeY) * span + (b.y - a.y) * (eyeX - a.x) > 0;
    if (visible) {
      start ??= i - 1;
    } else if (start !== undefined) {
      runs.push([start, i - 1]);
      start = undefined;
    }
  }
  if (start !== undefined) runs.push([start, points.length - 1]);
  return runs;
}
