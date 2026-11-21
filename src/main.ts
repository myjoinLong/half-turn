import Phaser from "phaser";
import { version } from "../package.json";
import "./ui/style.css";
import { Slope } from "./scenes/slope";
import { rider } from "./scenes/rider";
import { Ski, courseVersion, simVersion, sectionEnd } from "./sim/ski";
import {
  tours,
  opening,
  parks,
  daily,
  mountains,
  boards,
  suits,
  trails,
  boardColors,
  suitColors,
  trailName,
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
import { grabs, grabOrder, type Grab } from "./content/tricks";
import { RideGesture } from "./ui/gesture";
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
  landTick = 0,
  careerTutorial = false;
let highlights: string[] = [];
let steering = 0,
  braking = false,
  gestureBrake = false,
  keyBrake = false,
  latchedBrake = false,
  brakePointer: number | null = null,
  ridePointer: number | null = null,
  showGrabs = false,
  cancelledHolds: number[] = [],
  recoveryCount = 0,
  control: NonNullable<Clip["control"]> = [];
const rideGesture = new RideGesture();
let replayControl = 0,
  sectionEntrySpeed = 0;
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
  scene.steady = s.steady;
  scene.wear =
    route.mode === "intro"
      ? [2, 1, 2]
      : route.mode === "daily"
        ? [0, 0, 0]
        : fitting || s.wear;
};
const uid = () =>
  Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
