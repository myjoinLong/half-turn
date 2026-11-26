import type { Grab } from "./tricks";

export type Jump = {
  lip: number;
  speed: number;
  kick: number;
  slope: number;
  drop: number;
  grab?: Grab;
  showcase?: 360 | 720;
  trail?: {
    bend: number;
    waves: number;
    width: number;
    runout: number;
    gates: number[];
  };
};
export type Route = {
  id: string;
  name: string;
  mountain: number;
  jumps: Jump[];
  mode: "tour" | "park" | "daily" | "show" | "intro" | "match";
};
export const mountains = ["松林山", "峡谷山", "夜光山"];
const names = [
  ["初雪山脊", "林间电台", "白桦小径", "北风垭口", "松林决赛"],
  ["鹰翼峡口", "回声长廊", "断崖来信", "逐风岭", "峡谷决赛"],
  ["蓝调时刻", "月下接力", "星轨长街", "极夜快线", "夜光决赛"],
];
const patterns = [
  [0, 2, 1, 3],
  [1, 0, 3, 2],
  [2, 1, 4, 0],
  [3, 2, 0, 4],
  [0, 3, 4, 2, 1],
  [2, 4, 3, 1],
  [3, 1, 5, 2],
  [4, 2, 1, 5],
  [1, 5, 4, 3],
  [2, 5, 3, 4, 0],
  [1, 3, 2, 5],
  [3, 0, 4, 5],
  [4, 3, 5, 1],
  [5, 1, 3, 4],
  [5, 4, 1, 3, 2],
];
const terrain = [
  { title: "林道缓弯", bend: 6, waves: 1, width: 9 },
  { title: "连续蛇形弯", bend: 11, waves: 2, width: 10 },
  { title: "峡谷窄道", bend: -9, waves: 1, width: 7 },
  { title: "横切长坡", bend: -13, waves: 2, width: 11 },
  { title: "波浪岭", bend: 10, waves: 3, width: 9 },
  { title: "陡坡冲刺", bend: -16, waves: 2, width: 10 },
];
export function trailName(j: Jump) {
  return j.showcase
    ? "大跳台"
    : (terrain.find((t) => t.bend === j.trail?.bend)?.title ?? "落地坡");
}
function jumps(p: number[], mountain: number, line = 0) {
  return p.map((n, i) => ({
    lip: line === 0 && i === 0 ? 46 : 114 + n * 10 + (line % 5) * 9 + i * 4,
    speed: 15 + mountain * 1.6 + n * 0.65,
    kick: 7.3 + n * 0.6,
    slope: 0.19 + n * 0.018,
    drop: 3.4 + mountain * 1.5 + n * 0.55,
    trail: {
      ...terrain[n],
      runout: 44 + n * 4,
      gates: i === 0 && line === 0 ? [0.35] : [0.22, 0.46, 0.68],
    },
    grab: (["nose", "tail", "indy"] as const)[(mountain + i) % 3],
  }));
}
export const tours: Route[] = patterns.map((p, i) => ({
  id: "tour-" + i,
  name: names[Math.floor(i / 5)][i % 5],
  mountain: Math.floor(i / 5),
  jumps: jumps(p, Math.floor(i / 5), i),
  mode: "tour",
}));
export const parks: Route[] = ["落地小台", "转体中台", "长空大台"].map(
  (name, i) => ({
    id: "park-" + i,
    name,
    mountain: i,
    mode: "park",
    jumps: [
      {
        ...jumps([i * 2], i)[0],
        lip: 43 + i * 21,
        trail: { ...terrain[i * 2], runout: 52 + i * 13, gates: [0.35, 0.62] },
        grab: (["indy", "nose", "tail"] as const)[i],
      },
    ],
  }),
);
export const opening: Route = {
  id: "opening",
  name: "极光大跳台",
  mountain: 2,
  mode: "intro",
  jumps: [
    {
      lip: 53,
      speed: 15,
      kick: 11,
      slope: 0.27,
      drop: 24,
      grab: "indy",
      showcase: 360,
    },
    {
      lip: 75,
      speed: 17,
      kick: 14,
      slope: 0.29,
      drop: 32,
      grab: "tail",
      showcase: 720,
    },
  ],
};
export function daily(date = new Date()): Route {
  const day = Math.floor((date.getTime() + 28800000) / 86400000),
    n = ((day % 14) + 14) % 14;
  return {
    ...tours[n],
    id: "daily-" + day,
    name: "每日表演 · " + String(n + 1).padStart(2, "0"),
    mode: "daily",
  };
}
