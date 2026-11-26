import Phaser from "phaser";
import type { Jump } from "../content/routes";
import { Ski, height } from "../sim/ski";
import { panorama } from "./art";
import { drawDescent, type Callout } from "./descent";
import { SnowEffects } from "./snow-effects";
import type { RivalRide } from "../sim/rival";
export class Slope extends Phaser.Scene {
  ski!: Ski;
  mountain = 0;
  aurora = false;
  wear = [0, 0, 0];
  rivalWear = [15, 11, 7];
  lite = false;
  steady = false;
  jumps: Jump[] = [];
  stage = 0;
  rival?: RivalRide;
  callout?: Callout;
  drive: (delta: number) => void = () => {};
  private layer!: Phaser.Textures.CanvasTexture;
  private sky = document.createElement("canvas");
  private key = "";
  private picture!: Phaser.GameObjects.Image;
  private cameraY = 0;
  private cameraRider?: Ski;
  private frameKey = "";
  private effects = new WeakMap<Ski, SnowEffects>();
  showCallout(text: string, sub: string, gold: boolean) {
    this.callout = { text, sub, age: 0, gold };
    this.frameKey = "";
  }
  recordEffects(ski: Ski) {
    let effect = this.effects.get(ski);
    if (!effect) {
      effect = new SnowEffects();
      this.effects.set(ski, effect);
    }
    effect.record(ski, this.wear, this.lite);
    if (this.rival?.section === this.stage) {
      const rSki = this.rival.ski;
      let rEffect = this.effects.get(rSki);
      if (!rEffect) {
        rEffect = new SnowEffects();
        this.effects.set(rSki, rEffect);
      }
      rEffect.record(rSki, this.rivalWear, true);
    }
  }
  create() {
    this.layer = this.textures.createCanvas("piste", 1, 1)!;
    this.picture = this.add.image(0, 0, "piste").setOrigin(0);
  }
  update(_: number, delta: number) {
    if (!this.ski) return;
    this.drive(delta);
    if (this.callout) {
      this.callout.age += Math.min(delta, 100);
      if (this.callout.age > 1250) this.callout = undefined;
    }
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
      ...this.rivalWear,
      this.callout ? Math.round(this.callout.age / 16) : -1,
    ].join("/");
    if (frameKey === this.frameKey) return;
    this.frameKey = frameKey;
    const c = this.layer.context;
    c.drawImage(this.sky, 0, 0);
    const activeRival =
      this.rival?.section === this.stage ? this.rival.ski : undefined;
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
      this.effects.get(s),
      activeRival,
      this.rivalWear,
      activeRival ? this.effects.get(activeRival) : undefined,
      this.callout,
    );
  }
}
