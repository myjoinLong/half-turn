import Phaser from "phaser";
import { version } from "../package.json";
import "./ui/style.css";
import "./ui/resort.css";
import "./ui/course-view.css";
import "./ui/landscape.css";
import "./ui/season.css";
import "./ui/screens.css";
import { Slope } from "./scenes/slope";
import { rider } from "./scenes/rider";
import {
  Ski,
  courseVersion,
  simVersion,
  sectionEnd,
  releaseForecast,
} from "./sim/ski";
import {
  tours,
  opening,
  parks,
  daily,
  mountains,
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
  beijingDay,
  markDailyGoal,
  volatile,
  type Clip,
} from "./platform/save";
import { adAvailable, watch } from "./platform/ad";
import {
  rewardOffer,
  claimReward,
  ticketCooldownLeft,
  topupMaxDeficit,
  type Reward,
} from "./platform/rewards";
import { gearCatalog, gearKinds } from "./content/gear";
import { trailSample } from "./scenes/trail-art";
import { SnowAudio } from "./scenes/audio";
import { scenicArt, gearArt, type ScenicFeature } from "./ui/artwork";
import { grabs, grabOrder, type Grab } from "./content/tricks";
import { RideGesture } from "./ui/gesture";
import { courseView } from "./ui/course-view";
import { stations, outfitForRival } from "./content/season-routes";
import { RivalRide } from "./sim/rival";
import {
  compareSplit,
  eligibility,
  qualifyingPlaces,
  raceProgress,
  referenceRival,
  roundLabel,
  runsPerRound,
  seriesPoints,
  standings,
  trophy,
  type Meeting,
  type Round,
} from "./sim/season";
import {
  register,
  settleRace,
  withdraw,
  retryLastRun,
  type RaceSlot,
} from "./platform/season";
import { scoreTable, awardBadge } from "./ui/season-board";
const $ = (id: string) => document.getElementById(id)!;
const sheet = $("sheet") as HTMLDialogElement;
const screenPage = $("screen");
const screenPanel = $("panel");
const overlayPanel = $("overlay-panel");
let panel = screenPanel;
let pageBack = () => resume();
let overlayBack = () => resume();
const pageOpen = () => !screenPage.hidden || sheet.open;
const scene = new Slope("snow");
const portraitPhone = matchMedia(
  "(orientation: portrait) and (pointer: coarse)",
);
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
  firstMedalBonus = false,
  control: NonNullable<Clip["control"]> = [];
const rideGesture = new RideGesture();
let replayControl = 0,
  sectionEntrySpeed = 0;
let replay: Clip[] | null = null,
  replayIndex = 0,
  replayEdge = 0,
  replayHeld = false,
  returnFromReplay = () => {},
  adBusy = false;
