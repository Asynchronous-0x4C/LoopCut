import { Application } from "pixi.js";
import { Game } from "./game/game";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "./common/screen";

export let app: Application;
export const mouse = {
  x: 0,
  y: 0,
  pressed: false
};
export const key = {
  pressed: false,
  keys: new Set<string>(),
  keyCodes: new Set<number>()
}
export const startTime = Date.now();

const resize = () => {
  let ratio = Math.min(window.innerWidth/SCREEN_WIDTH, window.innerHeight/SCREEN_HEIGHT);
  
  app.stage.scale.x = app.stage.scale.y = ratio;
  
  app.renderer.resize(Math.ceil(SCREEN_WIDTH * ratio), Math.ceil(SCREEN_HEIGHT * ratio));
}

(async () => {
  app = new Application();

  await app.init({
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    resolution: window.devicePixelRatio,
    background: "#e6e6e6"
  });

  document.body.appendChild(app.canvas);

  initEvent();

  resize();
  window.addEventListener('resize', resize);

  const game = new Game();

  app.ticker.add(t => {
    game.update(t);
  });
})();

function initEvent() {
  app.stage.addEventListener('pointerdown',() => {
    mouse.pressed = true;
  });
  app.stage.addEventListener('pointerup',() => {
    mouse.pressed = false;
  });
  app.stage.addEventListener('pointermove',(e) => {
    mouse.x = e.globalX;
    mouse.y = e.globalY;
  });

  window.addEventListener('keydown',e => {
    key.keys.add(e.key);
    key.keyCodes.add(e.keyCode);
    key.pressed = true;
  });
  window.addEventListener('keyup',e => {
    key.keys.delete(e.key);
    key.keyCodes.delete(e.keyCode);
    key.pressed = key.keys.size > 0;
  });
}