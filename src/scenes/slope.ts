import Phaser from "phaser";
import type { Jump } from "../content/routes";
import { Ski, height } from "../sim/ski";
import { panorama } from "./art";
import { drawDescent } from "./descent";
export class Slope extends Phaser.Scene {
  ski!: Ski;
  mountain = 0;
  aurora = false;
  wear = [0, 0, 0];
  lite = false;
  steady = false;
  jumps: Jump[] = [];
  stage = 0;
  drive: (delta: number) => void = () => {};
  private layer!: Phaser.Textures.CanvasTexture;
  private sky = document.createElement("canvas");
  private key = "";
  private picture!: Phaser.GameObjects.Image;
  private cameraY = 0;
  private cameraRider?: Ski;
  private frameKey = "";
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
    const s = actual;
    const ground = height(s.j, s.x);
    const target = s.y + Math.min(8, Math.max(0, ground - s.y)) * 0.25;
    if (this.cameraRider !== actual) {
      this.cameraRider = actual;
      this.cameraY = target;
      this.frameKey = "";
    }
    this.cameraY += (target - this.cameraY) * (1 - Math.exp(-delta / 63));
    if (Math.abs(target - this.cameraY) < 0.002) this.cameraY = target;
    const frameKey = [
      key,
      s.tick,
      s.speed,
      this.cameraY,
      this.lite,
      this.steady,
      ...this.wear,
    ].join("/");
    if (frameKey === this.frameKey) return;
    this.frameKey = frameKey;
    const c = this.layer.context;
    c.drawImage(this.sky, 0, 0);
    drawDescent(
      c,
      w,
      h,
      s,
      this.jumps,
      this.stage,
      this.wear,
      this.lite,
      this.aurora,
      this.steady,
      this.cameraY,
    );
  }
}
