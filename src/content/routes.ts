import type { Grab } from "./tricks";

export type Jump = {
  lip: number;
  speed: number;
  kick: number;
  slope: number;
  drop: number;
  grab?: Grab;
  showcase?: 360 | 720;
};
export type Route = {
  id: string;
  name: string;
  mountain: number;
  jumps: Jump[];
  mode: "tour" | "park" | "daily" | "show" | "intro";
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
function jumps(p: number[], mountain: number) {
  return p.map((n, i) => ({
    lip: i === 0 ? 12 : 70 + n * 2,
    speed: 10 + n * 0.25,
    kick: 7 + n * 0.45,
    slope: 0.15 + n * 0.026,
    drop: 2.2 + mountain * 0.5 + n * 0.1,
    grab: (["nose", "tail", "indy"] as const)[(mountain + i) % 3],
  }));
}
export const tours: Route[] = patterns.map((p, i) => ({
  id: "tour-" + i,
  name: names[Math.floor(i / 5)][i % 5],
  mountain: Math.floor(i / 5),
  jumps: jumps(p, Math.floor(i / 5)),
  mode: "tour",
}));
export const parks: Route[] = ["落地小台", "转体中台", "长空大台"].map(
  (name, i) => ({
    id: "park-" + i,
    name,
    mountain: i,
    mode: "park",
    jumps: [
      { ...jumps([i * 2], i)[0], grab: (["indy", "nose", "tail"] as const)[i] },
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
      lip: 6,
      speed: 13,
      kick: 12,
      slope: 0.2,
      drop: 4.6,
      grab: "indy",
      showcase: 360,
    },
    {
      lip: 7,
      speed: 15,
      kick: 15,
      slope: 0.21,
      drop: 6,
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
export const boards = ["朱砂", "海盐", "明黄", "冰蓝", "梅紫", "墨绿"],
  suits = ["松针", "岩橙", "靛蓝", "桑莓"],
  trails = ["细雪", "晨光", "冰晶"];
export const boardColors = [
    0xf56537, 0xfff1ce, 0xf7ba36, 0x70d8e4, 0xcb87cf, 0x268d78,
  ],
  suitColors = [0x19483e, 0xaa4d30, 0x3a527e, 0x83445f];
