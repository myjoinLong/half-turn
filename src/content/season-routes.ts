import { tours, type Route } from "./routes";

function course(
  id: string,
  name: string,
  base: Route,
  approaches: number[],
  exits: number[],
  bigAir = false,
): Route {
  return {
    ...base,
    id: "meet-" + id,
    name,
    mode: "match",
    jumps: approaches.map((lip, i) => {
      const jump = base.jumps[i];
      return {
        ...jump,
        lip,
        kick: bigAir ? 10 + 0.8 * i : jump.kick,
        drop: bigAir ? 12 + 2.5 * i : jump.drop,
        trail: {
          ...jump.trail!,
          runout: exits[i],
          gates: bigAir ? [0.29, 0.62] : [0.22, 0.48, 0.72],
        },
      };
    }),
  };
}

export const stations = [
  {
    id: "pine",
    detail: "密集旗门 · 连续三跳",
    route: course("pine", "松林公开赛", tours[0], [91, 116, 122], [57, 62, 64]),
  },
  {
    id: "canyon",
    detail: "高落差 · 三座大跳台",
    route: course(
      "canyon",
      "峡谷大跳台分站",
      tours[9],
      [86, 105, 116],
      [89, 100, 106],
      true,
    ),
  },
  {
    id: "night",
    detail: "高速连弯 · 四段总决战",
    route: course(
      "night",
      "夜光总决赛",
      tours[14],
      [107, 119, 131, 142],
      [58, 61, 64, 68],
    ),
  },
] as const;

export const rivals = [
  "林渡",
  "谢飞羽",
  "方雪川",
  "顾山岚",
  "沈棠",
  "唐小满",
  "陆北辰",
] as const;

// High-contrast showcase loadouts [boardIdx, suitIdx, trailIdx] for each virtual rival
export const rivalOutfits: readonly [number, number, number][] = [
  [2, 1, 1], // 林渡: 明黄 + 岩橙 + 晨光
  [3, 4, 2], // 谢飞羽: 冰蓝 + 雪线巡逻 + 冰晶
  [8, 10, 5], // 方雪川: 峡谷电火 + 极夜信号 + 流星
  [13, 6, 4], // 顾山岚: 极光织带 + 萤石 + 青磷
  [4, 7, 3], // 沈棠: 梅紫 + 晚霞邮票 + 霞光
  [10, 8, 6], // 唐小满: 柚子汽水 + 冰川向导 + 银雾
  [15, 11, 7], // 陆北辰: 终点旗 + 胜场金 + 极光
];

export function outfitForRival(id: number): [number, number, number] {
  return [...(rivalOutfits[id] ?? rivalOutfits[6])];
}
