import { panorama } from "../scenes/art";
import { rider } from "../scenes/rider";
import { trailSample } from "../scenes/trail-art";
import { parks } from "../content/routes";
import { Ski } from "../sim/ski";
import { gearCatalog } from "../content/gear";

export type PosterInput = {
  title: string;
  subtitle: string;
  score: number;
  badge: string;
  rankTitle: string;
  mountain: number;
  aurora: boolean;
  wear: number[];
  extraLine?: string;
};

export function generatePosterDataUrl(info: PosterInput): string {
  const w = 1200;
  const h = 675;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext("2d")!;

  // 1. Rich alpine panorama backdrop
  panorama(c, w, h, info.mountain, info.aurora);

  // 2. Editorial left-to-right readability scrim
  const scrim = c.createLinearGradient(0, 0, w, 0);
  scrim.addColorStop(0, "rgba(8, 20, 32, 0.86)");
  scrim.addColorStop(0.54, "rgba(8, 20, 32, 0.56)");
  scrim.addColorStop(1, "rgba(8, 20, 32, 0.2)");
  c.fillStyle = scrim;
  c.fillRect(0, 0, w, h);

  // 3. Subtle decorative border frame
  c.strokeStyle = "rgba(255, 224, 158, 0.35)";
  c.lineWidth = 2;
  c.strokeRect(28, 28, w - 56, h - 56);

  // 4. Right side spotlight + large crisp 3D rider in player's exact outfit
  const rx = 875;
  const ry = 530;
  const spot = c.createRadialGradient(rx, 310, 30, rx, 360, 290);
  spot.addColorStop(0, info.aurora ? "rgba(124, 244, 218, 0.28)" : "rgba(255, 218, 146, 0.28)");
  spot.addColorStop(1, "rgba(10, 24, 36, 0)");
  c.fillStyle = spot;
  c.fillRect(520, 40, 650, 595);

  c.fillStyle = "rgba(225, 246, 252, 0.16)";
  c.beginPath();
  c.ellipse(rx, ry + 8, 175, 24, 0, 0, Math.PI * 2);
  c.fill();

  const posing = new Ski(parks[0].jumps[0]);
  posing.angle = 0;
  posing.tick = 24;
  posing.speed = 18;
  trailSample(c, info.wear[2], rx - 30, ry, 280, 1200);
  rider(c, rx, ry, 6.2, posing, info.wear, 0.48);

  // 5. Left side typography & score hero
  c.textAlign = "left";
  c.textBaseline = "top";

  // Game brand header
  c.fillStyle = "#ffd685";
  c.font = '700 22px "Microsoft YaHei", sans-serif';
  c.fillText("再翻半圈 · TAPTAP H5 花式滑雪", 72, 68);

  // Rank & medal pill
  const pillText = info.rankTitle + (info.badge ? " · " + info.badge : "");
  c.font = '700 20px "Microsoft YaHei", sans-serif';
  const pw = c.measureText(pillText).width + 36;
  c.fillStyle = "rgba(124, 244, 218, 0.18)";
  c.beginPath();
  c.roundRect(72, 114, pw, 40, 20);
  c.fill();
  c.strokeStyle = "rgba(124, 244, 218, 0.58)";
  c.lineWidth = 1.5;
  c.stroke();
  c.fillStyle = "#9efbe9";
  c.fillText(pillText, 90, 123);

  // Route / Event Title
  c.fillStyle = "#ffffff";
  c.font = '800 54px "Microsoft YaHei", sans-serif';
  c.fillText(info.title, 72, 184);

  c.fillStyle = "#c9dfe9";
  c.font = '500 24px "Microsoft YaHei", sans-serif';
  c.fillText(info.subtitle, 72, 254);

  // Giant Hero Score
  c.fillStyle = "#ffd685";
  c.font = '800 108px "Microsoft YaHei", sans-serif';
  c.fillText(info.score.toLocaleString("zh-CN"), 68, 308);
  const sw = c.measureText(info.score.toLocaleString("zh-CN")).width;
  c.fillStyle = "#f2e7d0";
  c.font = '700 32px "Microsoft YaHei", sans-serif';
  c.fillText("分", 80 + sw, 376);

  // Outfit summary + extra line
  const outfitLine =
    "装备：" +
    (gearCatalog[0][info.wear[0]]?.name ?? "") +
    " · " +
    (gearCatalog[1][info.wear[1]]?.name ?? "") +
    " · " +
    (gearCatalog[2][info.wear[2]]?.name ?? "");
  c.fillStyle = "#d9ecf4";
  c.font = '600 22px "Microsoft YaHei", sans-serif';
  c.fillText(outfitLine, 72, 464);

  if (info.extraLine) {
    c.fillStyle = "#9efbe9";
    c.font = '600 21px "Microsoft YaHei", sans-serif';
    c.fillText(info.extraLine, 72, 504);
  }

  // Footer callout
  c.fillStyle = "rgba(218, 236, 246, 0.72)";
  c.font = '500 19px "Microsoft YaHei", sans-serif';
  c.fillText("“再多翻半圈就能破纪录，你敢在哪一刻松手？”", 72, 586);

  return canvas.toDataURL("image/png");
}
