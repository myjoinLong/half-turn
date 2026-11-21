import Phaser from "phaser";
import "./ui/style.css";
import { Slope } from "./scenes/slope";
import { rider } from "./scenes/art";
import { Ski, courseVersion, simVersion } from "./sim/ski";
import {
  tours,
  parks,
  daily,
  mountains,
  boards,
  suits,
  trails,
  boardColors,
  suitColors,
  type Route,
} from "./content/routes";
import {
  read,
  change,
  log,
  finish,
  credit,
  medal,
  volatile,
  type Clip,
} from "./platform/save";
import { watch } from "./platform/ad";
const $ = (id: string) => document.getElementById(id)!;
const sheet = $("sheet") as HTMLDialogElement,
  panel = $("panel");
const scene = new Slope("snow");
const game = new Phaser.Game({
  type: Phaser.CANVAS,
  parent: "game",
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: $("field").clientWidth,
    height: $("field").clientHeight,
  },
  scene: [scene],
  backgroundColor: "#eee4c9",
  audio: { disableWebAudio: false },
  input: { activePointers: 1 },
  banner: false,
});
new ResizeObserver(() =>
  game.scale.resize($("field").clientWidth, $("field").clientHeight),
).observe($("field"));
let route: Route = tours[0],
  index = 0,
  total = 0,
  combo = 0,
  playing = false,
  paused = false,
  held = false,
  acc = 0,
  countdown = 0,
  runId = "",
  clips: Clip[] = [],
  edges: number[] = [],
  clipHeld = false,
  landTick = 0;
let replay: Clip[] | null = null,
  replayIndex = 0,
  replayEdge = 0,
  replayHeld = false,
  returnFromReplay = () => {},
  fitting: number[] | null = null,
  adBusy = false;
const settings = () => {
  const s = read();
  scene.lite = s.lite;
  scene.wear = route.mode === "daily" ? [0, 0, 0] : fitting || s.wear;
};
const uid = () =>
  Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
