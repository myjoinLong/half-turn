export const grabs = {
  indy: { name: "Indy", label: "后手抓脚尖刃" },
  nose: { name: "Nosegrab", label: "前手抓板头" },
  tail: { name: "Tailgrab", label: "后手抓板尾" },
} as const;

export type Grab = keyof typeof grabs;
