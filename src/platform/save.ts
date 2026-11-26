import { simVersion, courseVersion } from "../sim/ski";
import type { SeasonSave } from "../sim/season";
export type Clip = {
  jump: number;
  edges: number[];
  ticks: number;
  combo: number;
  auto: boolean;
  points: number;
  lip?: number;
  boostAt?: number;
  speed?: number;
  control?: [number, number, boolean][];
  cancelledHolds?: number[];
};
export type RecordRun = {
  score: number;
  clips: Clip[];
  sim: number;
  course: number;
};
const key = "half-turn.ski.v1";
const initial = () => ({
  version: 1,
  tickets: 0, // 雪币（常规成长与基础外观）
  auroraTickets: 0, // 极光券（稀有限定外观与炫彩雪迹）
  ledger: {} as Record<string, number>,
  auroraLedger: {} as Record<string, number>,
  records: {} as Record<string, RecordRun>,
  medals: {} as Record<string, number>,
  owned: [[0], [0], [0]],
  wear: [0, 0, 0],
  target: [0, 1],
  sound: true,
  vibrate: true,
  lite: false,
  steady: false,
  taught: false,
  openingSeen: false,
  passes: 0,
  firstSeenAt: 0,
  adDay: { day: 0, count: 0 },
  adLastAt: 0,
  adFeatures: { day: 0, counts: {} as Record<string, number> },
  dailyGoals: { day: 0, runs: 0, daily: false, closet: false, claimed: false },
  skills: [0, 0, 0] as [number, number, number],
  favorites: [[], [], []] as number[][],
  season: { active: null, honors: {} } as SeasonSave,
  events: [] as { name: string; t: number; value: string }[],
});
export type Save = ReturnType<typeof initial>;
export let volatile = false;
let memory = initial();
export function read(): Save {
  try {
    const raw = localStorage.getItem(key);
    if (!raw || volatile) return memory;
    const s = JSON.parse(raw);
    const base = initial();
    return {
      ...base,
      ...s,
      auroraTickets: typeof s.auroraTickets === "number" ? s.auroraTickets : 0,
      auroraLedger: { ...(s.auroraLedger ?? {}) },
      adFeatures: {
        day: s.adFeatures?.day ?? 0,
        counts: { ...(s.adFeatures?.counts ?? {}) },
      },
      dailyGoals: { ...base.dailyGoals, ...(s.dailyGoals ?? {}) },
      skills:
        Array.isArray(s.skills) && s.skills.length === 3
          ? ([s.skills[0] || 0, s.skills[1] || 0, s.skills[2] || 0] as [
              number,
              number,
              number,
            ])
          : ([0, 0, 0] as [number, number, number]),
      version: 1,
    };
  } catch {
    return memory;
  }
}
export function change(fn: (s: Save) => void) {
  const s = read();
  fn(s);
  memory = s;
  try {
    localStorage.setItem(key, JSON.stringify(s));
    volatile = false;
  } catch {
    volatile = true;
  }
  return s;
}
export function log(name: string, value = "") {
  change((s) => {
    s.events.push({ name, t: Date.now(), value });
    s.events = s.events.slice(-600);
  });
}
export function credit(s: Save, id: string, n: number) {
  if (Object.hasOwn(s.ledger, id)) return false;
  s.ledger[id] = n;
  s.tickets += n;
  return true;
}
export function creditAurora(s: Save, id: string, n: number) {
  if (!s.auroraLedger) s.auroraLedger = {};
  if (Object.hasOwn(s.auroraLedger, id)) return false;
  s.auroraLedger[id] = n;
  s.auroraTickets = (s.auroraTickets || 0) + n;
  return true;
}
export function medal(score: number) {
  return score >= 1150 ? 3 : score >= 650 ? 2 : score >= 250 ? 1 : 0;
}
export function beijingDay(now = Date.now()) {
  return Math.floor((now + 8 * 3600000) / 86400000);
}
export function riderRank(s: Save) {
  const honors = Object.values(s.season?.honors ?? {});
  const medals = Object.values(s.medals ?? {}).filter(Boolean).length;
  const skillSum = (s.skills ?? [0, 0, 0]).reduce((a, b) => a + b, 0);
  if (honors.some((h) => h.rank === 1) && honors.length >= 3) return "雪山传奇";
  if (honors.length >= 2 || medals >= 10) return "极光大师";
  if (honors.length >= 1 || medals >= 5) return "峡谷猎风";
  if (medals >= 2 || skillSum >= 2) return "林道飞手";
  return "松林新秀";
}
export function markDailyGoal(
  s: Save,
  kind: "run" | "daily" | "closet",
  now = Date.now(),
) {
  const day = beijingDay(now);
  if (s.dailyGoals.day !== day)
    s.dailyGoals = { day, runs: 0, daily: false, closet: false, claimed: false };
  if (kind === "run") s.dailyGoals.runs++;
  else if (kind === "daily") s.dailyGoals.daily = true;
  else s.dailyGoals.closet = true;
}
export function claimDailyBonus(s: Save, now = Date.now()) {
  const day = beijingDay(now);
  if (
    s.dailyGoals.day !== day ||
    s.dailyGoals.claimed ||
    s.dailyGoals.runs < 1 ||
    !s.dailyGoals.daily ||
    !s.dailyGoals.closet
  )
    return false;
  s.dailyGoals.claimed = true;
  credit(s, "daily-goals-coins/" + day, 60);
  creditAurora(s, "daily-goals-aurora/" + day, 15);
  return true;
}
export function finish(
  id: string,
  route: string,
  clips: Clip[],
  score: number,
  tour: boolean,
) {
  return change((s) => {
    if (!credit(s, id, 20)) return;
    markDailyGoal(s, route.startsWith("daily-") ? "daily" : "run");
    if (route === "aurora") {
      s.passes = Math.max(0, s.passes - 1);
      creditAurora(s, "aurora-run/" + id, 15);
    } else if (route.startsWith("daily-")) {
      creditAurora(s, "daily-run/" + id, 8);
    }
    const prev = s.records[route];
    if (
      !prev ||
      prev.score < score ||
      prev.sim !== simVersion ||
      prev.course !== courseVersion
    )
      s.records[route] = {
        score,
        clips,
        sim: simVersion,
        course: courseVersion,
      };
    if (tour) {
      const m = medal(score);
      if (m) {
        credit(s, "bronze/" + route, 40);
        creditAurora(s, "medal-aurora/" + route, 6);
      }
      s.medals[route] = Math.max(s.medals[route] || 0, m);
    }
  });
}