function set(id: string, t: string) {
  if ($(id).textContent !== t) $(id).textContent = t;
}
function spawn(entrySpeed = route.jumps[index].speed) {
  sectionEntrySpeed = entrySpeed;
  scene.ski = new Ski(
    route.jumps[index],
    route.mode === "intro" || (careerTutorial && index === 0),
    combo,
    entrySpeed,
  );
  scene.jumps = route.jumps;
  scene.stage = index;
  scene.mountain = route.mountain;
  scene.aurora = route.mode === "show" || route.mode === "intro";
  edges = [];
  clipHeld = false;
  held = false;
  landTick = 0;
  control = [];
  cancelledHolds = [];
  showGrabs = false;
  steering = 0;
  braking = false;
  acc = 0;
  settings();
  hud();
}
function close() {
  if (sheet.open) sheet.close();
  paused = false;
  resetControls();
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
  careerTutorial = r.id === tours[0].id && !read().taught;
  index = total = combo = 0;
  clips = [];
  highlights = [];
  recoveryCount = 0;
  runId = uid();
  replay = null;
  playing = false;
  countdown = 0;
  spawn();
  log("开局", r.id);
}
function hud() {
  const s = scene.ski;
  const showcase = String(route.mode === "intro");
  if ($("app").dataset.showcase !== showcase)
    $("app").dataset.showcase = showcase;
  const trick = s.activeGrab ? grabs[s.activeGrab] : undefined;
  updateControls(s);
  set("trick", s.grabbing && trick ? trick.name + " · " + trick.label : "");
  if (route.mode === "intro" && s.j.showcase && trick) {
    openingHud(s, trick.name);
    return;
  }
  const tutorial = careerTutorial && !replay;
  set(
    "mode",
    (replay
      ? "录像"
      : {
          tour: "巡回赛",
          park: "练习公园",
          daily: "每日同题",
          show: "极光表演",
          intro: "开场表演",
        }[route.mode]) +
      "  /  " +
      mountains[route.mountain],
  );
  set("line", route.name);
  set("score-label", "线路得分");
  set("score", String(total).padStart(4, "0"));
  set(
    "jump",
    (tutorial && index < 3
      ? ["转体入门  ", "起跳入门  ", "抓板入门  "][index]
      : trailName(s.j) + "  ") +
      String(index + 1).padStart(2, "0") +
      " / " +
      String(route.jumps.length).padStart(2, "0"),
  );
  set(
    "progress",
    route.jumps
      .map((j, i) =>
        i < index
          ? sectionEnd(j)
          : i === index
            ? Math.min(s.x, sectionEnd(j))
            : 0,
      )
      .reduce((a, b) => a + b, 0)
      .toFixed(0) + " 米",
  );
  const crash = s.phase === "crash" || s.phase === "recover";
  set(
    "action",
    replay
      ? "结束回看"
      : crash
        ? s.phase === "crash"
          ? "侧滑卸力"
          : "按住撑地起身"
        : !playing
          ? "触碰出发"
          : s.phase === "air"
            ? held
              ? "松开展体"
              : "按住收腿转体"
            : s.phase === "land"
              ? "落地滑行"
              : s.j.lip - s.x > 20
                ? "拖动走线"
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
        ? "保持前进，站稳后接着滑"
        : s.phase === "land"
          ? "拖动走线，按住压刃可减速"
          : s.auto && s.x > s.j.lip - 21
            ? "首跳自动起跳 · 腾空后按住，松手减速"
            : tutorial && index === 2
              ? s.phase === "air"
                ? "持续收腿抓前刃，靠近落坡松手"
                : "橙色区松手起跳，腾空后按住抓板"
              : s.phase === "air"
                ? "看板面，对准落坡；倒滑也能得分"
                : "左右走线 · 下滑压刃",
  );
  const r = s.result;
  set(
    "feedback",
    countdown > 0
      ? String(Math.ceil(countdown / 1000))
      : r
        ? crash
          ? "摔进雪里 · 压板起身"
          : s.tick - s.contactTick < 76
            ? r.grade === "摔倒"
              ? "重新站稳"
              : r.grade + "落地  +" + r.score
            : ""
        : "",
  );
  set(
    "meter",
    s.phase === "air"
      ? "转体  " + Math.round(Math.abs(s.angle)) + "°"
      : s.phase === "run"
        ? "离跳台 " + Math.max(0, s.j.lip - s.x).toFixed(0) + " 米"
        : "旗门 " + s.gateHits + " / " + (s.j.trail?.gates.length || 0),
  );
}
function openingHud(s: Ski, trick: string) {
  const phase = s.phase;
  const spin = s.spinTarget;
  const landed =
    s.performedGrabs.map((grab) => grabs[grab].name).join(" → ") || trick;
  set("mode", "开场表演");
  set("line", opening.name);
  set("score-label", "表演得分");
  set("score", String(total).padStart(4, "0"));
  set(
    "jump",
    index + 1 + " / " + opening.jumps.length + "　落差 " + s.j.drop + " 米",
  );
  set("progress", index === 0 ? "◆ ─" : "━ ◆");
  set("meter", phase === "air" ? Math.round(s.yaw) + "° / " + spin + "°" : "");
  set(
    "feedback",
    countdown > 0
      ? String(Math.ceil(countdown / 1000))
      : phase === "land"
        ? s.result?.grade === "摔倒"
          ? "重新站稳"
          : landed + " " + spin + "°"
        : phase === "crash" || phase === "recover"
          ? "先侧滑卸力，再撑地起身"
          : phase === "air" && held && s.releaseWindow && s.grabbing
            ? "现在松手！"
            : "",
  );
  set(
    "action",
    phase === "land"
      ? "站稳了"
      : phase === "crash" || phase === "recover"
        ? phase === "crash"
          ? "侧滑卸力"
          : "按住撑地起身"
        : phase === "air" && held && s.releaseWindow && s.grabbing
          ? "松手，准备落地"
          : phase === "air" && s.canReleaseShowcase && !s.grabbing && s.yaw > 0
            ? "瞄准落坡"
            : "按住起飞",
  );
  set(
    "hint",
    phase === "land"
      ? s.result?.grade === "摔倒"
        ? "稳住雪板，继续滑行"
        : s.result!.grade + "落地 · +" + s.result!.score
      : phase === "air" && !held && s.canReleaseShowcase
        ? "展开身体 · 看准落坡"
        : phase === "air" && held
          ? "按住时左右滑动，可串接不同抓板"
          : "按住出发 · 上滑冲刺 · 下滑压刃",
  );
}
const grabButtons = new Map(
  grabOrder.map((grab) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = grabs[grab].name;
    button.title = grabs[grab].label;
    button.setAttribute(
      "aria-label",
      grabs[grab].name + " · " + grabs[grab].label,
    );
    button.onclick = () => {
      showGrabs = false;
      selectGrab(grab);
    };
    $("grab-choices").append(button);
    return [grab, button] as const;
  }),
);
function updateControls(s: Ski) {
  $("freestyle-controls").hidden = Boolean(replay);
  const choicesAvailable = !!s.j.showcase && !replay && s.phase === "run";
  $("grab-toggle").hidden = !choicesAvailable;
  $("grab-choices").hidden = !choicesAvailable || !showGrabs || paused;
  $("grab-toggle").setAttribute(
    "aria-expanded",
    String(!$("grab-choices").hidden),
  );
  const boost = $("boost") as HTMLButtonElement;
  boost.hidden = route.mode === "daily";
  boost.disabled = s.phase !== "run" || s.boostAt !== undefined;
  set("boost", s.boostAt === undefined ? "冲刺" : "冲刺中");
  $("brake").setAttribute("aria-pressed", String(braking));
  $("app").classList.toggle(
    "rushing",
    s.boostAt !== undefined && s.speed > s.j.speed * 1.25,
  );
  set(
    "speed",
    Math.round(s.speed * 3.6) +
      " 公里／时" +
      (s.j.showcase && s.phase === "run"
        ? "　·　目标 " + s.spinTarget + "°"
        : ""),
  );
  if (!s.j.showcase) return;
  for (const [grab, button] of grabButtons) {
    const selected = String(grab === s.activeGrab);
    if (button.getAttribute("aria-pressed") !== selected)
      button.setAttribute("aria-pressed", selected);
    button.classList.toggle("performed", s.performedGrabs.includes(grab));
  }
}
function selectGrab(grab: Grab) {
  if (!paused && !replay) scene.ski.selectGrab(grab);
  hud();
}
function cycleGrab(direction: number) {
  const index = grabOrder.indexOf(scene.ski.activeGrab || "indy");
  selectGrab(
    grabOrder[(index + direction + grabOrder.length) % grabOrder.length],
  );
}
function boost() {
  if (paused || replay || route.mode === "daily") return;
  scene.ski.boost();
  if (scene.ski.boostAt === scene.ski.tick) {
    if (!read().steady) scene.cameras.main.shake(150, 0.003);
    if (read().vibrate) navigator.vibrate?.(24);
  }
  hud();
}
$("boost").onclick = boost;
$("grab-toggle").onclick = () => {
  showGrabs = !showGrabs;
  hud();
};
function updateBrake() {
  braking = gestureBrake || keyBrake || latchedBrake || brakePointer !== null;
}
const brakeButton = $("brake");
brakeButton.onpointerdown = (event) => {
  if (brakePointer !== null || event.button !== 0 || paused) return;
  brakeButton.setPointerCapture(event.pointerId);
  brakePointer = event.pointerId;
  updateBrake();
};
brakeButton.onlostpointercapture =
  brakeButton.onpointerup =
  brakeButton.onpointercancel =
    (event) => {
      if (brakePointer !== event.pointerId) return;
      brakePointer = null;
      updateBrake();
    };
