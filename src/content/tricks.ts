export const grabs = {
  indy: { name: "Indy", label: "后手抓脚尖刃" },
  nose: { name: "Nosegrab", label: "前手抓板头" },
  tail: { name: "Tailgrab", label: "后手抓板尾" },
  melon: { name: "Melon", label: "前手绕腿抓后刃" },
  stalefish: { name: "Stalefish", label: "后手绕膝抓后刃" },
  japan: { name: "Japan", label: "前手抓脚尖刃，前膝向板面收拢" },
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
