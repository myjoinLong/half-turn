import test from "node:test";
import assert from "node:assert/strict";
import { RideGesture } from "../src/ui/gesture";
import {
  nearClip,
  placeAboveSnow,
  type V3,
  cross,
  sub,
} from "../src/scenes/geometry";
import { buildRider } from "../src/scenes/rider";
import { gateOffset, height, Ski } from "../src/sim/ski";
import { opening, parks, tours } from "../src/content/routes";
import { grabOrder } from "../src/content/tricks";
import { clipTree, visibleTreeHeight } from "../src/scenes/forest";
import { visibleSnowRuns } from "../src/scenes/snow";
import { SnowEffects } from "../src/scenes/snow-effects";
import { trailAppearance } from "../src/scenes/trail-art";
import { boardGear, deckMotif } from "../src/content/gear";

test("deck prints follow the deck's transform and do not change snow contact", () => {
  const ski = new Ski(parks[0].jumps[0]);
  for (const [index, item] of boardGear.entries()) {
    const mesh = buildRider(ski, [index, 0, 0]);
    const deck = mesh.find((face) => face.decals)!;
    assert.equal(deck.decals?.length, deckMotif(item.motif).length);
    assert.ok(mesh.length > buildRider(ski, [index, 0, 0], false).length);
    const translate = ([x, y, z]: V3): V3 => [x + 19, y + 2.5, z + 4];
    const placed = placeAboveSnow(mesh, translate, () => 0, []);
    const plain = placeAboveSnow(
      mesh.map(({ points, color }) => ({ points, color })),
      translate,
      () => 0,
      [],
    );
    assert.equal(plain.lift, placed.lift);
    const painted = placed.faces.find((face) => face.decals)!;
    for (const [i, decal] of painted.decals!.entries()) {
      assert.equal(decal.color, item.accent);
      for (const [j, [u, v]] of deckMotif(item.motif)[i].entries()) {
        assert.ok(u >= 0 && u <= 100 && v >= 0 && v <= 100);
        const [x, y, z] = translate(deck.decals![i].points[j]);
        assert.deepEqual(decal.points[j], [x, y - placed.lift, z]);
        assert.equal(decal.points[j][1], painted.points[0][1]);
      }
    }
  }
});

test("snow effects follow the fixed step, keep distinct coatings and bound the low-detail budget", () => {
  const ski = new Ski(parks[0].jumps[0], true);
  const regular = new SnowEffects();
  const equipped = new SnowEffects();
  const replay = new SnowEffects();
  const lite = new SnowEffects();
  let largestLandingBurst = 0;
  let lifted = false;
  for (let tick = 1; tick <= 360; tick++) {
    ski.braking = tick <= 40;
    ski.step(false);
    regular.record(ski, [0, 0, 0], false);
    equipped.record(ski, [3, 6, 7], false);
    replay.record(ski, [3, 6, 7], false);
    lite.record(ski, [3, 6, 7], true);
    const snapshot = equipped.flakes.length;
    equipped.record(ski, [3, 6, 7], false);
    assert.equal(equipped.flakes.length, snapshot);
    assert.deepEqual(equipped.flakes, replay.flakes);
    assert.ok(lite.flakes.length <= 30);
    assert.ok(equipped.flakes.length <= 82);
    if (ski.phase === "air") {
      lifted = true;
      assert.ok(!equipped.marks.some((mark) => mark.tick === tick));
    }
    if (ski.contactTick === tick)
      largestLandingBurst = equipped.flakes.filter(
        (flake) => flake.birth === tick,
      ).length;
  }
  assert.ok(lifted);
  assert.equal(largestLandingBurst, 21);
  assert.notDeepEqual(regular.flakes, equipped.flakes);
  assert.equal(
    new Set(Array.from({ length: 8 }, (_, i) => trailAppearance(i).shape)).size,
    8,
  );
});

test("continuous snow runs split at the obscured side of a crest", () => {
  const profile = [
    { x: 2, y: 0 },
    { x: 4, y: -4 },
    { x: 6, y: 5 },
    { x: 8, y: 6 },
    { x: 10, y: 7 },
  ];
  assert.deepEqual(visibleSnowRuns(profile, 0, -3), [
    [0, 1],
    [2, 4],
  ]);
  assert.deepEqual(
    visibleSnowRuns(
      [
        { x: -2, y: 0 },
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ],
      0,
      -2,
    ),
    [[0, 2]],
  );
});

test("snow blocks tree roots behind a crest while the visible crown remains", () => {
  const eye: V3 = [0, -4, 0];
  const snow = [
    { x: 0, y: 1, left: -3, right: 3 },
    { x: 4, y: -2, left: -3, right: 3 },
    { x: 8, y: 3, left: -3, right: 3 },
  ];
  const behind = visibleTreeHeight(eye, snow, 8, 0);
  assert.equal(behind, 0);
  assert.ok(visibleTreeHeight(eye, snow, 8, 17) > 4);
  const visible = clipTree(
    [
      [8, -3, 0],
      [8, 2, -1],
      [8, 2, 1],
    ],
    (point) => behind - point[1],
  );
  assert.equal(visible.length, 3);
  assert.ok(visible.every((point) => point[1] <= 1e-9));
  assert.equal(visible.filter((point) => Math.abs(point[1]) < 1e-9).length, 2);
});

