import type { Route } from "../content/routes";
import { height, roadCenter, roadWidth, sectionEnd } from "../sim/ski";
import type { P2, V3 } from "../scenes/geometry";

export function courseView(route: Route) {
  const canvas = document.createElement("canvas");
  const wide = matchMedia("(min-aspect-ratio: 4/3)").matches;
  canvas.width = wide ? 960 : 720;
  canvas.height = wide ? 270 : 350;
  canvas.className = "course-view";
  canvas.setAttribute("role", "img");
  canvas.ariaLabel =
    route.name + "立体地形图，由起点向终点排列，橙色标记为跳台";
  const context = canvas.getContext("2d")!;
  let distance = 0;
  let elevation = 0;
  const sections = route.jumps.map((jump) => {
    const end = sectionEnd(jump);
    const startHeight = height(jump, 0);
    const point = (x: number, edge: number): V3 => [
      distance + x,
      elevation + height(jump, x) - startHeight,
      (roadCenter(jump, x) + roadWidth(jump, x) * edge) * 2.8,
    ];
    const stations = [
      0,
      jump.lip - 5,
      jump.lip,
      jump.lip + (jump.showcase ? 15 : 5),
      end,
    ];
    for (let x = 8; x < end; x += 8) stations.push(x);
    stations.sort((a, b) => a - b);
    const section = {
      left: stations.map((x) => point(x, -1)),
      right: stations.map((x) => point(x, 1)),
      center: stations.map((x) => point(x, 0)),
      lip: point(jump.lip, 0),
      landing: point(Math.min(end - 4, jump.lip + Math.max(22, jump.drop * 1.4)), 0),
      gates:
        jump.trail?.gates.map((fraction) => point(fraction * jump.lip, 0)) ??
        [],
    };
    distance += end;
    elevation += height(jump, end) - startHeight;
    return section;
  });
  let tilt = -0.26;
  function render() {
    const sky = context.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, "#0b1c2e");
    sky.addColorStop(1, "#21424f");
    context.fillStyle = sky;
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle alpine silhouette backdrop
    context.save();
    context.fillStyle = "rgba(180, 214, 224, 0.07)";
    context.beginPath();
    context.moveTo(0, canvas.height);
    context.lineTo(0, canvas.height * 0.56);
    context.lineTo(canvas.width * 0.18, canvas.height * 0.28);
    context.lineTo(canvas.width * 0.34, canvas.height * 0.46);
    context.lineTo(canvas.width * 0.56, canvas.height * 0.19);
    context.lineTo(canvas.width * 0.76, canvas.height * 0.44);
    context.lineTo(canvas.width * 0.91, canvas.height * 0.29);
    context.lineTo(canvas.width, canvas.height * 0.48);
    context.lineTo(canvas.width, canvas.height);
    context.closePath();
    context.fill();
    context.restore();

    const dx = Math.cos(tilt);
    const dz = Math.sin(tilt);
    const project = ([x, y, z]: V3): P2 => [
      x * dx + z * dz,
      y * 0.64 + (z * dx - x * dz) * 0.47,
    ];
    const bounds = sections.flatMap(({ left, right }) =>
      [...left, ...right].map(project),
    );
    const left = Math.min(...bounds.map(([x]) => x));
    const right = Math.max(...bounds.map(([x]) => x));
    const top = Math.min(...bounds.map(([, y]) => y));
    const bottom = Math.max(...bounds.map(([, y]) => y));
    const sx = (canvas.width * 0.82) / Math.max(1, right - left),
      sy = Math.min(
        sx * 1.8,
        (canvas.height - 117) / Math.max(1, bottom - top),
      );
    const screen = (p: V3): P2 => {
      const [x, y] = project(p);
      return [
        canvas.width * 0.09 + (x - left) * sx,
        canvas.height * 0.49 + (y - (top + bottom) / 2) * sy,
      ];
    };
    function path(points: P2[], fill?: string) {
      context.beginPath();
      context.moveTo(...points[0]);
      for (const point of points.slice(1)) context.lineTo(...point);
      if (fill) {
        context.closePath();
        context.fillStyle = fill;
        context.fill();
      } else context.stroke();
    }
    for (const section of sections) {
      const side = (tilt < 0 ? section.right : section.left).map(screen);
      const lower = side.map(([x, y]): P2 => [x, y + 15]).reverse();
      path([...side, ...lower], "#3b7884");
      path(
        [...section.left.map(screen), ...section.right.map(screen).reverse()],
        "#b7dbd8",
      );
      context.lineWidth = 1.6;
      context.strokeStyle = "#427983";
      path(section.center.map(screen));
      for (const gate of section.gates) {
        const [x, y] = screen(gate);
        context.fillStyle = "#2d5f6c";
        context.fillRect(x - 2, y - 2, 4, 4);
      }
    }
    context.textBaseline = "middle";
    context.font = '700 17px "Microsoft YaHei", sans-serif';
    sections.forEach(({ lip, landing }, i) => {
      const [x, y] = screen(lip);
      const [lx, ly] = screen(landing);
      // Golden trajectory arc over jump
      context.save();
      context.strokeStyle = "rgba(255, 200, 128, 0.72)";
      context.lineWidth = 2;
      context.setLineDash([5, 4]);
      context.beginPath();
      context.moveTo(x, y);
      context.quadraticCurveTo((x + lx) / 2, Math.min(y, ly) - 30, lx, ly);
      context.stroke();
      context.restore();

      context.strokeStyle = "#ffbd82";
      path([
        [x, y],
        [x, y - 26],
      ]);
      context.beginPath();
      context.arc(x, y - 34, 12, 0, Math.PI * 2);
      context.fillStyle = "#ffc085";
      context.fill();
      context.textAlign = "center";
      context.fillStyle = "#17303e";
      context.fillText(String(i + 1), x, y - 34);
    });
    function endpoint(point: V3, name: string) {
      const [x, y] = screen(point);
      context.fillStyle = "#ecf6ed";
      context.fillText(name, x, y + 26);
    }
    endpoint(sections[0].center[0], "起点");
    endpoint(sections.at(-1)!.center.at(-1)!, "终点");
  }
  render();
  return {
    canvas,
    rotate(direction: number) {
      tilt = Math.max(-0.68, Math.min(0.34, tilt + direction * 0.21));
      render();
    },
  };
}
