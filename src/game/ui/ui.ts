import { Container, Graphics, Particle, ParticleContainer, Text, Texture, Ticker } from "pixi.js";
import { Stage } from "../stage/stage";
import { app } from "../../main";
import { bodyTextStyle } from "../../common/text";
import { damp } from "../../common/interpolate";

/**
 * 残歩数ドットのテクスチャ。ループのたびに generateTexture すると
 * RenderTexture が積み上がるので、一度だけ作って使い回す。
 */
let dotTexture: Texture|null = null;

function getDotTexture(): Texture {
  if(dotTexture === null) {
    const g = new Graphics();
    g.roundRect(-10, -10, 20, 20, 3);
    g.fill({
      color: "#ffffff",
    });
    dotTexture = app.renderer.generateTexture(g);
    g.destroy();
  }
  return dotTexture;
}

export class UI extends Container {
  stage: Stage;
  steps: ParticleContainer;
  controls: Text;

  constructor(stage: Stage) {
    super();
    this.steps = new ParticleContainer({
      dynamicProperties: {
        position: false,
        color: true
      }
    });
    this.steps.interactive = true;
    this.stage = stage;
    const offset = (-25 * stage.steps + 5 + 1280) * 0.5;
    const t = getDotTexture();
    for(let i = 0; i < stage.steps * 2; i++) {
      const s = Math.floor(i / stage.steps) === 0;
      const n = i % stage.steps;
      this.steps.addParticle(new Particle({
        texture: t,
        tint: "#646464",
        alpha: 0.8,
        anchorX: 0.5,
        anchorY: 0.5,
        x: offset + n * 25 + (s ? 3 : 0),
        y: 40 + (s ? 3 : 0)
      }));
    }
    this.addChild(this.steps);

    this.controls = new Text({
      text: "移動: W/A/S/D\nリセット: R",
      style: bodyTextStyle,
      x: 5,
      y: 30
    });
    this.controls.alpha = 0.8;
    this.addChild(this.controls);
  }

  update(t: Ticker) {
    const k = damp(0.5, t.deltaTime);
    this.steps.particleChildren.forEach((p, i) => {
      const s = Math.floor(i / this.stage.steps) === 0;
      i = i % this.stage.steps;
      const target = (s ? 0.2 : 1) * (i < this.stage.logic.remainSteps ? 0.8 : 0.2);
      (p as Particle).alpha += (target - (p as Particle).alpha) * k;
    });
  }
}