const snowAudio = new SnowAudio();
let hitStop = 0;
let trialWear: number[] | null = null;
type ActiveRace = {
  slot: RaceSlot;
  meeting: Meeting;
  rival: RivalRide;
  rivalId: number;
  rivalWear: number[];
  name: string;
  targetSplits: number[];
  splitRank?: number;
};
let race: ActiveRace | undefined;
const settings = () => {
  const s = read();
  scene.lite = s.lite;
  scene.steady = s.steady;
  scene.wear =
    route.mode === "intro"
      ? [2, 1, 2]
      : route.mode === "daily"
        ? [0, 0, 0]
        : (trialWear ?? s.wear);
  if (race) scene.rivalWear = race.rivalWear;
  $("app").classList.toggle("taught", Boolean(s.taught || s.openingSeen));
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
  screenPage.hidden = true;
  syncPageAccess();
  paused = false;
  resetControls();
  settings();
}
function start(r: Route, activeRace?: ActiveRace) {
  if (r.mode === "show" && !read().passes) {
    selectMountain();
    return;
  }
  close();
  route = r;
  race = activeRace;
  scene.rival = race?.rival;
  careerTutorial = r.id === tours[0].id && !read().taught;
  index = total = combo = 0;
  clips = [];
  highlights = [];
  recoveryCount = 0;
  firstMedalBonus = false;
  runId = uid();
  replay = null;
  playing = false;
  countdown = 0;
  spawn();
  log("开局", r.id);
}
function hud() {
  const s = scene.ski;
  const duel = $("duel");
  const inRace = route.mode === "match" && !replay ? race : undefined;
  duel.hidden = !inRace;
  if (inRace) {
    const meters = Math.round(inRace.rival.distance - rideDistance());
    const difference = total - (inRace.targetSplits[clips.length - 1] ?? 0);
    set(
      "duel-gap",
      inRace.name +
        (meters > 0
          ? " 在前 " + meters + " 米"
          : meters < 0
            ? " 在后 " + -meters + " 米"
            : " 齐头并进"),
    );
    set(
      "duel-rank",
      inRace.splitRank === undefined
        ? "本地虚拟对手 · 同段比分"
        : "同段第 " +
            inRace.splitRank +
            " 名 · " +
            (difference > 0
              ? "领先 " + difference + " 分"
              : difference < 0
                ? "落后 " + -difference + " 分"
                : "同分"),
    );
  }
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
      : inRace
        ? "人机" +
          roundLabel[inRace.slot.round] +
          " · 第 " +
          (inRace.slot.index + 1) +
          " 趟"
        : {
            tour: "巡回赛",
            park: "练习公园",
            daily: "每日同题",
            show: "极光表演",
            intro: "开场表演",
            match: "人机赛季",
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
  set("progress", rideDistance().toFixed(0) + " 米");
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
  const forecast =
    inRace && held && s.grabbing ? releaseForecast(s) : undefined;
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
        : forecast &&
            forecast.score > 0 &&
            (forecast.grade === "完美" || forecast.grade === "干净")
          ? "可松手 · 预计 +" + forecast.score
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
function rideDistance() {
  let meters = Math.min(scene.ski.x, sectionEnd(route.jumps[index]));
  for (let i = 0; i < index; i++) meters += sectionEnd(route.jumps[i]);
  return meters;
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
  set(
    "progress",
    phase === "run"
      ? "目标 " + s.spinTarget + "°"
      : index === 0
        ? "◆ ─"
        : "━ ◆",
  );
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
  set("speed", Math.round(s.speed * 3.6) + " 公里／时");
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
  if (paused || pageOpen() || countdown > 0 || portraitPhone.matches) return;
  if (replay) {
    stopReplay();
    return;
  }
  snowAudio.unlock();
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
  if (e.key === "Escape" && !sheet.open && !portraitPhone.matches) {
    e.preventDefault();
    if (!screenPage.hidden) pageBack();
    else pauseSki();
    return;
  }
  if (
    e.code === "Space" &&
    !pageOpen() &&
    !["boost", "brake", "grab-toggle"].includes((e.target as HTMLElement)?.id)
  ) {
    e.preventDefault();
    if (!e.repeat) down();
  }
  if (!pageOpen() && !e.repeat && e.key === "Shift") boost();
  if (!pageOpen() && e.key === "ArrowDown") {
    e.preventDefault();
    keyBrake = true;
    updateBrake();
  }
  if (!pageOpen() && ["ArrowLeft", "ArrowRight"].includes(e.key)) {
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
    if (race)
      race.splitRank = compareSplit(
        race.meeting,
        race.slot.round,
        clips.length,
        total,
      );
    if (!crashed && s.j.showcase)
      highlights.push(
        s.performedGrabs.map((grab) => grabs[grab].name).join(" → ") +
          " " +
          s.spinTarget +
          "°",
      );
    sound(crashed ? "fall" : "land");
    if (!crashed) {
      snowAudio.playChime(read().sound, r.grade, r.combo);
      const deg = Math.max(180, r.halves * 180);
      const mult = (r.grade === "完美" ? 1.5 : r.grade === "干净" ? 1.2 : 1.0) + Math.min(0.5, r.combo * 0.1);
      scene.showCallout(
        r.grade === "完美"
          ? deg + "° 完美 ×" + mult.toFixed(1)
          : deg + "° " + r.grade,
        "+" + (r.score + s.gateHits * 25) + " 分" + (r.combo > 1 ? " · " + r.combo + " 连击" : ""),
        r.grade === "完美",
      );
      if (r.grade === "完美" && !read().steady) {
        hitStop = 85;
        scene.cameras.main.shake(115, 0.0032);
      }
    } else {
      scene.showCallout("侧滑卸力", "按住加速撑地起身", false);
    }
    if (read().vibrate) navigator.vibrate?.(crashed ? 55 : r.grade === "完美" ? 26 : 18);
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
  const activeRun = !document.hidden && !paused && playing && !portraitPhone.matches && countdown <= 0;
  snowAudio.update(
    read().sound,
    activeRun && !replay,
    scene.ski?.speed ?? 0,
    scene.ski?.phase === "air",
    Boolean(scene.ski?.braking),
    scene.ski?.phase === "crash" || scene.ski?.phase === "recover",
  );
  if (document.hidden || paused || !playing || portraitPhone.matches) return;
  if (countdown > 0) {
    countdown = Math.max(0, countdown - Math.min(delta, 100));
    hud();
    return;
  }
  if (hitStop > 0) {
    hitStop = Math.max(0, hitStop - Math.min(delta, 100));
    return;
  }
  const s = scene.ski;
  const cueSlowMotion =
    s.j.showcase && s.phase === "air" && s.grabbing && s.airTicks < 65;
  acc += Math.min(delta, 100) * (cueSlowMotion ? 0.74 : 1);
  while (acc >= 1000 / 60 && playing && !paused) {
    acc -= 1000 / 60;
    const skier = scene.ski;
    if (!replay) race?.rival.step();
    step();
    scene.recordEffects(skier);
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
  trialWear = null;
  if (route.mode === "match" && race) {
    const slot = race.slot;
    const settled = settleRace(slot, { id: runId, points: total, clips });
    if (settled.recorded && settled.meeting) {
      log("人机赛完赛", route.id + "/" + slot.round);
      raceBoard(settled.meeting, slot.round, settled.bonus);
    } else {
      seasonLobby("比赛进度已更新，已加载当前站。");
    }
    return;
  }
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
  if (route.mode !== "park") {
    const bonusKey = "bronze/" + route.id;
    const hadBonus = Object.hasOwn(read().ledger, bonusKey);
    const save = finish(runId, route.id, clips, total, route.mode === "tour");
    firstMedalBonus = !hadBonus && save.ledger[bonusKey] === 40;
  }
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
  scene.rival = undefined;
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
    scene.rival = race?.rival;
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
function page(
  title: string,
  body = "",
  back?: () => void,
  layout = "",
  overlay = false,
) {
  paused = true;
  resetControls();
  acc = 0;
  if (overlay) {
    panel = overlayPanel;
    overlayBack = back ?? resume;
  } else {
    if (sheet.open) sheet.close();
    panel = screenPanel;
    screenPage.hidden = false;
    screenPage.dataset.layout = layout;
    pageBack = back ?? resume;
  }
  panel.replaceChildren();
  syncPageAccess();
  const mast = document.createElement("div");
  mast.className = "resort-mast";
  panel.append(mast);
  if (back) {
    const parent = btn(mast, "‹", back);
    parent.className = "resort-nav";
    parent.ariaLabel = "返回上一级";
  }
  const h = document.createElement("h2");
  h.id = overlay ? "overlay-title" : "screen-title";
  h.tabIndex = -1;
  h.textContent = title;
  mast.append(h);
  if (!overlay && route.mode !== "intro") {
    const nav = document.createElement("nav");
    nav.ariaLabel = "雪场导航";
    nav.className = "resort-tabs";
    for (const [label, active, open] of [
      ["雪场", layout === "home", menu],
      ["赛事", layout === "season", seasonLobby],
      ["衣柜", layout === "closet", () => closet(false)],
      ["纪录", layout === "records", records],
    ] as const) {
      const tab = btn(nav, label, open);
      if (active) tab.setAttribute("aria-current", "page");
    }
    mast.append(nav);
  }
  const closeButton = btn(
    mast,
    overlay ? "×" : "回到雪道",
    overlay ? overlayBack : resume,
  );
  closeButton.className = overlay ? "resort-nav" : "return-to-slope";
  if (overlay) closeButton.ariaLabel = "关闭菜单";
  if (body) note(body);
  if (overlay && !sheet.open) sheet.showModal();
  panel.scrollTop = 0;
  h.focus({ preventScroll: true });
}
function note(t: string, parent = panel) {
  const p = document.createElement("p");
  p.textContent = t;
  parent.append(p);
  return p;
}
function grid(parent = panel) {
  const d = document.createElement("div");
  d.className = "grid";
  parent.append(d);
  return d;
}
function panelColumns(style: string) {
  const spread = document.createElement("div");
  spread.className = "resort-spread " + style;
  panel.append(spread);
  return [0, 1].map(() => {
    const pane = document.createElement("div");
    pane.className = "resort-column";
    spread.append(pane);
    return pane;
  });
}
function btn(
  parent: HTMLElement,
  text: string,
  fn: () => void,
  primary = false,
) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = text;
  if (primary) b.className = "primary";
  b.onclick = () => fn();
  parent.append(b);
  return b;
}
function paging(
  parent: HTMLElement,
  index: number,
  total: number,
  label: string,
  select: (index: number) => void,
) {
  if (total <= 1) return;
  const controls = document.createElement("div");
  controls.className = "page-controls";
  const previous = btn(controls, "‹", () => select(index - 1));
  previous.ariaLabel = "上一页" + label;
  previous.disabled = index === 0;
  const count = document.createElement("span");
  count.textContent = index + 1 + " / " + total;
  controls.append(count);
  const next = btn(controls, "›", () => select(index + 1));
  next.ariaLabel = "下一页" + label;
  next.disabled = index >= total - 1;
  parent.append(controls);
}
function artButton(
  parent: HTMLElement,
  title: string,
  detail: string,
  mountain: number,
  fn: () => void,
  night = false,
  feature?: ScenicFeature,
) {
  const button = btn(parent, title, fn);
  button.className = "scenic-button";
  button.ariaLabel = title;
  const caption = document.createElement("span");
  const name = document.createElement("strong");
  const meta = document.createElement("small");
  name.textContent = title;
  meta.textContent = detail;
  caption.append(meta, name);
  button.replaceChildren(scenicArt(mountain, night, feature), caption);
  return button;
}
function rowButton(
  parent: HTMLElement,
  title: string,
  detail: string,
  fn: () => void,
) {
  const button = btn(parent, title, fn);
  button.className = "resort-row";
  button.ariaLabel = title;
  const meta = document.createElement("small");
  meta.textContent = detail;
  button.append(meta);
  return button;
}
function subheading(title: string, parent = panel) {
  const heading = document.createElement("h3");
  heading.textContent = title;
  parent.append(heading);
}
function wallet(text: string, parent = panel) {
  note(text, parent).className = "resort-wallet";
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
    else if (route.mode === "match") start(tours[0]);
    else start(route);
  } else if (playing) countdown = 1000;
  hud();
}
sheet.oncancel = (e) => {
  e.preventDefault();
  if (!adBusy) overlayBack();
};
function pauseSki() {
  page("滑行暂停", route.name, undefined, "", true);
  const actions = grid();
  btn(actions, "继续滑行", resume, true);
  btn(actions, "打开雪场", menu);
}
function result(message = "") {
  const save = read();
  const r = save.records[route.id],
    isPark = route.mode === "park";
  page(isPark ? "练习完成" : "冲过终点", "", menu);
  const [summary, choices] = panelColumns("result-spread");
  const card = document.createElement("div");
  card.className = "score-card";
  const name = document.createElement("strong");
  name.textContent = route.name;
  const score = document.createElement("em");
  score.textContent = total.toLocaleString("zh-CN") + " 分";
  const info = document.createElement("small");
  info.textContent = [
    route.mode === "tour"
      ? ["完成线路", "铜牌", "银牌", "金牌"][medal(total)]
      : "",
    isPark ? "" : "完赛 +20 雪票",
    firstMedalBonus ? "首次摘牌 +40 雪票" : "",
    recoveryCount ? "重新站稳 " + recoveryCount + " 次" : "",
  ]
    .filter(Boolean)
    .join("　·　");
  card.append(
    scenicArt(route.mountain, route.mode === "show"),
    name,
    score,
    info,
  );
  summary.append(card);
  if (message) statusNote(message, choices);
  const g = grid(choices);
  btn(g, "再滑一趟", () => start(route), true);
  if (route.mode === "tour" && tours.indexOf(route) < 14)
    btn(g, "下一条线路", () => start(tours[tours.indexOf(route) + 1]));
  if (clips.length)
    btn(g, "最佳一跳回看", () =>
      view([clips.reduce((a, b) => (a.points >= b.points ? a : b))], result),
    );
  if (r && r.sim === simVersion && r.course === courseVersion)
    btn(g, "纪录回看 · " + r.score, () => view(r.clips, () => result()));
  btn(g, "赛后衣柜", () => closet(true));
  btn(g, "雪场菜单", menu);
  if (route.mode === "tour") {
    const target = gearCatalog[save.target[0]][save.target[1]];
    if (target && !save.owned[save.target[0]].includes(save.target[1]))
      wallet(
        "雪票 " +
          save.tickets +
          " 张　·　" +
          target.name +
          (save.tickets < target.price
            ? " 还差 " + (target.price - save.tickets) + " 张"
            : " 可兑换"),
        choices,
      );
    const ticketOffer = adAvailable("tickets")
      ? rewardOffer(save, "tickets", runId)
      : null;
    if (ticketOffer) {
      if (!message) log("广告入口曝光", "tickets");
      rowButton(
        choices,
        "看视频，再领 " + ticketOffer.amount + " 张雪票",
        ticketOffer.amount >= 60 ? "今日高额阶梯奖励" : "自选奖励",
        () => reward("tickets", result),
      ).classList.add("reward-button", "accent-cta");
    } else if (adAvailable("tickets")) {
      const waitMs = ticketCooldownLeft(save);
      if (waitMs > 0)
        statusNote("下次雪票视频冷却中（约 " + Math.ceil(waitMs / 1000) + " 秒）", choices);
    }
  }
}
function menu() {
  if (route.mode === "intro") {
    page("极光大跳台", "从高台起跳，试着把转体、抓板和落地接成一套动作。");
    const [showcase, tour] = panelColumns("intro-spread");
    artButton(showcase, "继续表演", "开场高台", 2, resume, true);
    artButton(tour, "从松林山起步", "进入巡回赛", 0, startCareer);
    return;
  }
  const save = read();
  page("雪场", "", undefined, "home");
  const [current, activities] = panelColumns("resort-home");
  wallet(
    "雪票 " + save.tickets + " 张" + (volatile ? "　·　浏览器存储不可用" : ""),
    current,
  );
  artButton(
    current,
    "返回雪道",
    route.name + " · 当前线路",
    route.mountain,
    resume,
    route.mode === "show",
  ).classList.add("current-course");
  rowButton(
    current,
    "衣柜与收藏",
    "已收集 " + save.owned.flat().length + " / " + gearCatalog.flat().length,
    () => closet(false),
  );
  const today = beijingDay();
  const goals = save.dailyGoals?.day === today
    ? save.dailyGoals
    : { day: today, runs: 0, daily: false, closet: false };
  const goalBar = document.createElement("div");
  goalBar.className = "daily-goals";
  for (const [label, done] of [
    ["今日滑行 " + Math.min(1, goals.runs) + "/1", goals.runs >= 1],
    ["每日同题", goals.daily],
    ["衣柜穿搭", goals.closet],
  ] as const) {
    const chip = document.createElement("span");
    chip.className = "daily-goal-chip" + (done ? " done" : "");
    chip.textContent = (done ? "✓ " : "○ ") + label;
    goalBar.append(chip);
  }
  current.append(goalBar);
  if (save.passes) {
    rowButton(current, "极光高台夜滑", "已持入场券 · 立即出发", aurora).classList.add(
      "reward-button",
      "accent-cta",
    );
  } else if (adAvailable("aurora") && rewardOffer(save, "aurora")) {
    rowButton(
      current,
      "极光高台夜滑",
      "看视频免费入场（独立每日次数）",
      () => reward("aurora", menu),
    ).classList.add("reward-button", "accent-cta");
  }
  subheading("比赛与训练", activities);
  const g = grid(activities);
  g.classList.add("scenic-grid");
  artButton(
    g,
    "人机赛季",
    "三站 · 晋级争冠",
    2,
    () => seasonLobby(),
    true,
  ).classList.add("season-launch");
  artButton(g, "巡回赛 · 选山", "三座山 · 15 条线", 0, () => selectMountain());
  artButton(
    g,
    "每日表演赛",
    "每日同题 · 固定装备",
    2,
    dailyMenu,
    false,
    "daily",
  );
  artButton(
    g,
    "练习公园",
    "起跳、抓板与落地",
    0,
    practiceMenu,
    false,
    "practice",
  );
  const profile = grid(activities);
  profile.classList.add("profile-grid");
  rowButton(
    profile,
    "个人纪录",
    Object.keys(save.records).length + " 条已记录",
    records,
  );
  rowButton(
    profile,
    "奖牌墙",
    Object.values(save.medals).filter(Boolean).length + " 枚奖牌",
    medals,
  );
  rowButton(profile, "滑行设置", "声音与辅助", prefs);
  rowButton(profile, "重玩开场表演", "极光大跳台", () => start(opening));
}

function seasonLobby(message = "") {
  page("人机赛季", "", menu, "season");
  const save = read().season;
  const seasonPoints =
    seriesPoints(save.honors.pine?.rank) +
    seriesPoints(save.honors.canyon?.rank);
  wallet("分站积分 " + seasonPoints + " · 夜光总决赛入场线 110");
  if (message) statusNote(message);
  const selection = grid();
  selection.classList.add("season-stations");
  for (const [index, event] of stations.entries()) {
    const honor = save.honors[event.id];
    const lock = eligibility(save, index);
    const meeting = save.active?.station === index ? save.active : null;
    const detail =
      meeting && !raceProgress(meeting).finished
        ? "进行中 · " + roundLabel[raceProgress(meeting).round]
        : lock
          ? "未开放 · " + event.detail
          : honor
            ? trophy(honor.rank) + " · " + event.detail
            : event.detail;
    artButton(
      selection,
      event.route.name,
      detail,
      event.route.mountain,
      () => stationMenu(index),
      index === 2,
    );
  }
  const actions = grid();
  actions.classList.add("season-actions");
  rowButton(actions, "历站荣誉", "查看最佳名次与赛后回放", seasonHonors);
  if (save.active)
    rowButton(
      actions,
      "查看本站进度",
      stations[save.active.station].route.name,
      () => raceBoard(save.active!),
    );
}

function stationMenu(index: number) {
  const save = read().season;
  const event = stations[index];
  if (save.active?.station === index) {
    raceBoard(save.active);
    return;
  }
  const course = event.route;
  page(
    course.name,
    event.detail + " · " + routeDistance(course) + " 米",
    () => seasonLobby(),
    "season",
  );
  note(
    "与 7 位本地虚拟滑手同场。每轮滑两趟，取最好成绩。资格赛前四晋级，同分并列。",
  );
  const reason = eligibility(save, index);
  if (reason) statusNote(reason);
  const g = grid();
  btn(g, "立体看赛道", () =>
    inspectCourse(course, () => stationMenu(index), null),
  );
  const engaged = save.active && !raceProgress(save.active).finished;
  const primary = btn(
    g,
    engaged ? "返回进行中的比赛" : "报名本站",
    () => {
      if (engaged) raceBoard(save.active!);
      else enterStation(index);
    },
    true,
  );
  primary.disabled = !!reason && !engaged;
  const honor = save.honors[event.id];
  if (honor)
    wallet("最好名次 第 " + honor.rank + " 名 · " + honor.points + " 分");
}

function enterStation(index: number) {
  const meet = register(index, uid());
  if (meet) {
    log("人机赛报名", stations[index].id);
    raceBoard(meet);
  } else seasonLobby("当前已有报名，或本站尚未开放。");
}

function launchRace(meetId: string) {
  const meet = read().season.active;
  if (!meet || meet.id !== meetId) {
    seasonLobby();
    return;
  }
  const next = raceProgress(meet);
  if (next.finished) {
    raceBoard(meet);
    return;
  }
  const reference = referenceRival(meet, next.round);
  const event = stations[meet.station];
  const rivalWear = outfitForRival(reference.id);
  start(event.route, {
    slot: { meetId, round: next.round, index: next.next },
    meeting: meet,
    rival: new RivalRide(event.route, reference.run.seed),
    rivalId: reference.id,
    rivalWear,
    name: reference.name,
    targetSplits: reference.run.splits,
  });
}

function raceBoard(meet: Meeting, last?: Round, bonus = 0) {
  const next = raceProgress(meet);
  const round = last ?? next.round;
  const course = stations[meet.station].route;
  const rows = standings(meet, round);
  const player = rows.find((row) => row.id === -1);
  const completeFinal = next.finished && next.round === "final";
  const podium = completeFinal && player && player.rank <= 3;
  page(
    podium ? trophy(player.rank) + "领奖台" : course.name,
    "",
    () => seasonLobby(),
    "season",
  );
  const [left, right] = panelColumns("race-spread");
  if (podium) {
    const cup = document.createElement("div");
    cup.className = "podium";
    const title = document.createElement("b");
    title.textContent = course.name;
    cup.append(awardBadge(player.rank), title);
    left.append(cup);
  }
  wallet(
    roundLabel[round] +
      " · " +
      meet[round].length +
      " / " +
      runsPerRound +
      " 趟",
    left,
  );
  if (player)
    note(
      next.finished
        ? (round === "qualifying" ? "未晋级" : trophy(player.rank)) +
            " · 第 " +
            player.rank +
            " 名 · " +
            player.best +
            " 分"
        : (next.round !== round
            ? "已晋级决赛"
            : "暂列第 " + player.rank + " 名") +
            " · " +
            player.best +
            " 分",
      left,
    );
  else
    note(
      round === "qualifying"
        ? "两趟取最高分，前四晋级。"
        : "两趟取最高分，按决赛成绩颁奖。",
      left,
    );
  if (bonus) wallet("首次达到此名次 +" + bonus + " 雪票", left);
  if (!next.finished) {
    const reference = referenceRival(meet, next.round);
    const diff =
      reference.best - (round === next.round ? (player?.best ?? 0) : 0);
    const suffix =
      player && round === next.round && diff > 0
        ? " · 还差 " + diff + " 分"
        : "";
    note(
      next.round === "qualifying"
        ? "晋级标杆 " + reference.name + " · " + reference.best + " 分" + suffix
        : "决赛标杆 " +
            reference.name +
            " · " +
            reference.best +
            " 分" +
            suffix,
      left,
    );
  }
  subheading(roundLabel[round] + "成绩", right);
  right.append(scoreTable(rows, roundLabel[round] + "本地虚拟选手成绩"));

  const actions = grid();
  actions.classList.add("race-actions");
  const sameRun =
    playing &&
    !replay &&
    race?.slot.meetId === meet.id &&
    route.mode === "match";
  if (next.finished) {
    if (
      completeFinal &&
      meet.station < stations.length - 1 &&
      !eligibility(read().season, meet.station + 1)
    )
      btn(actions, "报名下一站", () => stationMenu(meet.station + 1), true);
    else btn(actions, "返回赛季大厅", () => seasonLobby(), true);
    btn(actions, "重报本站", () => enterStation(meet.station));
  } else {
    btn(
      actions,
      sameRun
        ? "继续当前滑行"
        : "开始" + roundLabel[next.round] + "第 " + (next.next + 1) + " 趟",
      sameRun ? resume : () => launchRace(meet.id),
      true,
    );
    btn(actions, "立体看赛道", () =>
      inspectCourse(course, () => raceBoard(meet, round, bonus), null),
    );
    btn(actions, "结束本站报名", () => abandonRace(meet));
  }
  const best = [...meet[round]].sort((a, b) => b.points - a.points)[0];
  if (best?.clips.length)
    btn(actions, "回看最好一趟", () =>
      view(best.clips, () => raceBoard(meet, round, bonus), course),
    );
  if (completeFinal) btn(actions, "查看历站荣誉", seasonHonors);

  const curSave = read();
  // 1) Podium trophy ticket double
  if (podium && bonus > 0) {
    const doubleKey = stations[meet.station].id + "/" + player.rank;
    if (
      adAvailable("seasonDouble") &&
      rewardOffer(curSave, "seasonDouble", doubleKey, Date.now(), bonus)
    ) {
      rowButton(
        left,
        "看视频，奖杯雪票翻倍 (+" + bonus + " 张)",
        "领奖台限时加倍",
        () =>
          reward(
            "seasonDouble",
            (msg) => raceBoard(read().season.active ?? meet, round, bonus),
            doubleKey,
            bonus,
          ),
      ).classList.add("reward-button", "accent-cta");
    }
  }
  // 2) Retry last run in qualifying/final when eliminated or wanting a better attempt
  if (meet[round].length > 0 && !podium) {
    const retryKey = meet.id + "/" + round;
    if (
      adAvailable("seasonRetry") &&
      rewardOffer(curSave, "seasonRetry", retryKey)
    ) {
      rowButton(
        left,
        next.finished && round === "qualifying"
          ? "看视频，重滑资格赛最后一趟冲晋级"
          : "看视频，重滑本趟刷新成绩",
        "每轮限 1 次",
        () =>
          reward(
            "seasonRetry",
            () => {
              const updated = read().season.active ?? meet;
              raceBoard(updated, round, bonus);
            },
            retryKey,
            0,
            () => {
              const updated = retryLastRun(meet.id, round);
              if (updated) launchRace(updated.id);
            },
          ),
      ).classList.add("reward-button", "accent-cta");
    }
  }
  // 3) Try rival's showcase outfit
  const refRival = referenceRival(meet, next.finished ? round : next.round);
  const refWear = outfitForRival(refRival.id);
  const ownsAll = refWear.every((gearIdx, catIdx) =>
    curSave.owned[catIdx].includes(gearIdx),
  );
  if (
    !ownsAll &&
    !next.finished &&
    adAvailable("trial") &&
    rewardOffer(curSave, "trial", "rival-" + refRival.id)
  ) {
    const outfitNames = refWear
      .map((gearIdx, catIdx) => gearCatalog[catIdx][gearIdx]?.name ?? "")
      .filter(Boolean)
      .join(" · ");
    rowButton(
      left,
      "看视频，穿 " + refRival.name + " 同款滑下一趟",
      outfitNames,
      () =>
        reward(
          "trial",
          () => raceBoard(meet, round, bonus),
          "rival-" + refRival.id,
          0,
          () => {
            trialWear = [...refWear];
            launchRace(meet.id);
          },
        ),
    ).classList.add("reward-button");
  }
}

function abandonRace(meet: Meeting) {
  page(
    "结束本站报名？",
    "本次比赛的趟次会清除，历站已取得的奖杯和雪票保留。",
    () => raceBoard(meet),
    "",
    true,
  );
  const actions = grid();
  btn(actions, "保留报名", () => raceBoard(meet), true);
  btn(actions, "确认结束报名", () => {
    withdraw(meet.id);
    if (race?.slot.meetId === meet.id) start(tours[0]);
    seasonLobby("已结束本站报名。");
  });
}

function seasonHonors() {
  const save = read().season;
  page("历站荣誉", "", () => seasonLobby(), "season");
  const cards = grid();
  cards.classList.add("season-stations");
  for (const [index, event] of stations.entries()) {
    const honor = save.honors[event.id];
    const detail = honor
      ? trophy(honor.rank) + " · " + honor.points + " 分"
      : "等待参赛";
    const replayable =
      honor?.clips.length &&
      honor.sim === simVersion &&
      honor.course === courseVersion;
    const card = artButton(
      cards,
      event.route.name,
      detail,
      event.route.mountain,
      replayable
        ? () => view(honor.clips, seasonHonors, event.route)
        : () => stationMenu(index),
      index === 2,
    );
    if (honor && honor.rank <= 3) {
      card.classList.add("honor-card");
      card.append(awardBadge(honor.rank));
    }
  }
  if (save.honors.night?.rank === 1)
    statusNote("已赢得夜光总决赛冠军 · 赛季冠军");
}

function dailyMenu() {
  const r = daily();
  page(r.name, "每位滑手使用同一条赛道和装备。每天北京时间零点换题。", menu);
  const date = new Date(Number(r.id.slice(6)) * 86400000)
    .toISOString()
    .slice(0, 10);
  artButton(
    panel,
    "开始同题挑战",
    date + " · 本机最高 " + (read().records[r.id]?.score || 0) + " 分",
    r.mountain,
    () => start(r),
  );
  rowButton(panel, "复制同题挑战", "分享题号和本机最佳成绩", async () => {
    const invite =
      r.name +
      " · 同题编号 " +
      r.id.slice(6) +
      " · 我的本机最高 " +
      (read().records[r.id]?.score || 0) +
      " 分";
    try {
      await navigator.clipboard.writeText(invite);
      statusNote("已复制题号和成绩。");
    } catch {
      statusNote(invite);
    }
  });
}
function practiceMenu() {
  page("练习公园", "重复打磨一项动作，随时重新起滑。", menu, "practice");
  const rows = grid();
  rows.classList.add("route-list");
  parks.forEach((r) =>
    rowButton(rows, r.name, routeDistance(r) + " 米", () => start(r)),
  );
  artButton(
    panel,
    "极光大跳台 · 花式练习",
    "长滞空 · 连续动作",
    2,
    () => start(opening),
    true,
  );
}
function medals(index = 0) {
  page("奖牌墙", "", menu, "medals");
  const save = read();
  const selector = grid();
  selector.classList.add("outfit-tabs");
  mountains.forEach((m, i) => {
    btn(selector, m, () => medals(i)).ariaPressed = String(i === index);
  });
  const shelf = grid();
  shelf.classList.add("medal-shelf");
  for (const r of tours.slice(index * 5, index * 5 + 5)) {
    const m = save.medals[r.id] || 0;
    const award = rowButton(
      shelf,
      r.name,
      ["待摘牌", "铜牌", "银牌", "金牌"][m],
      () => start(r),
    );
    award.classList.add("medal-" + m);
  }
}
function records(index = 0) {
  page(
    "个人纪录",
    "本机保存每条线路的最高分，同版本录像可重播。",
    menu,
    "records",
  );
  const standings = Object.entries(read().records)
    .filter(
      ([id]) =>
        id === "aurora" ||
        /^daily-\d+$/.test(id) ||
        tours.some((r) => r.id === id),
    )
    .sort((a, b) => b[1].score - a[1].score);
  const pageSize = 4;
  paging(panel, index, Math.ceil(standings.length / pageSize), "纪录", records);
  const g = grid();
  g.classList.add("route-list");
  for (const [id, rec] of standings.slice(
    index * pageSize,
    (index + 1) * pageSize,
  )) {
    const course =
      tours.find((r) => r.id === id) ??
      (id === "aurora"
        ? { ...tours[11], id, name: "极光巡游", mode: "show" as const }
        : id.startsWith("daily-")
          ? daily(new Date(Number(id.slice(6)) * 86400000))
          : undefined);
    if (!course) continue;
    if (
      rec.sim === simVersion &&
      rec.course === courseVersion &&
      rec.clips.length
    )
      rowButton(g, course.name, rec.score + " 分 · 回看", () =>
        view(rec.clips, () => records(index), course),
      );
    else
      rowButton(g, course.name, rec.score + " 分 · 开滑", () => start(course));
  }
  if (!g.childElementCount) note("完成一条正式线路后，这里会保存你的录像。");
}
const routeDistance = (r: Route) =>
  r.jumps.reduce((sum, j) => sum + sectionEnd(j), 0);
const mountainTerrain = [
  "林间蛇形与雪脊",
  "峡谷陡坡与大跨距",
  "高落差与连续大跳",
];
function selectMountain(message = "") {
  page("选择雪山", "", menu, "mountains");
  if (message) statusNote(message);
  const g = grid();
  g.classList.add("mountain-grid");
  mountains.forEach((m, i) =>
    artButton(g, m, mountainTerrain[i] + " · 5 条线路", i, () =>
      mountainRoutes(i),
    ),
  );
  const save = read();
  if (save.passes)
    artButton(
      panel,
      "继续已领取的极光表演",
      "极光巡游 · 入场券 ×1",
      2,
      aurora,
      true,
    );
  else if (adAvailable("aurora") && rewardOffer(save, "aurora")) {
    if (!message) log("广告入口曝光", "aurora");
    artButton(
      panel,
      "看视频，用极光灯光滑一趟",
      "极光巡游 · 自选表演",
      2,
      () => reward("aurora", selectMountain),
      true,
    );
  }
}
function mountainRoutes(index: number) {
  page(
    mountains[index],
    mountainTerrain[index],
    () => selectMountain(),
    "routes",
  );
  const rows = grid();
  rows.classList.add("route-list");
  const save = read();
  for (const r of tours.slice(index * 5, index * 5 + 5)) {
    const distance = routeDistance(r) + " 米";
    const best = save.records[r.id]?.score;
    const award = ["", "铜牌", "银牌", "金牌"][save.medals[r.id] || 0];
    const entry = document.createElement("div");
    entry.className = "course-split";
    rows.append(entry);
    const row = rowButton(
      entry,
      r.name,
      [distance, award, best === undefined ? "" : "最佳 " + best]
        .filter(Boolean)
        .join(" · "),
      () => start(r),
    );
    row.ariaLabel = r.name + "　" + distance;
    const inspect = btn(entry, "看赛道", () => inspectCourse(r));
    inspect.className = "inspect-route";
    inspect.ariaLabel = "看赛道 · " + r.name;
  }
}
function inspectCourse(
  route: Route,
  back = () => mountainRoutes(route.mountain),
  launch: (() => void) | null = () => start(route),
) {
  page(
    route.name,
    routeDistance(route) + " 米 · " + route.jumps.length + " 座跳台",
    back,
    "course",
  );
  const view = courseView(route);
  const [map, details] = panelColumns("course-spread");
  map.append(view.canvas);
  note("橙色标记为跳台，深青线为雪道中心。地形图放大了赛道横向宽度。", details);
  const controls = grid(details);
  controls.classList.add("course-tools");
  btn(controls, "转向山侧", () => view.rotate(-1));
  btn(controls, "转向谷侧", () => view.rotate(1));
  if (launch) btn(controls, "开始滑行", launch, true);
  else btn(controls, "返回赛事", back, true);
}
function prefs() {
  page("滑行设置", "", menu, "settings");
  const g = grid();
  g.classList.add("route-list");
  const save = read();
  for (const [k, t, detail] of [
    ["sound", "声音", "起跳、踩板与落地提示"],
    ["vibrate", "震动", "起跳与落地的触感反馈"],
    ["steady", "减少镜头晃动", "让高速滑行的画面更平稳"],
    ["lite", "轻量雪粉", "减少雪粉与远处细节"],
  ] as const) {
    const toggle = rowButton(g, t, detail, () => {
      const updated = change((s) => (s[k] = !s[k]));
      settings();
      toggle.ariaChecked = String(updated[k]);
    });
    toggle.setAttribute("role", "switch");
    toggle.ariaChecked = String(save[k]);
  }
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
function statusNote(message: string, parent = panel) {
  panel.querySelector(".resort-status")?.remove();
  const label = note(message, parent);
  label.className = "resort-status";
  label.setAttribute("role", "status");
}
let fittingAngle = 0.455;
function closet(
  post: boolean,
  cat = 0,
  selected?: number,
  favorites = false,
  message = "",
  catalogPage = 0,
) {
  const s = read();
  const list = gearCatalog[cat];
  const index = selected ?? s.wear[cat];
  const item = list[index];
  const owned = s.owned[cat].includes(index);
  const worn = s.wear[cat] === index;
  const back = post ? () => result() : menu;
  page("衣柜与收藏", "", back, "closet");
  const [fitting, catalog] = panelColumns("closet-spread");
  wallet(
    "雪票 " +
      s.tickets +
      " 张　·　已收集 " +
      s.owned.flat().length +
      " / " +
      gearCatalog.flat().length,
    fitting,
  );
  if (message) statusNote(message, fitting);

  const outfit = [...s.wear];
  outfit[cat] = index;
  const display = document.createElement("div");
  display.className = "fitting-stage";
  const preview = document.createElement("canvas");
  preview.width = 420;
  preview.height = 186;
  preview.className = "outfit-preview";
  preview.ariaLabel = "滑手三维试穿";
  const stageLabel = document.createElement("small");
  stageLabel.textContent = worn ? "当前穿戴" : "试穿中";
  display.append(preview, stageLabel);
  fitting.append(display);
  const context = preview.getContext("2d")!,
    posing = new Ski(parks[0].jumps[0]);
  posing.angle = 0;
  function paintOutfit(clock: number) {
    context.clearRect(0, 0, preview.width, preview.height);
    trailSample(context, outfit[2], 198, 164, 160, clock);
    rider(context, 210, 164, 3.03, posing, outfit, fittingAngle);
  }
  const turntable = document.createElement("div");
  turntable.className = "turntable";
  for (const [symbol, label, direction] of [
    ["↶", "向左旋转滑手", -1],
    ["↷", "向右旋转滑手", 1],
  ] as const) {
    btn(turntable, symbol, () => {
      fittingAngle = (fittingAngle + (direction * Math.PI) / 6) % (Math.PI * 2);
      paintOutfit(0);
    }).ariaLabel = label;
  }
  display.append(turntable);
  paintOutfit(0);
  if (!s.steady && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const started = performance.now();
    let last = started;
    function animate(now: number) {
      if (!preview.isConnected || screenPage.hidden) return;
      if (now - last > 47) {
        paintOutfit(now - started);
        last = now;
      }
      requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  }
  const tabs = grid(catalog);
  tabs.classList.add("outfit-tabs");
  gearKinds.forEach((label, i) => {
    const tab = btn(tabs, label, () => closet(post, i, undefined, favorites));
    tab.ariaPressed = String(cat === i);
  });
  const detail = document.createElement("div");
  detail.className = "gear-detail";
  const name = document.createElement("strong");
  name.textContent = item.name;
  const desc = document.createElement("small");
  desc.textContent = item.description;
  detail.append(name, desc);
  const actions = document.createElement("div");
  actions.className = "gear-actions";
  detail.append(actions);
  fitting.append(detail);

  const favorite = s.favorites[cat].includes(index);
  const goal = btn(actions, favorite ? "取消收藏" : "收藏此款", () => {
    change((save) => {
      if (save.favorites[cat].includes(index)) {
        save.favorites[cat] = save.favorites[cat].filter((i) => i !== index);
        if (save.target[0] === cat && save.target[1] === index)
          save.target = [0, 1];
      } else {
        save.favorites[cat].push(index);
        if (!owned) save.target = [cat, index];
      }
    });
    if (!favorite) log("收藏目标", item.name);
    closet(post, cat, index, favorites, "", catalogPage);
  });
  goal.ariaPressed = String(favorite);
  const equip = btn(
    actions,
    worn ? "已穿戴" : owned ? "穿戴此款" : item.price + " 雪票兑换",
    () => {
      let equipped = false;
      change((save) => {
        if (!save.owned[cat].includes(index)) {
          if (
            save.tickets < item.price ||
            !credit(save, "buy/" + cat + "/" + index, -item.price)
          )
            return;
          save.owned[cat].push(index);
        }
        save.wear[cat] = index;
        equipped = true;
      });
      settings();
      closet(
        post,
        cat,
        index,
        favorites,
        equipped
          ? (owned ? "已穿戴 " : "已兑换并穿戴 ") + item.name
          : "还差 " +
              Math.max(0, item.price - read().tickets) +
              " 张雪票。巡回赛完赛可得 20 张。",
        catalogPage,
      );
    },
    !worn,
  );
  equip.disabled = worn;
  if (s.dailyGoals?.day !== beijingDay() || !s.dailyGoals?.closet) {
    change((save) => markDailyGoal(save, "closet"));
  }
  if (!owned) {
    const deficit = item.price - s.tickets;
    const itemKey = cat + "/" + index;
    if (
      deficit > 0 &&
      deficit <= topupMaxDeficit &&
      adAvailable("topup") &&
      rewardOffer(s, "topup", itemKey, Date.now(), deficit)
    ) {
      const topupBtn = btn(
        actions,
        "看视频补齐 " + deficit + " 张并穿戴",
        () =>
          reward(
            "topup",
            (msg) => closet(post, cat, index, favorites, msg, catalogPage),
            itemKey,
            deficit,
            () => {
              change((save) => {
                if (
                  !save.owned[cat].includes(index) &&
                  save.tickets >= item.price &&
                  credit(save, "buy/" + cat + "/" + index, -item.price)
                ) {
                  save.owned[cat].push(index);
                  save.wear[cat] = index;
                }
              });
              settings();
              closet(
                post,
                cat,
                index,
                favorites,
                "已补齐差额并穿戴 " + item.name,
                catalogPage,
              );
            },
          ),
        true,
      );
      topupBtn.classList.add("reward-button", "accent-cta");
    } else if (
      deficit > 0 &&
      adAvailable("trial") &&
      rewardOffer(s, "trial", "gear-" + cat + "-" + index)
    ) {
      btn(actions, "看视频免费试滑 1 趟", () =>
        reward(
          "trial",
          (msg) => closet(post, cat, index, favorites, msg, catalogPage),
          "gear-" + cat + "-" + index,
          0,
          () => {
            const nextWear = [...read().wear];
            nextWear[cat] = index;
            trialWear = nextWear;
            start(route.mode === "intro" ? tours[0] : route);
          },
        ),
      ).classList.add("reward-button");
    }
  }

  const filter = document.createElement("div");
  filter.className = "catalog-filter";
  const tools = document.createElement("div");
  tools.className = "catalog-tools";
  tools.append(filter);
  catalog.append(tools);
  btn(filter, "全部 " + list.length + " 款", () =>
    closet(post, cat, index),
  ).ariaPressed = String(!favorites);
  btn(filter, "已收藏 " + s.favorites[cat].length + " 款", () =>
    closet(post, cat, index, true),
  ).ariaPressed = String(favorites);
  const entries = [...list.entries()].filter(
    ([i]) => !favorites || s.favorites[cat].includes(i),
  );
  const pageSize = 3;
  const pages = Math.max(1, Math.ceil(entries.length / pageSize));
  const activePage = Math.min(catalogPage, pages - 1);
  paging(tools, activePage, pages, "装备", (next) =>
    closet(post, cat, index, favorites, "", next),
  );
  const cards = grid(catalog);
  cards.classList.add("gear-grid");
  for (const [i, entry] of entries.slice(
    activePage * pageSize,
    (activePage + 1) * pageSize,
  )) {
    const button = btn(cards, entry.name, () =>
      closet(post, cat, i, favorites, "", activePage),
    );
    const label = document.createElement("strong");
    label.textContent = entry.name;
    const badge = document.createElement("small");
    badge.textContent =
      s.wear[cat] === i
        ? "已穿戴"
        : s.owned[cat].includes(i)
          ? "已拥有"
          : entry.price + " 雪票";
    button.ariaLabel = entry.name;
    button.ariaPressed = String(index === i);
    button.replaceChildren(gearArt(entry, cat, i), label, badge);
  }
  if (!cards.childElementCount)
    note("在任意款式的试穿页收藏，方便回来找它。", catalog);
}
async function reward(
  kind: Reward,
  back: (message: string) => void,
  runKey = "",
  amount = 0,
  onClaimed?: () => void,
) {
  if (adBusy || !adAvailable(kind)) return;
  const key = runKey || (kind === "tickets" ? runId : "");
  const offer = rewardOffer(read(), kind, key, Date.now(), amount);
  if (!offer) {
    back("本次奖励已领取，或暂未达到领取条件。");
    return;
  }
  adBusy = true;
  log("广告点击", kind);
  page("激励视频", "正在连接广告位…", undefined, "", true);
  const closeButton = panel.querySelector<HTMLButtonElement>(".resort-nav")!;
  closeButton.disabled = true;
  const status = await watch(kind, () => log("广告展示", kind));
  adBusy = false;
  let claimed = false;
  if (status === "done") {
    change((s) => {
      claimed = claimReward(s, offer);
    });
    if (claimed) log("广告完播到账", kind);
  } else {
    log(status === "empty" ? "广告不可用" : "广告提前关闭", kind);
  }
  if (claimed && onClaimed) {
    onClaimed();
    return;
  }
  if (claimed && kind === "aurora") aurora();
  else
    back(
      claimed
        ? offer.amount > 0
          ? "已领取 " + offer.amount + " 张雪票"
          : "奖励已生效"
        : status === "empty"
          ? "暂无可用视频，请稍后再试。"
          : status === "cancel"
            ? "视频已关闭。"
            : "这份奖励已领取。",
    );
}
function aurora() {
  if (!read().passes) return;
  start({ ...tours[11], id: "aurora", name: "极光巡游", mode: "show" });
}
$("menu").onclick = menu;
$("pause-ski").onclick = pauseSki;
function startCareer() {
  if (!read().openingSeen)
    change((save) => {
      save.openingSeen = true;
    });
  start(tours[0]);
}
const saved = change((s) => {
  if (!s.firstSeenAt) s.firstSeenAt = s.events[0]?.t || Date.now();
});
start(saved.openingSeen || saved.taught || saved.passes ? tours[0] : opening);
if (saved.passes) aurora();
function syncPageAccess() {
  const waiting = portraitPhone.matches;
  screenPage.inert = waiting;
  $("app").dataset.fullscreen = String(!screenPage.hidden);
  $("app").dataset.waitingForLandscape = String(waiting);
  document
    .querySelectorAll<HTMLElement>("#app > :is(header, footer, #field)")
    .forEach((part) => {
      part.inert = waiting || !screenPage.hidden;
    });
}
function syncOrientation() {
  const waiting = portraitPhone.matches;
  $("rotate-screen").hidden = !waiting;
  syncPageAccess();
  resetControls();
  acc = 0;
  if (!waiting && playing && !paused) countdown = 1000;
  hud();
}
portraitPhone.addEventListener("change", syncOrientation);
syncOrientation();
