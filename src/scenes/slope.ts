import Phaser from "phaser";
import { Ski, height } from "../sim/ski";
import { panorama, piste } from "./art";
export class Slope extends Phaser.Scene {
  ski!: Ski;
  mountain = 0;
  aurora = false;
  wear = [0, 0, 0];
  lite = false;
  debug = false;
  drive: (delta: number) => void = () => {};
  down: () => void = () => {};
  up: () => void = () => {};
  private layer!: Phaser.Textures.CanvasTexture;
  private sky = document.createElement("canvas");
  private key = "";
  private picture!: Phaser.GameObjects.Image;
  private flight: Ski[] = [];
  private flightTick = -1;
  private crashTime = 0;
  create() {
    this.layer = this.textures.createCanvas("piste", 1, 1)!;
    this.picture = this.add.image(0, 0, "piste").setOrigin(0);
    this.input.on("pointerdown", () => this.down());
    this.input.on("pointerup", () => this.up());
    this.input.on("pointerupoutside", () => this.up());
  }
  update(_: number, delta: number) {
    if (!this.ski) return;
    this.drive(delta);
    const w = Math.max(1, this.scale.width),
      h = Math.max(1, this.scale.height),
      key = [w, h, this.mountain, this.aurora].join("/");
    if (this.key !== key) {
      this.key = key;
      this.sky.width = w;
      this.sky.height = h;
      panorama(this.sky.getContext("2d")!, w, h, this.mountain, this.aurora);
      this.layer.setSize(w, h);
      this.picture.setDisplaySize(w, h);
    }
    const actual = this.ski;
    if (actual.phase === "run") {
      this.flight = [];
      this.flightTick = -1;
      this.crashTime = 0;
    }
    if (actual.phase === "air" && this.flightTick !== actual.tick) {
      this.flightTick = actual.tick;
      this.flight.push(Object.assign(Object.create(Ski.prototype), actual));
      if (this.flight.length > 22) this.flight.shift();
    }
    let s = actual;
    if (actual.phase === "crash" && this.flight.length) {
      this.crashTime += Math.min(delta, 100);
      if (this.crashTime > 250 && this.crashTime < 920)
        s =
          this.flight[
            Math.min(
              this.flight.length - 1,
              Math.floor(((this.crashTime - 250) / 670) * this.flight.length),
            )
          ];
    }
    const c = this.layer.context;
    c.drawImage(this.sky, 0, 0);
    const look = height(s.j, s.x) * 0.85 + height(s.j, s.x + 4) * 0.15;
    piste(c, w, h, s, look, this.wear, this.lite, this.debug);
  }
}
