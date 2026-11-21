import test from "node:test";
import assert from "node:assert/strict";
import { playRewarded } from "../src/platform/ad";
import { read, change, credit } from "../src/platform/save";
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