brakeButton.onclick = (event) => {
  if (event.detail === 0) {
    latchedBrake = !latchedBrake;
    updateBrake();
  }
};
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
  if (!playing) {
    playing = true;
    log("开始滑行", route.id);
  }
  held = true;
  hud();
}
function up() {
  held = false;
  steering = 0;
}
function cancelRide() {
  if (!replay && scene.ski && (held || scene.ski.held)) {
    if (cancelledHolds.at(-1) !== scene.ski.tick)
      cancelledHolds.push(scene.ski.tick);
    scene.ski.cancelHold();
  }
  up();
}
function resetControls() {
  cancelRide();
  ridePointer = null;
  brakePointer = null;
  gestureBrake = keyBrake = latchedBrake = braking = false;
  showGrabs = false;
}
for (const surface of [$("game"), $("ride")]) {
  surface.onpointerdown = (event) => {
    if (ridePointer !== null || event.button !== 0) return;
    event.preventDefault();
    ridePointer = event.pointerId;
    rideGesture.start(event.clientX, event.clientY, scene.ski.phase);
    showGrabs = false;
    surface.setPointerCapture(event.pointerId);
    down();
  };
  surface.onpointermove = (event) => {
    if (event.pointerId !== ridePointer || !held) return;
    const motion = rideGesture.move(
      event.clientX,
      event.clientY,
      scene.ski.phase,
      !!scene.ski.j.showcase,
    );
    steering = motion.steer;
    gestureBrake = motion.brake;
    updateBrake();
    if (motion.boost) boost();
    if (motion.grab) cycleGrab(motion.grab);
  };
  const release = (event: PointerEvent) => {
    if (ridePointer !== event.pointerId) return;
    ridePointer = null;
    if (event.type !== "pointerup" || gestureBrake) cancelRide();
    else up();
    gestureBrake = false;
    updateBrake();
  };
  surface.onpointerup = release;
  surface.onpointercancel = release;
  surface.onlostpointercapture = release;
}
window.addEventListener("keydown", (e) => {
  if (
    e.code === "Space" &&
    !sheet.open &&
    !["boost", "brake", "grab-toggle"].includes((e.target as HTMLElement)?.id)
  ) {
    e.preventDefault();
    if (!e.repeat) down();
  }
  if (!sheet.open && !e.repeat && e.key === "Shift") boost();
  if (!sheet.open && e.key === "ArrowDown") {
    e.preventDefault();
    keyBrake = true;
    updateBrake();
  }
  if (!sheet.open && ["ArrowLeft", "ArrowRight"].includes(e.key)) {
    e.preventDefault();
    const direction = e.key === "ArrowLeft" ? -1 : 1;
    if (scene.ski.phase === "air" && scene.ski.j.showcase) {
      if (!e.repeat) cycleGrab(direction);
    } else steering = direction;
  }
});
window.addEventListener("keyup", (e) => {
  if (e.code === "Space") up();
  if (e.key === "ArrowDown") {
    keyBrake = false;
    updateBrake();
  }
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") steering = 0;
});
document.addEventListener("visibilitychange", () => {
  resetControls();
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
    if (clip.boostAt === s.tick) s.boost();
    if (clip.cancelledHolds?.includes(s.tick)) s.cancelHold();
    const move = clip.control?.[replayControl];
    if (move?.[0] === s.tick) {
      s.steer = move[1];
      s.braking = move[2];
      replayControl++;
    }
    s.step(replayHeld);
    if (s.result) total += s.result.score + s.gateHits * 25;
    return;
  }
  if (s.steer !== steering || s.braking !== braking) {
    control.push([s.tick, steering, braking]);
    s.steer = steering;
    s.braking = braking;
  }
  if (clipHeld !== held) {
    edges.push(s.tick);
    clipHeld = held;
  }
  const phase = s.phase;
  s.step(held);
  if (phase === "run" && s.phase === "air") {
    gestureBrake = false;
    updateBrake();
    sound("lift");
    if (s.manual) log("手动起跳", route.id);
  }
  if (phase === "air" && s.result) {
    const r = s.result;
    landTick = s.tick;
    total += r.score + s.gateHits * 25;
    combo = r.combo;
    const crashed = r.grade === "摔倒";
    clips.push({
      jump: index,
      edges: [...edges],
      ticks: s.tick,
      auto: s.auto,
      combo: s.combo,
      points: r.score + s.gateHits * 25,
      lip: s.j.lip,
      boostAt: s.boostAt,
      control: [...control],
      cancelledHolds: [...cancelledHolds],
      speed: sectionEntrySpeed,
    });
    if (!crashed && s.j.showcase)
      highlights.push(
        s.performedGrabs.map((grab) => grabs[grab].name).join(" → ") +
          " " +
          s.spinTarget +
          "°",
      );
    sound(crashed ? "fall" : "land");
    if (read().vibrate) navigator.vibrate?.(crashed ? 55 : 18);
    if (!read().steady && crashed) scene.cameras.main.shake(100, 0.003);
    if (!crashed && route.mode === "intro" && !read().steady)
      scene.cameras.main.shake(135, 0.004);
    log(crashed ? "摔倒" : "成功落地", route.id);
  }
  if (phase === "recover" && s.phase === "land") {
    recoveryCount++;
    log("摔倒后起身", route.id);
  }
  if (s.phase === "land") {
    const landingTicks = s.tick - landTick;
    if (landingTicks > 35 && s.x >= sectionEnd(s.j)) advance();
  }
}
scene.drive = (delta) => {
  if (document.hidden || paused || !playing) return;
  if (countdown > 0) {
    countdown = Math.max(0, countdown - Math.min(delta, 100));
    hud();
    return;
  }
  const s = scene.ski;
  const cueSlowMotion =
    s.j.showcase && s.phase === "air" && s.grabbing && s.airTicks < 65;
  acc += Math.min(delta, 100) * (cueSlowMotion ? 0.74 : 1);
  while (acc >= 1000 / 60 && playing && !paused) {
    acc -= 1000 / 60;
    step();
  }
  hud();
};
function advance() {
  if (index + 1 < route.jumps.length) {
    const continuedSpeed = scene.ski.speed;
    const input = { held, steering, braking };
    index++;
    spawn(continuedSpeed);
    ({ held, steering, braking } = input);
    return;
  }
  playing = false;
  if (route.mode === "intro") {
    change((save) => {
      save.openingSeen = true;
    });
    log("开场表演完成");
    page(
      "高光完成",
      (highlights.length ? highlights.join(" ／ ") + "　·　" : "") +
        total +
        " 表演分",
    );
    btn(grid(), "从松林山起步", startCareer, true);
    return;
  }
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
  scene.ski = new Ski({ ...j, lip: c.lip ?? j.lip }, c.auto, c.combo, c.speed);
  scene.jumps = route.jumps;
  scene.stage = index;
  replayEdge = 0;
  replayControl = 0;
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
    scene.jumps = route.jumps;
    scene.stage = index;
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
  resetControls();
  acc = 0;
  panel.replaceChildren();
  sheet.dataset.page = "";
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
  if (
    !playing &&
    route.mode === "intro" &&
    index === opening.jumps.length - 1 &&
    scene.ski.result?.grade !== "摔倒" &&
    scene.ski.phase === "land"
  ) {
    startCareer();
    return;
  }
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
  if (recoveryCount) note("倒地后重新站稳 " + recoveryCount + " 次");
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
  if (route.mode === "intro") {
    page("极光大跳台");
    sheet.dataset.page = "mountain";
    const g = grid();
    btn(g, "继续表演", resume, true);
    btn(g, "从松林山起步", startCareer);
    return;
  }
  page(
    "雪场",
    "雪票 " + read().tickets + (volatile ? "　·　浏览器存储不可用" : ""),
  );
  sheet.dataset.page = "mountain";
  const g = grid();
  g.classList.add("trail-grid");
  btn(g, "返回雪道", resume, true).classList.add("lift-card");
  btn(g, "巡回赛 · 选山", () => selectMountain()).classList.add("map-card");
  btn(g, "重玩开场表演", () => start(opening)).classList.add("night-card");
  btn(g, "练习公园", () => {
    page("练习公园", "随时重试，自由练习。");
    const d = grid();
    parks.forEach((r) => btn(d, r.name, () => start(r)));
    btn(d, "极光大跳台 · 花式练习", () => start(opening));
  });
  btn(g, "每日表演赛", () => {
    const r = daily();
    page(
      r.name,
      "北京日期 " +
        new Date(Number(r.id.slice(6)) * 86400000).toISOString().slice(0, 10) +
        " · 本机最高 " +
        (read().records[r.id]?.score || 0) +
        " 分。固定装备，摔倒起身后继续。",
    );
    const actions = grid();
    btn(actions, "开始同题挑战", () => start(daily()), true);
    btn(actions, "复制同题挑战", async () => {
      const invite =
        r.name +
        " · 同题编号 " +
        r.id.slice("daily-".length) +
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
  page("选择雪山");
  sheet.dataset.page = "mountain";
  const g = grid();
  g.classList.add("mountain-grid");
  mountains.forEach((m, i) =>
    btn(g, m, () => {
      page(m);
      sheet.dataset.page = "mountain";
      const rows = grid();
      rows.classList.add("route-list");
      tours
        .slice(i * 5, i * 5 + 5)
        .forEach((r) =>
          btn(
            rows,
            r.name +
              "　" +
              r.jumps.reduce((sum, j) => sum + sectionEnd(j), 0) +
              " 米",
            () => start(r),
          ),
        );
    }).classList.add("mountain-" + i),
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
              build: version,
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
  preview.width = 360;
  preview.height = 128;
  preview.className = "outfit-preview";
  preview.ariaLabel = "当前试穿效果";
  panel.append(preview);
  const context = preview.getContext("2d")!,
    outfit = fitting || s.wear,
    posing = new Ski(parks[0].jumps[0]);
  posing.angle = 0;
  context.fillStyle = ["#ffffeb", "#ffe5ae", "#abe4df"][outfit[2]];
  for (let i = 0; i < 12; i++)
    context.fillRect(83 + i * 6, 111 + (i % 4) * 2, 8, 2);
  rider(context, 180, 115, 1.98, posing, outfit);
  let g = grid();
  g.classList.add("outfit-tabs");
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
function startCareer() {
  if (!read().openingSeen)
    change((save) => {
      save.openingSeen = true;
    });
  start(tours[0]);
}
const saved = read();
start(saved.openingSeen || saved.taught || saved.passes ? tours[0] : opening);
if (saved.passes) aurora();