function set(id: string, t: string) {
  if ($(id).textContent !== t) $(id).textContent = t;
}
function spawn(short = false) {
  scene.ski = new Ski(
    short ? { ...route.jumps[index], lip: 10 } : route.jumps[index],
    !read().taught && route.id === tours[0].id && index === 0,
    combo,
  );
  scene.mountain = route.mountain;
  scene.aurora = route.mode === "show";
  edges = [];
  clipHeld = false;
  held = false;
  landTick = 0;
  acc = 0;
  settings();
  hud();
}
function close() {
  if (sheet.open) sheet.close();
  paused = false;
  held = false;
  fitting = null;
  settings();
}
function start(r: Route) {
  if (r.mode === "show" && !read().passes) {
    selectMountain();
    return;
  }
  close();
  route = r;
  index = total = combo = 0;
  clips = [];
  runId = uid();
  replay = null;
  playing = false;
  countdown = 0;
  spawn();
  log("开局", r.id);
}
function hud() {
  const s = scene.ski;
  set(
    "mode",
    (replay
      ? "录像"
      : {
          tour: "巡回赛",
          park: "练习公园",
          daily: "每日同题",
          show: "极光表演",
        }[route.mode]) +
      "  /  " +
      mountains[route.mountain],
  );
  set("line", route.name);
  set("score", String(total).padStart(4, "0"));
  set(
    "jump",
    "跳点  " +
      String(index + 1).padStart(2, "0") +
      " / " +
      String(route.jumps.length).padStart(2, "0"),
  );
  set(
    "progress",
    route.jumps
      .map((_, i) => (i < index ? "━" : i === index ? "◆" : "─"))
      .join(" "),
  );
  const crash = s.phase === "crash",
    dailyFail = crash && route.mode === "daily";
  set(
    "action",
    replay
      ? "结束回看"
      : crash
        ? dailyFail
          ? "继续比赛"
          : "点一下，再来一跳"
        : !playing
          ? "触碰出发"
          : s.phase === "air"
            ? held
              ? "松开展体"
              : "按住收腿转体"
            : s.phase === "land"
              ? "落地滑行"
              : s.auto
                ? "准备空翻"
                : s.held
                  ? "到橙线松手"
                  : "按住屈膝",
  );
  set(
    "hint",
    replay
      ? "播放已记录的固定步输入"
      : crash
        ? "板底与雪面平行时触地最稳"
        : s.auto
          ? "首跳自动起跳 · 腾空后按住，松手减速"
          : s.phase === "air"
            ? "看板面，对准落坡；倒滑也能得分"
            : "橙色区松手起跳 · 空中再次按住后空翻",
  );
  const r = s.result;
  set(
    "feedback",
    countdown > 0
      ? String(Math.ceil(countdown / 1000))
      : r
        ? crash
          ? (r.error < 0 ? "多转了 " : "松早了 ") +
            Math.round(Math.abs(r.error)) +
            "°"
          : r.grade + "落地  +" + r.score
        : "",
  );
  set(
    "meter",
    s.phase === "air"
      ? "空翻  " + Math.round(Math.abs(s.angle)) + "°"
      : s.phase === "run"
        ? "距台沿  " + Math.max(0, s.j.lip - s.x).toFixed(1) + " m"
        : "",
  );
}
let soundsLoaded = false;
const soundFiles = import.meta.glob("../assets/*.wav", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;
function down() {
  if (paused || sheet.open || countdown > 0) return;
  if (replay) {
    stopReplay();
    return;
  }
  if (!soundsLoaded && scene.load) {
    soundsLoaded = true;
    for (const [path, url] of Object.entries(soundFiles))
      scene.load.audio(path.split("/").pop()!.split(".")[0], url);
    scene.load.start();
  }
  if (scene.ski.phase === "crash") {
    log("失误后重试", route.id);
    if (route.mode === "daily") {
      advance();
      return;
    }
    combo = 0;
    spawn(true);
  }
  if (!playing) {
    playing = true;
    log("开始滑行", route.id);
  }
  held = true;
  hud();
}
function up() {
  held = false;
}
scene.down = down;
scene.up = up;
$("ride").onpointerdown = (e) => {
  e.preventDefault();
  $("ride").setPointerCapture(e.pointerId);
  down();
};
window.addEventListener("pointerup", up);
window.addEventListener("pointercancel", up);
window.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !sheet.open) {
    e.preventDefault();
    if (!e.repeat) down();
  }
});
window.addEventListener("keyup", (e) => {
  if (e.code === "Space") up();
});
document.addEventListener("visibilitychange", () => {
  held = false;
  acc = 0;
  if (!document.hidden && playing && !paused) {
    countdown = 2000;
    hud();
  }
});
const sound = (name: string) => {
  if (read().sound && scene.cache.audio.exists(name))
    scene.sound.play(name, { volume: 0.25 });
};
function step() {
  const s = scene.ski;
  if (replay) {
    const clip = replay[replayIndex];
    if (s.tick >= clip.ticks) {
      if (++replayIndex >= replay.length) {
        stopReplay();
        return;
      }
      loadClip();
      return;
    }
    if (clip.edges[replayEdge] === s.tick) {
      replayHeld = !replayHeld;
      replayEdge++;
    }
    s.step(replayHeld);
    if (s.result) total += s.result.score;
    return;
  }
  if (s.phase === "crash") return;
  if (clipHeld !== held) {
    edges.push(s.tick);
    clipHeld = held;
  }
  const phase = s.phase;
  s.step(held);
  if (phase === "run" && s.phase === "air") {
    sound("lift");
    if (s.manual) log("手动起跳", route.id);
  }
  if (phase === "air" && s.result) {
    const r = s.result;
    landTick = s.tick;
    total += r.score;
    combo = r.combo;
    const crashed = r.grade === "摔倒";
    if (!crashed || route.mode === "daily")
      clips.push({
        jump: index,
        edges: [...edges],
        ticks: s.tick,
        auto: s.auto,
        combo: s.combo,
        points: r.score,
        lip: s.j.lip,
      });
    sound(crashed ? "fall" : "land");
    if (read().vibrate) navigator.vibrate?.(crashed ? 55 : 18);
    if (!read().steady && crashed) scene.cameras.main.shake(100, 0.003);
    log(crashed ? "摔倒" : "成功落地", route.id);
  }
  if (
    s.phase === "land" &&
    s.x >= Math.max(s.j.lip + 33, s.j.lip + route.jumps[index].speed * 3.5) &&
    s.tick - landTick > 35
  )
    advance();
}
scene.drive = (delta) => {
  if (document.hidden || paused || !playing) return;
  if (countdown > 0) {
    countdown = Math.max(0, countdown - Math.min(delta, 100));
    hud();
    return;
  }
  acc += Math.min(delta, 100);
  while (acc >= 1000 / 60 && playing && !paused) {
    acc -= 1000 / 60;
    step();
  }
  hud();
};
function advance() {
  if (index + 1 < route.jumps.length) {
    index++;
    spawn();
    return;
  }
  playing = false;
  if (route.mode !== "park")
    finish(runId, route.id, clips, total, route.mode === "tour");
  if (route.id === tours[0].id) change((s) => (s.taught = true));
  log("完赛", route.id);
  result();
}
function loadClip() {
  const c = replay![replayIndex];
  index = c.jump;
  const j = route.jumps[index];
  scene.ski = new Ski({ ...j, lip: c.lip ?? j.lip }, c.auto, c.combo);
  replayEdge = 0;
  replayHeld = false;
  acc = 0;
}
function view(list: Clip[], back: () => void, course = route) {
  if (!list.length) return;
  const previous = { route, index, total, ski: scene.ski, playing };
  close();
  route = course;
  total = 0;
  scene.mountain = course.mountain;
  scene.aurora = course.mode === "show";
  settings();
  replay = list;
  replayIndex = 0;
  returnFromReplay = () => {
    route = previous.route;
    index = previous.index;
    total = previous.total;
    scene.ski = previous.ski;
    playing = previous.playing;
    scene.mountain = route.mountain;
    scene.aurora = route.mode === "show";
    settings();
    hud();
    back();
  };
  loadClip();
  playing = true;
  log("回看", route.id);
  hud();
}
function stopReplay() {
  replay = null;
  playing = false;
  returnFromReplay();
}
function page(title: string, body = "") {
  paused = true;
  held = false;
  acc = 0;
  panel.replaceChildren();
  const b = document.createElement("button");
  b.textContent = "×";
  b.className = "back";
  b.ariaLabel = "返回雪道";
  b.onclick = resume;
  panel.append(b);
  const h = document.createElement("h2");
  h.textContent = title;
  panel.append(h);
  if (body) note(body);
  if (!sheet.open) sheet.showModal();
}
function note(t: string) {
  const p = document.createElement("p");
  p.textContent = t;
  panel.append(p);
}
function grid() {
  const d = document.createElement("div");
  d.className = "grid";
  panel.append(d);
  return d;
}
function btn(
  parent: HTMLElement,
  text: string,
  fn: () => void,
  primary = false,
) {
  const b = document.createElement("button");
  b.textContent = text;
  if (primary) b.className = "primary";
  b.onclick = fn;
  parent.append(b);
  return b;
}
function resume() {
  if (adBusy) return;
  close();
  if (!playing && scene.ski.result) {
    if (replay) stopReplay();
    else start(route);
  } else if (playing) countdown = 1000;
  hud();
}
sheet.oncancel = (e) => {
  e.preventDefault();
  resume();
};
function result() {
  const r = read().records[route.id],
    isPark = route.mode === "park";
  page(
    isPark ? "练习完成" : "冲过终点",
    route.name + "　·　" + total + " 分" + (isPark ? "" : "　·　完赛 +20 雪票"),
  );
  if (route.mode === "tour")
    note(
      ["完成线路", "铜牌", "银牌", "金牌"][medal(total)] +
        "　｜　首次取得奖牌另奖 40 张",
    );
  const g = grid();
  btn(g, "再滑一趟", () => start(route), true);
  if (route.mode === "tour" && tours.indexOf(route) < 14)
    btn(g, "下一条线路", () => start(tours[tours.indexOf(route) + 1]));
  if (clips.length)
    btn(g, "最佳一跳回看", () =>
      view([clips.reduce((a, b) => (a.points >= b.points ? a : b))], result),
    );
  if (r && r.sim === simVersion && r.course === courseVersion)
    btn(g, "纪录回看 · " + r.score, () => view(r.clips, result));
  btn(g, "赛后衣柜", () => closet(true));
  btn(g, "雪场菜单", menu);
}
function menu() {
  page(
    "雪场手册",
    "本机存档　·　雪票 " +
      read().tickets +
      (volatile ? "　·　浏览器存储不可用" : ""),
  );
  const g = grid();
  btn(g, "返回雪道", resume, true);
  btn(g, "巡回赛 · 选山", () => selectMountain());
  btn(g, "练习公园", () => {
    page("练习公园", "随时重试，自由练习。");
    const d = grid();
    parks.forEach((r) => btn(d, r.name, () => start(r)));
  });
  btn(g, "每日表演赛", () => {
    const r = daily();
    page(
      r.name,
      "北京日期 " +
        new Date(Number(r.id.slice(6)) * 86400000).toISOString().slice(0, 10) +
        " · 本机最高 " +
        (read().records[r.id]?.score || 0) +
        " 分。固定装备，每台一次机会。",
    );
    const actions = grid();
    btn(actions, "开始同题挑战", () => start(daily()), true);
    btn(actions, "复制同题挑战", async () => {
      const invite =
        r.name +
        " · " +
        r.id +
        " · 我的本机最高 " +
        (read().records[r.id]?.score || 0) +
        " 分";
      try {
        await navigator.clipboard.writeText(invite);
        note("已复制题号和成绩。");
      } catch {
        note(invite);
      }
    });
  });
  btn(g, "衣柜与收藏", () => closet(false));
  btn(g, "个人纪录", records);
  btn(g, "奖牌墙", () => {
    page("奖牌墙");
    mountains.forEach((m, i) =>
      note(
        m +
          "　" +
          tours
            .slice(i * 5, i * 5 + 5)
            .map((r) => ["—", "铜", "银", "金"][read().medals[r.id] || 0])
            .join(" / ") +
          "　最高 " +
          Math.max(
            0,
            ...tours
              .slice(i * 5, i * 5 + 5)
              .map((r) => read().records[r.id]?.score || 0),
          ),
      ),
    );
  });
  btn(g, "滑行设置", prefs);
}
function records() {
  page("个人纪录", "本机保存每条线路的最高分，同版本录像可重播。");
  const g = grid();
  for (const [id, rec] of Object.entries(read().records)) {
    const course =
      tours.find((r) => r.id === id) ??
      (id === "aurora"
        ? { ...tours[11], id, name: "极光巡游", mode: "show" as const }
        : id.startsWith("daily-")
          ? daily(new Date(Number(id.slice(6)) * 86400000))
          : undefined);
    if (course && rec.sim === simVersion && rec.course === courseVersion)
      btn(g, course.name + " · " + rec.score, () =>
        view(rec.clips, records, course),
      );
  }
  if (!g.childElementCount) note("完成一条正式线路后，这里会保存你的录像。");
}
function selectMountain() {
  page("选择雪山", "三座山均可直接挑战。");
  const g = grid();
  mountains.forEach((m, i) =>
    btn(g, m, () => {
      page(m);
      const rows = grid();
      tours
        .slice(i * 5, i * 5 + 5)
        .forEach((r) =>
          btn(rows, r.name + " · " + (read().records[r.id]?.score || 0), () =>
            start(r),
          ),
        );
    }),
  );
  if (read().passes) btn(g, "继续已领取的极光表演", aurora);
  else {
    log("广告入口曝光", "aurora");
    btn(g, "看视频，用极光灯光滑一趟", () => reward("aurora"));
  }
}
function prefs() {
  page("滑行设置");
  const g = grid();
  for (const [k, t] of [
    ["sound", "声音"],
    ["vibrate", "震动"],
    ["steady", "减少镜头晃动"],
    ["lite", "轻量雪粉"],
  ] as const)
    btn(g, t + " · " + (read()[k] ? "开" : "关"), () => {
      change((s) => (s[k] = !s[k]));
      settings();
      prefs();
    });
  btn(g, "导出私测记录", () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              build: "0.9.0-rc.1",
              source: location.hostname,
              events: read().events,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    a.download = "half-turn-events.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  note(
    "成绩、收藏和最近 600 条游戏事件保存在此浏览器。反馈时请附上线路、机型、系统版本及复现步骤。",
  );
}
function closet(post: boolean, cat = 0, msg = "") {
  const lists = [boards, suits, trails],
    s = read(),
    target = s.target;
  page(
    "雪具衣柜",
    "雪票 " + s.tickets + "　·　收藏目标 " + lists[target[0]][target[1]],
  );
  if (msg) note(msg);
  const preview = document.createElement("canvas");
  preview.width = 300;
  preview.height = 96;
  preview.style.cssText =
    "width:100%;height:96px;object-fit:contain;background:#cad8c3;border-radius:5px";
  preview.ariaLabel = "当前试穿效果";
  panel.append(preview);
  const context = preview.getContext("2d")!,
    outfit = fitting || s.wear,
    posing = new Ski(parks[0].jumps[0]);
  posing.angle = 0;
  context.fillStyle = ["#ffffeb", "#ffe5ae", "#abe4df"][outfit[2]];
  for (let i = 0; i < 12; i++)
    context.fillRect(75 + i * 5, 73 + (i % 4) * 2, 8, 2);
  rider(context, 150, 86, 1.9, posing, outfit);
  let g = grid();
  ["雪板", "雪服", "雪迹"].forEach((l, i) =>
    btn(g, l, () => closet(post, i), cat === i),
  );
  g = grid();
  lists[cat].forEach((n, i) => {
    const owned = s.owned[cat].includes(i);
    const b = btn(
      g,
      n + (s.wear[cat] === i ? " · 已穿戴" : owned ? " · 穿戴" : " · 试穿"),
      () => {
        if (owned) {
          change((v) => (v.wear[cat] = i));
          settings();
          closet(post, cat);
          return;
        }
        change((v) => (v.target = [cat, i]));
        log("收藏目标", n);
        fitting = [...s.wear];
        fitting[cat] = i;
        settings();
        closet(post, cat, "已试穿 " + n + "，购买需 100 张雪票。");
      },
    );
    const strip = document.createElement("span");
    strip.className = "swatch";
    strip.style.backgroundColor =
      "#" +
      [boardColors, suitColors, [0xd9e3da, 0xefca8d, 0x8fcdd3]][cat][i]
        .toString(16)
        .padStart(6, "0");
    b.prepend(strip);
  });
  if (!s.owned[target[0]].includes(target[1]))
    btn(panel, "100 雪票 · 收藏 " + lists[target[0]][target[1]], () => {
      let ok = false;
      change((v) => {
        if (v.tickets >= 100 && !v.owned[target[0]].includes(target[1])) {
          credit(v, "buy/" + target.join("/"), -100);
          v.owned[target[0]].push(target[1]);
          v.wear[target[0]] = target[1];
          ok = true;
        }
      });
      fitting = null;
      settings();
      closet(post, cat, ok ? "收藏成功" : "雪票不足，巡回赛完赛可得 20 张。");
    });
  if (post) {
    log("广告入口曝光", "tickets");
    btn(panel, "看视频，再领 40 张雪票", () => reward("tickets"));
  }
}
async function reward(kind: "tickets" | "aurora") {
  if (adBusy) return;
  adBusy = true;
  const id = uid();
  log("广告点击", kind);
  page("激励视频", "正在连接广告位…");
  const status = await watch(kind, () => log("广告展示", kind));
  adBusy = false;
  if (status === "done") {
    change((s) => {
      if (kind === "tickets") credit(s, id, 40);
      else if (credit(s, id, 0)) s.passes++;
    });
    log("广告完播到账", kind);
  }
  if (kind === "tickets")
    closet(
      true,
      0,
      status === "done"
        ? "已领取 40 张雪票"
        : status === "empty"
          ? "暂无可用视频，请稍后再试。"
          : "视频已关闭。",
    );
  else if (status === "done") aurora();
  else {
    selectMountain();
    note(status === "empty" ? "暂无可用视频，请稍后再试。" : "视频已关闭。");
  }
}
function aurora() {
  if (!read().passes) return;
  start({ ...tours[11], id: "aurora", name: "极光巡游", mode: "show" });
}
$("menu").onclick = menu;
scene.debug = new URLSearchParams(location.search).has("editor");
start(tours[0]);
if (read().passes) aurora();
