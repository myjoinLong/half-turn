import { stations } from "../content/season-routes";
import {
  eligibility,
  raceProgress,
  standings,
  trophyTickets,
  type Attempt,
  type Meeting,
  type Round,
} from "../sim/season";
import { simVersion, courseVersion } from "../sim/ski";
import { change, credit, creditAurora, markDailyGoal } from "./save";

export type RaceSlot = { meetId: string; round: Round; index: number };

export function register(station: number, id: string) {
  let meeting: Meeting | undefined;
  change((save) => {
    if (!stations[station] || eligibility(save.season, station)) return;
    const active = save.season.active;
    if (active && !raceProgress(active).finished) return;
    meeting = { id, station, qualifying: [], final: [] };
    save.season.active = meeting;
  });
  return meeting;
}

export function withdraw(id: string) {
  change((save) => {
    if (save.season.active?.id === id) save.season.active = null;
  });
}

export function retryLastRun(meetId: string, round: Round) {
  let updated: Meeting | null = null;
  change((save) => {
    const meet = save.season.active;
    if (!meet || meet.id !== meetId || !meet[round].length) return;
    if (round === "qualifying" && meet.final.length > 0) return;
    meet[round].pop();
    updated = meet;
  });
  return updated as Meeting | null;
}

export function settleRace(slot: RaceSlot, run: Attempt) {
  let recorded = false;
  let bonus = 0;
  const save = change((save) => {
    const meet = save.season.active;
    if (!meet || meet.id !== slot.meetId) return;
    const next = raceProgress(meet);
    if (next.finished || next.round !== slot.round || next.next !== slot.index)
      return;
    if (
      [...meet.qualifying, ...meet.final].some(
        (attempt) => attempt.id === run.id,
      )
    )
      return;
    meet[slot.round].push(run);
    markDailyGoal(save, "run");
    recorded = true;
    if (slot.round !== "final" || !raceProgress(meet).finished) return;

    const placing = standings(meet, "final").find((row) => row.id === -1)!;
    const id = stations[meet.station].id;
    const previous = save.season.honors[id];
    if (
      previous &&
      (previous.rank < placing.rank ||
        (previous.rank === placing.rank && previous.points >= placing.best))
    )
      return;
    const best = meet.final.find((a) => a.points === placing.best)!;
    save.season.honors[id] = {
      rank: placing.rank,
      points: placing.best,
      clips: best.clips,
      sim: simVersion,
      course: courseVersion,
    };
    const reward = trophyTickets(placing.rank) - trophyTickets(previous?.rank);
    if (reward > 0 && credit(save, "podium/" + id + "/" + placing.rank, reward)) {
      bonus = reward;
      creditAurora(
        save,
        "podium-aurora/" + id + "/" + placing.rank,
        Math.max(10, Math.round(reward * 0.25)),
      );
    }
  });
  return { meeting: save.season.active, recorded, bonus };
}
