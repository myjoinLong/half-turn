import type { Standing } from "../sim/season";

export function scoreTable(rows: Standing[], labeled: string) {
  const table = document.createElement("table");
  table.className = "race-table";
  table.ariaLabel = labeled;
  const head = table.createTHead().insertRow();
  for (const label of ["名次", "滑手", "第一趟", "第二趟", "最好"]) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = label;
    head.append(cell);
  }
  const body = table.createTBody();
  for (const row of rows) {
    const tr = body.insertRow();
    tr.classList.toggle("race-player", row.id === -1);
    for (const value of [
      row.rank,
      row.name,
      row.scores[0] ?? "—",
      row.scores[1] ?? "—",
      row.best,
    ])
      tr.insertCell().textContent = String(value);
  }
  return table;
}

export function awardBadge(rank: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 154;
  canvas.height = 122;
  canvas.className = "award-badge";
  canvas.setAttribute("aria-hidden", "true");
  const c = canvas.getContext("2d")!;
  const tones =
    rank === 1
      ? ["#ffeaba", "#d79a50", "#986334"]
      : rank === 2
        ? ["#e2f6fb", "#a3bdc9", "#537289"]
        : ["#f1c499", "#c1895e", "#744939"];
  const face = c.createLinearGradient(40, 20, 108, 98);
  tones.forEach((color, i) => face.addColorStop(i / 2, color));
  c.strokeStyle = tones[1];
  c.lineWidth = 5;
  c.beginPath();
  c.moveTo(47, 29);
  c.bezierCurveTo(12, 17, 20, 57, 51, 62);
  c.moveTo(107, 29);
  c.bezierCurveTo(142, 17, 134, 57, 103, 62);
  c.stroke();
  c.fillStyle = face;
  c.beginPath();
  c.moveTo(42, 17);
  c.lineTo(112, 17);
  c.bezierCurveTo(111, 50, 102, 70, 83, 75);
  c.lineTo(83, 89);
  c.lineTo(95, 94);
  c.lineTo(95, 100);
  c.lineTo(59, 100);
  c.lineTo(59, 94);
  c.lineTo(71, 89);
  c.lineTo(71, 75);
  c.bezierCurveTo(51, 70, 43, 50, 42, 17);
  c.fill();
  c.fillStyle = tones[2];
  c.beginPath();
  c.roundRect(50, 100, 54, 11, 3);
  c.fill();
  c.fillStyle = "#563e2c";
  c.font = "900 29px system-ui";
  c.textAlign = "center";
  c.fillText(String(rank), 77, 53);
  return canvas;
}
