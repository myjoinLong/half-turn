import { beijingDay, credit, type Save } from "./save";

export type Reward =
  | "tickets"
  | "aurora"
  | "topup"
  | "trial"
  | "seasonRetry"
  | "seasonDouble";

export const ticketCooldownMs = 60000;
export const topupMaxDeficit = 80;
export const featureDailyLimits: Record<
  Exclude<Reward, "tickets" | "aurora">,
  number
> = {
  topup: 2,
  trial: 3,
  seasonRetry: 3,
  seasonDouble: 3,
};

export function softTierReward(dailyCount: number) {
  if (dailyCount < 3) return 60;
  if (dailyCount < 6) return 40;
  return 25;
}

export function ticketRewardFor(save: Save, now = Date.now()) {
  const day = beijingDay(now);
  const count = save.adDay.day === day ? save.adDay.count : 0;
  return softTierReward(count);
}

export function ticketCooldownLeft(save: Save, now = Date.now()) {
  const day = beijingDay(now);
  const count = save.adDay.day === day ? save.adDay.count : 0;
  if (count < 6 || !save.adLastAt) return 0;
  return Math.max(0, ticketCooldownMs - (now - save.adLastAt));
}

function featureCount(save: Save, kind: string, day: number) {
  return save.adFeatures?.day === day ? (save.adFeatures.counts[kind] ?? 0) : 0;
}

export function rewardOffer(
  save: Save,
  kind: Reward,
  run = "",
  now = Date.now(),
  amount = 0,
) {
  const day = beijingDay(now);
  if (
    !save.firstSeenAt ||
    now - save.firstSeenAt < 60000 ||
    !Object.keys(save.records).some((id) => /^tour-\d+$/.test(id))
  )
    return null;

  if (kind === "tickets") {
    const key = "ad/tickets/" + run;
    if (
      !run ||
      save.ledger[run] !== 20 ||
      Object.hasOwn(save.ledger, key) ||
      ticketCooldownLeft(save, now) > 0
    )
      return null;
    const count = save.adDay.day === day ? save.adDay.count : 0;
    return { kind, run, key, day, offeredAt: now, amount: softTierReward(count) };
  }

  if (kind === "aurora") {
    const key = "ad/aurora/" + day;
    if (save.passes || Object.hasOwn(save.ledger, key)) return null;
    return { kind, run, key, day, offeredAt: now, amount: 0 };
  }

  const used = featureCount(save, kind, day);
  if (used >= featureDailyLimits[kind]) return null;

  if (kind === "topup") {
    const key = "ad/topup/" + run;
    if (
      !run ||
      amount <= 0 ||
      amount > topupMaxDeficit ||
      Object.hasOwn(save.ledger, key)
    )
      return null;
    return { kind, run, key, day, offeredAt: now, amount };
  }

  if (kind === "trial") {
    const key = "ad/trial/" + day + "/" + used + "/" + (run || "gear");
    if (Object.hasOwn(save.ledger, key)) return null;
    return { kind, run, key, day, offeredAt: now, amount: 0 };
  }

  if (kind === "seasonRetry") {
    const key = "ad/seasonRetry/" + run;
    if (!run || Object.hasOwn(save.ledger, key)) return null;
    return { kind, run, key, day, offeredAt: now, amount: 0 };
  }

  // seasonDouble
  const key = "ad/seasonDouble/" + run;
  if (!run || amount <= 0 || Object.hasOwn(save.ledger, key)) return null;
  return { kind, run, key, day, offeredAt: now, amount };
}

export function claimReward(
  save: Save,
  offer: NonNullable<ReturnType<typeof rewardOffer>>,
) {
  const check = rewardOffer(
    save,
    offer.kind,
    offer.run,
    offer.offeredAt,
    offer.amount,
  );
  if (check?.key !== offer.key || save.adDay.day > offer.day) return false;
  if (!credit(save, offer.key, offer.amount)) return false;

  if (offer.kind === "tickets") {
    if (save.adDay.day !== offer.day) save.adDay = { day: offer.day, count: 0 };
    save.adDay.count++;
    save.adLastAt = offer.offeredAt;
  } else if (offer.kind === "aurora") {
    save.passes++;
  } else {
    if (!save.adFeatures || save.adFeatures.day !== offer.day)
      save.adFeatures = { day: offer.day, counts: {} };
    save.adFeatures.counts[offer.kind] =
      (save.adFeatures.counts[offer.kind] ?? 0) + 1;
  }
  return true;
}
