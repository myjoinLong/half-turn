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