test("near-plane clipping trims faces instead of stretching hidden points", () => {
  assert.deepEqual(
    nearClip([
      [1, 1, -2],
      [-1, 1, -0.4],
      [0.3, -1, 0.4],
    ]),
    [],
  );
  const clipped = nearClip([
    [1, 1, -2],
    [-1, 1, 2],
    [0.3, -1, 2],
  ]);
  assert.equal(clipped.length, 4);
  assert.ok(clipped.every((v) => v[2] >= 0.8 && v.every(Number.isFinite)));
  assert.equal(clipped.filter((v) => v[2] === 0.8).length, 2);
});

test("every grab, board angle and recovery pose stays above the lip and landing snow", () => {
  for (const j of [parks[1].jumps[0], ...opening.jumps]) {
    const ski = new Ski(j, true);
    for (const phase of ["run", "air", "land", "crash", "recover"] as const) {
      ski.phase = phase;
      ski.held = true;
      ski.tick = 118;
      ski.contactTick = 102;
      ski.recoverTick = 110;
      ski.airTicks = 44;
      ski.tuckTicks = 32;
      ski.tuckAmount = 0.95;
      for (const action of grabOrder) {
        ski.activeGrab = action;
        ski.visualGrab = action;
        ski.visualGrip = phase === "air" ? 0.95 : 0;
        const shapes = buildRider(ski, [0, 1, 0]);
        assert.ok(shapes.length > 145);
        for (const face of shapes) {
          assert.ok(face.points.flat().every(Number.isFinite));
          assert.ok(
            Math.hypot(
              ...cross(
                sub(face.points[1], face.points[0]),
                sub(face.points[2], face.points[0]),
              ),
            ) > 1e-8,
          );
        }
        for (const x of [
          j.lip - 0.25,
          j.lip + 0.25,
          j.lip + (j.showcase ? 15 : 5) - 0.15,
        ]) {
          const roll =
            phase === "crash" ? 1.43 : phase === "recover" ? 0.94 : 0.37;
          const sin = Math.sin(roll),
            cos = Math.cos(roll);
          const toWorld = ([u, v, z]: V3): V3 => [
            x + u * 0.043,
            height(j, x) + (v * cos - z * sin) * 0.043,
            (v * sin + z * cos) * 0.043,
          ];
          const { faces, lift } = placeAboveSnow(
            shapes,
            toWorld,
            (x) => height(j, x),
            [j.lip, j.lip + (j.showcase ? 15 : 5)],
          );
          assert.ok(Number.isFinite(lift) && lift >= 0);
          assert.ok(
            faces.every((f) =>
              f.points.every((v) => v[1] <= height(j, v[0]) + 1e-7),
            ),
          );
        }
      }
    }
  }
});

test("a thumb can steer and brake together, then boost without duplicate input", () => {
  const gesture = new RideGesture();
  gesture.start(160, 450, "run");
  assert.deepEqual(gesture.move(163, 447, "run", true), {
    steer: 0,
    brake: false,
    boost: false,
    grab: 0,
  });
  assert.ok(gesture.move(194, 479, "run", true).brake);
  const carving = gesture.move(202, 475, "run", true);
  assert.ok(carving.steer > 0.65 && carving.brake);
  assert.equal(gesture.move(161, 460, "run", true).brake, false);
  assert.equal(gesture.move(161, 414, "run", true).boost, true);
  assert.equal(gesture.move(160, 407, "run", true).boost, false);
  assert.equal(gesture.move(201, 414, "air", true).grab, 1);
  assert.equal(gesture.move(226, 414, "air", true).grab, 0);
  assert.equal(gesture.move(252, 415, "air", true).grab, 1);
  assert.deepEqual(gesture.move(252, 415, "recover", true), {
    steer: 0,
    brake: false,
    boost: false,
    grab: 0,
  });
});

test("a cancelled hold does not trigger a manual hop off the lip", () => {
  const j = parks[0].jumps[0];
  const ski = new Ski(j);
  while (ski.x < j.lip - 3) ski.step(true);
  ski.cancelHold();
  ski.step(false);
  assert.equal(ski.phase, "run");
  assert.equal(ski.manual, false);
  assert.equal(ski.charge, 0);
});

test("a brushed gate deflects on the touched side instead of through both poles", () => {
  const ski = new Ski(tours[0].jumps[0]);
  ski.lateral = gateOffset(ski.j, 0) + 2.05;
  while (ski.gateIndex === 0) ski.step(false);
  assert.deepEqual(
    ski.gateTouches.map(({ index, side }) => [index, side]),
    [[0, 1]],
  );
});
