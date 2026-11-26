import type { GearCurrency } from "../content/gear";
import { beijingDay, credit, creditAurora, type Save } from "./save";

export type Reward =
  | "tickets"
  | "aurora"
  | "topup"
  | "trial"
  | "seasonRetry"
  | "seasonDouble";

export const ticketCooldownMs = 60000;
export const topupMaxDeficit = 100;
export const topupMaxAuroraDeficit = 25;
export const featureDailyLimits: Record<
  Exclude<Reward, "tickets" | "aurora">,
  number
> = {
  topup: 3,
  trial: 3,
  seasonRetry: 3,
  seasonDouble: 3,
};

export function softTierReward(dailyCount: number) {
  if (dailyCount < 3) return 80;
  if (dailyCount < 6) return 60;
  return 40;
}

export function softTierAuroraBonus(dailyCount: number) {
  if (dailyCount < 3) return 12;
  if (dailyCount < 6) return 8;
  return 5;
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
  currency: GearCurrency = "coins",
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
    return {
      kind,
      run,
      key,
      day,
      offeredAt: now,
      amount: softTierReward(count),
      auroraAmount: softTierAuroraBonus(count),
      currency: "coins" as GearCurrency,
    };
  }

  if (kind === "aurora") {
    const key = "ad/aurora/" + day;
    if (save.passes || Object.hasOwn(save.ledger, key)) return null;
    return {
      kind,
      run,
      key,
      day,
      offeredAt: now,
      amount: 0,
      auroraAmount: 0,
      currency: "aurora" as GearCurrency,
    };
  }

  const used = featureCount(save, kind, day);
  if (used >= featureDailyLimits[kind]) return null;

  if (kind === "topup") {
    const key = "ad/topup/" + currency + "/" + run;
    const maxDef =
      currency === "aurora" ? topupMaxAuroraDeficit : topupMaxDeficit;
    if (
      !run ||
      amount <= 0 ||
      amount > maxDef ||
      Object.hasOwn(save.ledger, key)
    )
      return null;
    return {
      kind,
      run,
      key,
      day,
      offeredAt: now,
      amount: currency === "coins" ? amount : 0,
      auroraAmount: currency === "aurora" ? amount : 0,
      currency,
    };
  }

  if (kind === "trial") {
    const key = "ad/trial/" + day + "/" + used + "/" + (run || "gear");
    if (Object.hasOwn(save.ledger, key)) return null;
    return {
      kind,
      run,
      key,
      day,
      offeredAt: now,
      amount: 0,
      auroraAmount: 0,
      currency: "coins" as GearCurrency,
    };
  }

  if (kind === "seasonRetry") {
    const key = "ad/seasonRetry/" + run;
    if (!run || Object.hasOwn(save.ledger, key)) return null;
    return {
      kind,
      run,
      key,
      day,
      offeredAt: now,
      amount: 0,
      auroraAmount: 0,
      currency: "coins" as GearCurrency,
    };
  }

  // seasonDouble
  const key = "ad/seasonDouble/" + run;
  if (!run || amount <= 0 || Object.hasOwn(save.ledger, key)) return null;
  return {
    kind,
    run,
    key,
    day,
    offeredAt: now,
    amount,
    auroraAmount: Math.max(8, Math.round(amount * 0.25)),
    currency: "coins" as GearCurrency,
  };
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
    offer.currency === "aurora" ? offer.auroraAmount : offer.amount,
    offer.currency,
  );
  if (check?.key !== offer.key || save.adDay.day > offer.day) return false;
  if (!credit(save, offer.key, offer.amount)) return false;
  if (offer.auroraAmount > 0)
    creditAurora(save, offer.key + "/aurora", offer.auroraAmount);

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
