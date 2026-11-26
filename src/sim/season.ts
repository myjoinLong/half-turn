import { fields } from "../content/season-field";
import { rivals, stations } from "../content/season-routes";
import type { Clip } from "../platform/save";
import type { RivalRun } from "./rival";

export const runsPerRound = 2;
export const qualifyingPlaces = 4;
export type Round = "qualifying" | "final";
export type Attempt = { id: string; points: number; clips: Clip[] };
export type Meeting = {
  id: string;
  station: number;
  qualifying: Attempt[];
  final: Attempt[];
};
export type Honor = {
  rank: number;
  points: number;
  clips: Clip[];
  sim: number;
  course: number;
};
export type SeasonSave = {
  active: Meeting | null;
  honors: Record<string, Honor>;
};
type Entry = { id: number; name: string; scores: number[] };
export type Standing = Entry & { best: number; rank: number };

export const roundLabel = { qualifying: "资格赛", final: "决赛" };
export const trophy = (rank: number) =>
  ["", "冠军", "亚军", "季军"][rank] || "决赛完赛";
export const seriesPoints = (rank?: number) =>
  rank ? ([0, 100, 80, 60, 40][rank] ?? 0) : 0;
export const trophyTickets = (rank?: number) =>
  rank ? ([0, 100, 70, 45][rank] ?? 0) : 0;
const points = (run: RivalRun, split = Infinity) =>
  split === Infinity
    ? run.splits.at(-1)!
    : split > 0
      ? (run.splits[split - 1] ?? 0)
      : 0;

export function rankEntries(entries: Entry[]): Standing[] {
  const rows = entries
    .map((entry) => ({
      ...entry,
      best: Math.max(0, ...entry.scores),
      rank: 0,
    }))
    .sort((a, b) => b.best - a.best || a.id - b.id);
  rows.forEach((row, i) => {
    row.rank =
      i > 0 && row.best === rows[i - 1].best ? rows[i - 1].rank : i + 1;
  });
  return rows;
}

function rivalEntries(
  station: number,
  round: Round,
  split = Infinity,
): Entry[] {
  return rivals.map((name, id) => ({
    id,
    name,
    scores: fields[station][round][id].map((run) => points(run, split)),
  }));
}

export function standings(meet: Meeting, round: Round): Standing[] {
  const player = {
    id: -1,
    name: "你",
    scores: meet[round].map((a) => a.points),
  };
  let entries = rivalEntries(meet.station, round);
  if (round === "final") {
    const finalists = new Set(
      standings(meet, "qualifying")
        .filter((row) => row.rank <= qualifyingPlaces)
        .map((row) => row.id),
    );
    entries = entries.filter((entry) => finalists.has(entry.id));
  }
  if (player.scores.length) entries.push(player);
  return rankEntries(entries);
}

export function raceProgress(meet: Meeting): {
  round: Round;
  next: number;
  finished: boolean;
} {
  if (meet.qualifying.length < runsPerRound)
    return {
      round: "qualifying",
      next: meet.qualifying.length,
      finished: false,
    };
  const rank = standings(meet, "qualifying").find((row) => row.id === -1)!.rank;
  if (rank > qualifyingPlaces)
    return { round: "qualifying", next: runsPerRound, finished: true };
  return {
    round: "final",
    next: meet.final.length,
    finished: meet.final.length >= runsPerRound,
  };
}

export function eligibility(save: SeasonSave, station: number): string {
  if (station === 0) return "";
  const pine = save.honors[stations[0].id],
    canyon = save.honors[stations[1].id];
  if (station === 1) return pine ? "" : "松林公开赛完成决赛后开放";
  const total = seriesPoints(pine?.rank) + seriesPoints(canyon?.rank);
  return canyon && total >= 110 ? "" : "完成峡谷决赛并累计 110 积分后开放";
}

export function referenceRival(meet: Meeting, round: Round) {
  const options = standings(meet, round).filter((row) => row.id >= 0);
  const row = options[round === "qualifying" ? qualifyingPlaces - 1 : 0];
  const [first, second] = fields[meet.station][round][row.id];
  return { ...row, run: points(second) >= points(first) ? second : first };
}

export function compareSplit(
  meet: Meeting,
  round: Round,
  split: number,
  score: number,
) {
  const possible = new Set(
    standings(meet, round)
      .filter((r) => r.id >= 0)
      .map((r) => r.id),
  );
  const entries = rivalEntries(meet.station, round, split).filter((row) =>
    possible.has(row.id),
  );
  const rows = rankEntries([
    ...entries,
    { id: -1, name: "你", scores: [score] },
  ]);
  return rows.find((row) => row.id === -1)!.rank;
}
