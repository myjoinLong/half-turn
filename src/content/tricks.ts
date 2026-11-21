export const grabs = {
  indy: { name: "抓前刃", label: "后手抓脚尖刃" },
  nose: { name: "抓板头", label: "前手抓板头" },
  tail: { name: "抓板尾", label: "后手抓板尾" },
  melon: { name: "绕腿抓后刃", label: "前手绕腿抓后刃" },
  stalefish: { name: "绕膝抓后刃", label: "后手绕膝抓后刃" },
  japan: { name: "收膝抓板", label: "前手抓脚尖刃，前膝向板面收拢" },
} as const;

export type Grab = keyof typeof grabs;
export const grabOrder: Grab[] = [
  "indy",
  "nose",
  "tail",
  "melon",
  "stalefish",
  "japan",
];
