import Phaser from "phaser";
import type { Jump } from "../content/routes";
import { Ski, height } from "../sim/ski";
import { panorama } from "./art";
import { drawDescent, type Callout, type VisibleRival } from "./descent";
import { SnowEffects } from "./snow-effects";
import type { RivalRide } from "../sim/rival";

export type SlopeRival = {
  ride: RivalRide;
  wear: number[];
  name: string;
};

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
  rivals: SlopeRival[] = [];
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

  private getRivalList(): SlopeRival[] {
    if (this.rivals.length) return this.rivals;
    if (this.rival) return [{ ride: this.rival, wear: this.rivalWear, name: "" }];
    return [];
  }

  recordEffects(ski: Ski) {
    let effect = this.effects.get(ski);
    if (!effect) {
      effect = new SnowEffects();
      this.effects.set(ski, effect);
    }
    effect.record(ski, this.wear, this.lite);
    for (const rv of this.getRivalList()) {
      if (rv.ride.section === this.stage) {
        const rSki = rv.ride.ski;
        let rEffect = this.effects.get(rSki);
        if (!rEffect) {
          rEffect = new SnowEffects();
          this.effects.set(rSki, rEffect);
        }
        rEffect.record(rSki, rv.wear, this.lite);
      }
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
      dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1)),
      pw = Math.round(w * dpr),
      ph = Math.round(h * dpr),
      key = [w, h, dpr, this.mountain, this.aurora].join("/");
    if (this.key !== key) {
      this.key = key;
      this.sky.width = pw;
      this.sky.height = ph;
      const sc = this.sky.getContext("2d")!;
      sc.setTransform(dpr, 0, 0, dpr, 0, 0);
      panorama(sc, w, h, this.mountain, this.aurora);
      this.layer.setSize(pw, ph);
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
      this.rivals.length,
      this.callout ? Math.round(this.callout.age / 16) : -1,
    ].join("/");
    if (frameKey === this.frameKey) return;
    this.frameKey = frameKey;
    const c = this.layer.context;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this.sky, 0, 0);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);

    const visibleRivals: VisibleRival[] = [];
    for (const rv of this.getRivalList()) {
      if (rv.ride.section === this.stage) {
        visibleRivals.push({
          ski: rv.ride.ski,
          wear: rv.wear,
          name: rv.name,
          effects: this.effects.get(rv.ride.ski),
        });
      }
    }
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
      visibleRivals,
      this.callout,
    );
  }
}
