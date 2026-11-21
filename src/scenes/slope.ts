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
  private layer!: Phaser.Textures.CanvasTexture;
  private sky = document.createElement("canvas");
  private key = "";
  private picture!: Phaser.GameObjects.Image;
  private flight: Ski[] = [];
  private flightTick = -1;
  private crashTime = 0;
  private cameraY = 0;
  private cameraRider?: Ski;
  create() {
    this.layer = this.textures.createCanvas("piste", 1, 1)!;
    this.picture = this.add.image(0, 0, "piste").setOrigin(0);
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
    const ground = height(s.j, s.x);
    const lookAhead = height(s.j, s.x + 4);
    const target = s.j.showcase
      ? s.y + Math.min(9, Math.max(-2, ground - s.y)) * 0.44
      : ground * 0.85 + lookAhead * 0.15;
    if (this.cameraRider !== actual) {
      this.cameraRider = actual;
      this.cameraY = target;
    }
    this.cameraY += (target - this.cameraY) * (1 - Math.exp(-delta / 63));
    piste(c, w, h, s, this.cameraY, this.wear, this.lite, this.debug);
  }
}
