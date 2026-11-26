export type GearCurrency = "coins" | "aurora";
export type Gear = {
  name: string;
  description: string;
  color: string;
  accent: string;
  price: number;
  motif: number;
  currency: GearCurrency;
};
function catalog(
  items: readonly [
    string,
    string,
    string,
    string,
    number,
    number,
    GearCurrency,
  ][],
): Gear[] {
  return items.map(
    ([name, description, color, accent, price, motif, currency]) => ({
      name,
      description,
      color,
      accent,
      price,
      motif,
      currency,
    }),
  );
}

// 前几款常规涂装使用雪币，高颜值限定与炫彩特效使用极光券，彻底与能力升级解耦
export const boardGear = catalog([
  ["朱砂", "暖红板头与石墨底", "#f56537", "#ffe4ae", 0, 0, "coins"],
  ["海盐", "浪形纹穿过白色板面", "#fff1ce", "#507e9d", 100, 1, "coins"],
  ["明黄", "晨光色板头与深蓝斜纹", "#f7ba36", "#283b60", 120, 2, "coins"],
  ["冰蓝", "浅蓝板面叠出冰裂纹", "#70d8e4", "#f1feff", 140, 3, "coins"],
  ["梅紫", "紫色暮云与柔金月轮", "#cb87cf", "#fff0bb", 160, 4, "coins"],
  ["墨绿", "林线从板尾延伸到板头", "#268d78", "#b1ebbb", 180, 5, "coins"],
  ["雪国邮差", "红蓝封边与对角邮戳", "#f3e6cd", "#bc544a", 25, 6, "aurora"],
  ["北纬四十七", "黑蓝底上的雪峰轮廓", "#264b77", "#c7e4ed", 30, 5, "aurora"],
  ["峡谷电火", "分段亮橙闪电贯穿板面", "#432f62", "#ffab5c", 35, 2, "aurora"],
  ["夜航", "一弯新月与深色雪底", "#24375d", "#9ae8ef", 38, 4, "aurora"],
  ["柚子汽水", "明亮柚色与气泡圆纹", "#f5da70", "#ef7769", 40, 7, "aurora"],
  ["白桦年轮", "白桦纹围绕琥珀板心", "#a96d49", "#fae8b7", 42, 7, "aurora"],
  ["浪脊", "深蓝板尾叠着两道潮线", "#3076ab", "#bdeed9", 45, 1, "aurora"],
  ["极光织带", "深靛板面上的三道极光", "#3a4976", "#86f0c7", 50, 6, "aurora"],
  ["冻湖", "苍青冰面下的银白裂纹", "#53989e", "#dffaf7", 55, 3, "aurora"],
  ["终点旗", "深底与错落的金色方旗", "#333d4a", "#efc36c", 65, 8, "aurora"],
]);
export const suitGear = catalog([
  ["松针", "松绿外壳配炭黑裤腿", "#19483e", "#aac7a6", 0, 0, "coins"],
  ["岩橙", "暖橙外壳和浅砂肩片", "#aa4d30", "#ebae7d", 100, 1, "coins"],
  ["靛蓝", "靛青外壳配银白袖口", "#3a527e", "#bfd8f0", 120, 2, "coins"],
  ["桑莓", "莓色外套配灰粉护肩", "#83445f", "#eab4ca", 145, 3, "coins"],
  ["雪线巡逻", "象牙色肩片配橙红袖口", "#c8d9ca", "#eb7a49", 170, 2, "coins"],
  ["午夜山脊", "墨蓝外衣与冰青肩片", "#283855", "#84d2e5", 28, 1, "aurora"],
  ["萤石", "青绿外衣配暖黄滑雪手套", "#39766d", "#ebce71", 32, 3, "aurora"],
  ["晚霞邮票", "淡紫肩片与酒红机能外套", "#654d84", "#c8aff4", 36, 1, "aurora"],
  ["冰川向导", "浅冰蓝外衣配深蓝裤腿", "#88bacc", "#37517b", 40, 2, "aurora"],
  ["林海", "暗绿外壳与亮橄榄袖口", "#4c6440", "#d0df91", 44, 3, "aurora"],
  ["极夜信号", "煤黑外衣配亮橙肩片", "#333849", "#f9ae66", 52, 1, "aurora"],
  ["胜场金", "深蓝底配金色护肩", "#35415c", "#edd084", 60, 2, "aurora"],
]);
export const trailGear = catalog([
  ["细雪", "轻白雪点随板尾散开", "#e9f5f6", "#a6c7d5", 0, 0, "coins"],
  ["晨光", "细金星在板尾闪烁，落地时向外散开", "#ffe4ae", "#dc9867", 110, 1, "coins"],
  ["冰晶", "蓝白碎晶在压刃和落地时向外迸开", "#abe4df", "#628ec0", 140, 2, "coins"],
  [
    "霞光",
    "粉色薄片随雪粉翻起，留下一道柔亮弧线",
    "#f4b9cf",
    "#be789d",
    25,
    3,
    "aurora",
  ],
  ["青磷", "低矮的青绿色短芒掠过板刃", "#9df4c8", "#59b4aa", 32, 4, "aurora"],
  ["流星", "橙金长尾顺着板尾飞出，很快熄灭", "#ffd786", "#e98557", 38, 5, "aurora"],
  ["银雾", "银白雪雾贴着坡面铺开后慢慢消散", "#dbe7f7", "#8aa4cb", 45, 6, "aurora"],
  ["极光", "薄荷绿和靛紫光带沿压刃的弧线交错", "#a6f5d7", "#987ebd", 55, 7, "aurora"],
]);
export const gearCatalog = [boardGear, suitGear, trailGear];
export const gearKinds = ["雪板", "雪服", "雪迹"];
export const currencyName = (c: GearCurrency) => (c === "aurora" ? "极光券" : "雪币");

