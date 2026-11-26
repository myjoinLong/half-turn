import test from "node:test";
import assert from "node:assert/strict";
import { playRewarded } from "../src/platform/ad";
import { read, change, credit } from "../src/platform/save";
import {
  rewardOffer,
  claimReward,
  ticketCooldownLeft,
  softTierReward,
} from "../src/platform/rewards";
import { outfitForRival, rivals } from "../src/content/season-routes";

test("ad lifecycle: missing slot, no fill, early close, reentry and duplicate callbacks", async () => {
  let close: (r: { isEnded: boolean }) => void = () => {},
    fail = () => {},
    shown = 0,
    destroys = 0;
  const host = {
    createRewardedVideoAd: () => ({
      onClose: (f: typeof close) => (close = f),
      onError: (f: typeof fail) => (fail = f),
      load: async () => {},
      show: async () => {},
      destroy: () => {
        destroys++;
      },
    }),
  };
  assert.equal(await playRewarded("", host, () => {}), "empty");
  const run = (id: string) => playRewarded(id, host, () => shown++);
  let req = run("test");
  assert.equal(await run("duplicate"), "empty");
  await new Promise((r) => setTimeout(r, 0));
  close({ isEnded: false });
  assert.equal(await req, "cancel");
  req = run("test");
  fail();
  assert.equal(await req, "empty");
  req = run("test");
  await new Promise((r) => setTimeout(r, 0));
  close({ isEnded: true });
  close({ isEnded: true });
  assert.equal(await req, "done");
  assert.equal(destroys, 3);
  assert.ok(shown >= 2);
});

test("older local save migrates, purchase and confirmed reward survive reload", () => {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k),
      setItem: (k: string, v: string) => store.set(k, v),
    },
  });
  store.set(
    "half-turn.ski.v1",
    JSON.stringify({ version: 0, tickets: 100, wear: [0, 0, 0] }),
  );
  assert.equal(read().version, 1);
  assert.equal(read().tickets, 100);
  change((s) => {
    credit(s, "buy/0/1", -100);
    s.owned[0].push(1);
    s.wear[0] = 1;
  });
  change((s) => credit(s, "confirmed-test", 40));
  change((s) => credit(s, "confirmed-test", 40));
  assert.equal(read().tickets, 40);
  assert.deepEqual(read().owned[0], [0, 1]);
  assert.equal(read().wear[0], 1);
  delete (globalThis as any).localStorage;
});

test("an ad that never loads returns to the game and a late load cannot open it", async (t) => {
  let timeout = () => {};
  let loaded = () => {};
  let shows = 0,
    destroyed = 0;
  t.mock.method(
    globalThis,
    "setTimeout",
    (callback: () => void, delay: number) => {
      assert.equal(delay, 6000);
      timeout = callback;
      return 0;
    },
  );
  const host = {
    createRewardedVideoAd: () => ({
      onClose: () => {},
      onError: () => {},
      load: () =>
        new Promise<void>((resolve) => {
          loaded = resolve;
        }),
      show: async () => {
        shows++;
      },
      destroy: () => {
        destroyed++;
      },
    }),
  };
  const request = playRewarded("test", host, () => {});
  timeout();
  assert.equal(await request, "empty");
  loaded();
  await Promise.resolve();
  assert.equal(shows, 0);
  assert.equal(destroyed, 1);
});

test("soft-tier ticket rewards (+60/+40/+25 with 60s cooldown) and decoupled aurora/feature ads", () => {
  const now = Date.parse("2026-11-22T12:00:00Z");
  const save = read();
  save.firstSeenAt = now - 59999;
  save.records = { "tour-0": { score: 0, clips: [], sim: 1, course: 1 } };
  save.ledger = {};
  for (let i = 1; i <= 8; i++) save.ledger["run-" + i] = 20;
  save.adDay = { day: 0, count: 0 };
  save.adLastAt = 0;
  save.adFeatures = { day: 0, counts: {} };
  save.passes = 0;
  save.tickets = 0;

  // Under 60s first-session guard blocks ads
  assert.equal(rewardOffer(save, "aurora", "", now), null);
  save.firstSeenAt--;

  // Soft tier progression: 1-3 -> 60, 4-6 -> 40, 7+ -> 25 with 60s cooldown
  assert.equal(softTierReward(0), 80);
  assert.equal(softTierReward(3), 60);
  assert.equal(softTierReward(6), 40);

  let expectedTotal = 0;
  for (let i = 1; i <= 6; i++) {
    const offer = rewardOffer(save, "tickets", "run-" + i, now + i * 1000)!;
    assert.ok(offer);
    assert.equal(offer.amount, i <= 3 ? 80 : 60);
    assert.equal(claimReward(save, offer), true);
    assert.equal(claimReward(save, offer), false); // idempotent
    expectedTotal += offer.amount;
  }
  assert.equal(save.tickets, expectedTotal); // 3*60 + 3*40 = 300

  // 7th ticket ad requires 60s cooldown after 6th
  const t6 = now + 6000;
  assert.ok(ticketCooldownLeft(save, t6 + 10000) > 0);
  assert.equal(rewardOffer(save, "tickets", "run-7", t6 + 10000), null);
  const seventh = rewardOffer(save, "tickets", "run-7", t6 + 60000)!;
  assert.ok(seventh);
  assert.equal(seventh.amount, 40);
  assert.equal(claimReward(save, seventh), true);

  // Aurora is independent of ticket ad count
  const aurora = rewardOffer(save, "aurora", "", t6 + 10000)!;
  assert.ok(aurora);
  assert.equal(claimReward(save, aurora), true);
  assert.equal(save.passes, 1);

  // Wardrobe deficit top-up (<= 80) and season double/retry
  assert.equal(rewardOffer(save, "topup", "0/1", t6, 120), null);
  const topup = rewardOffer(save, "topup", "0/1", t6, 45)!;
  assert.ok(topup);
  assert.equal(claimReward(save, topup), true);
  assert.equal(save.tickets, expectedTotal + 40 + 45);

  const retry = rewardOffer(save, "seasonRetry", "m1/qualifying", t6)!;
  assert.ok(retry);
  assert.equal(claimReward(save, retry), true);
  assert.equal(rewardOffer(save, "seasonRetry", "m1/qualifying", t6), null);

  const dbl = rewardOffer(save, "seasonDouble", "pine/1", t6, 100)!;
  assert.ok(dbl);
  assert.equal(claimReward(save, dbl), true);
  assert.equal(save.tickets, expectedTotal + 40 + 45 + 100);
});

test("all 7 season rivals have distinct high-contrast showcase outfits with non-default trails", () => {
  const seen = new Set<string>();
  for (let i = 0; i < rivals.length; i++) {
    const outfit = outfitForRival(i);
    assert.equal(outfit.length, 3);
    assert.ok(outfit[2] > 0, "rival should use a non-default snow trail");
    seen.add(outfit.join("-"));
  }
  assert.equal(seen.size, rivals.length);
});