type DeckPoint = [number, number];
const rect = (x: number, y: number, w: number, h: number): DeckPoint[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];
const ribbon = (path: DeckPoint[], width: number): DeckPoint[] => [
  ...path,
  ...path.map(([x, y]): DeckPoint => [x, y + width]).reverse(),
];
const deckMarks: DeckPoint[][][] = [
  [rect(9, 15, 12, 70), rect(78, 15, 11, 70)],
  [0, 23].map((offset) =>
    ribbon(
      [
        [3, 55],
        [16, 42],
        [31, 38],
        [51, 50],
        [70, 52],
        [84, 43],
        [96, 28],
      ].map(([x, y]): DeckPoint => [x, y + offset]),
      8,
    ),
  ),
  [
    [
      [3, 70],
      [42, 11],
      [41, 43],
      [97, 19],
      [62, 82],
      [58, 54],
    ],
  ],
  [
    ribbon(
      [
        [2, 39],
        [23, 48],
        [36, 15],
        [46, 60],
        [68, 69],
        [83, 28],
        [98, 45],
      ],
      7,
    ),
  ],
  [
    [
      [70, 11],
      [60, 19],
      [55, 38],
      [55, 57],
      [61, 75],
      [70, 79],
      [78, 68],
      [72, 89],
      [62, 92],
      [53, 78],
      [49, 57],
      [49, 34],
      [55, 17],
      [62, 9],
    ],
  ],
  [
    [
      [2, 98],
      [14, 64],
      [23, 80],
      [38, 20],
      [54, 77],
      [68, 43],
      [91, 86],
      [98, 70],
      [98, 98],
    ],
  ],
  [25, 42, 59].map((x): DeckPoint[] => [
    [x, 7],
    [x + 7, 7],
    [x + 24, 93],
    [x + 17, 93],
  ]),
  Array.from({ length: 5 }, (_, i) => {
    const x = 13 + i * 18;
    const y = 32 + (i % 2) * 35;
    const radius = 5 + (i % 3) * 2;
    return [
      [x, y - 2 * radius],
      [x + radius, y],
      [x, y + 2 * radius],
      [x - radius, y],
    ] as DeckPoint[];
  }),
  Array.from({ length: 5 }, (_, i) =>
    rect(50 + i * 9, 24 + (i % 2) * 28, 9, 28),
  ),
];
export const deckMotif = (motif: number) => deckMarks[motif] ?? deckMarks[0];

export function drawDeckMotif(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  item: Gear,
) {
  c.save();
  c.translate(x, y);
  c.scale(w / 100, h / 100);
  c.beginPath();
  c.roundRect(0, 0, 100, 100, 15);
  c.clip();
  c.fillStyle = item.color;
  c.fillRect(0, 0, 100, 100);
  c.fillStyle = item.accent;
  for (const shape of deckMotif(item.motif)) {
    c.beginPath();
    c.moveTo(...shape[0]);
    for (const point of shape.slice(1)) c.lineTo(...point);
    c.closePath();
    c.fill();
  }
  c.restore();
}
