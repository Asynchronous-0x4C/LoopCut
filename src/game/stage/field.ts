import { Container, Graphics, Particle, ParticleContainer, ParticleOptions, Texture, TextureSource, Ticker } from "pixi.js";
import { app } from "../../main";
import { ObservableValue } from "../../common/observable";
import { Laser } from "./objects";

export enum TileState {
  Used,
  Unused
}

export enum Direction {
  Up,
  Down,
  Right,
  Left
}

export class Field extends Container {
  tiles: Map<string, Tile> = new Map();
  lasers: Map<string, Laser> = new Map();
  aabb = {
    min: {
      x: 9999,
      y: 9999
    },
    max: {
      x: -9999,
      y: -9999
    }
  };
  offset = {
    x: 0,
    y: 0
  };
  manhattan = {
    min: 9999,
    max: -9999
  };
  gap: number = 60;

  constructor(){
    super();
  }

  update(t: Ticker) {
    this.tiles.forEach(c => {
      c.update(t);
    });
    this.lasers.forEach(l => {
      l.update(t);
    })
  }

  addTile(tile: Tile) {
    this.tiles.set(tile.key(), tile);
    this.aabb.min.x = Math.min(tile.x, this.aabb.min.x);
    this.aabb.max.x = Math.max(tile.x, this.aabb.max.x);
    this.aabb.min.y = Math.min(tile.y, this.aabb.min.y);
    this.aabb.max.y = Math.max(tile.y, this.aabb.max.y);
    this.manhattan.min = Math.min(tile.x + tile.y, this.manhattan.min);
    this.manhattan.max = Math.max(tile.x + tile.y, this.manhattan.max);
    const w = (this.aabb.max.x - this.aabb.min.x + 1) * this.gap;
    const h = (this.aabb.max.y - this.aabb.min.y + 1) * this.gap;
    this.offset.x = (1280 - w + this.gap) * 0.5;
    this.offset.y = (720 - h + this.gap) * 0.5;
    this.addChild(tile.g);
    if(this.tiles.has(`${tile.x-1},${tile.y}`)) {
      
    }
    if(this.tiles.has(`${tile.x+1},${tile.y}`)) {
      
    }
    if(this.tiles.has(`${tile.x},${tile.y-1}`)) {
      
    }
    if(this.tiles.has(`${tile.x},${tile.y+1}`)) {
      
    }
  }

  addLaser(laser: Laser) {
    this.lasers.set(laser.key(), laser);
    this.addChild(laser.g);
  }

  getTile(x: number, y:number): Tile|null {
    return this.tiles.get(`${x},${y}`) ?? null;
  }

  getAdjacentTile(x: number, y:number, dir: Direction): Tile|null {
    switch(dir) {
      case Direction.Up: --y; break;
      case Direction.Down: ++y; break;
      case Direction.Right: ++x; break;
      case Direction.Left: --x; break;
    }
    return this.getTile(x, y);
  }

  hasAdjacentTile(x: number, y:number, dir: Direction): boolean {
    switch(dir) {
      case Direction.Up: --y; break;
      case Direction.Down: ++y; break;
      case Direction.Right: ++x; break;
      case Direction.Left: --x; break;
    }
    return this.tiles.has(`${x},${y}`);
  }

  isJammed(x: number, y: number): boolean {
    for(let d of [Direction.Up, Direction.Down, Direction.Left, Direction.Right]) {
      const t = this.getAdjacentTile(x, y, d);
      if(t !== null && t.state.value === TileState.Unused){
        let lx = x;
        let ly = y;
        switch(d) {
          case Direction.Up: ly -= 0.5; break;
          case Direction.Down: ly += 0.5; break;
          case Direction.Right: lx += 0.5; break;
          case Direction.Left: lx -= 0.5; break;
        }
        const l = this.lasers.get(`${x},${y}`);
        if(l == null || (l != null && !l.active.value))return false;
      };
    }
    return true;
  }

  existsLaser(x: number, y:number, dir: Direction): boolean {
    switch(dir) {
      case Direction.Up: y -= 0.5; break;
      case Direction.Down: y += 0.5; break;
      case Direction.Right: x += 0.5; break;
      case Direction.Left: x -= 0.5; break;
    }
    const l = this.lasers.get(`${x},${y}`);
    return l != null && l.active.value;
  }

  gridToWorld(x: number, y: number) {
    return {x: this.offset.x + x * this.gap, y: this.offset.y + y * this.gap};
  }
}

export class Tile {
  state: ObservableValue<TileState>;
  x: number;
  y: number;
  z: number = 3;
  targetAlpha: number = 1;

  g: Graphics;

  constructor(state: TileState, x: number, y: number) {
    this.state = new ObservableValue(state);
    this.x = x;
    this.y = y;

    this.g = new Graphics();
    this.initGraphics(this.g);

    this.state.addListener((p, c) => {
      if(p === TileState.Unused && c === TileState.Used) {
        this.targetAlpha = 0.2;
      } else if(p === TileState.Used && c === TileState.Unused) {
        this.targetAlpha = 1;
      }
    });
  }

  initGraphics(g: Graphics) {
    g.circle(this.z, this.z, 10);
    g.stroke({
      width: 3,
      color: "#333333",
      alpha: 0.2
    });
    g.circle(0, 0, 10);
    g.stroke({
      width: 3,
      color: "#333333",
      alpha: 0.8
    });
  }

  key(): string {
    return `${this.x},${this.y}`;
  }

  update(t: Ticker) {
    this.g.alpha += (this.targetAlpha - this.g.alpha) * 0.4;
  }
}

export class StartTile extends Tile {

  initGraphics(g: Graphics): void {
    g.roundRect(this.z-10, this.z-10, 20, 20, 4);
    g.stroke({
      width: 3,
      color: "#333333",
      alpha: 0.2
    });
    g.roundRect(-10, -10, 20, 20, 4);
    g.stroke({
      width: 3,
      color: "#333333",
      alpha: 0.8
    });
    g.poly([
      {x: this.z-3, y:this.z+5 },
      {x: this.z-3, y:this.z-5 },
      {x: this.z+5.5, y:this.z }
    ]);
    g.fill({
      color: "#e63333",
      alpha: 0.2
    });
    g.poly([
      {x: -3, y:5 },
      {x: -3, y:-5 },
      {x: 5.5, y:0 }
    ]);
    g.fill({
      color: "#e63333",
      alpha: 0.8
    });
  }
}

export class EndTile extends Tile {

  initGraphics(g: Graphics): void {
    g.roundRect(this.z-10, this.z-10, 20, 20, 4);
    g.stroke({
      width: 3,
      color: "#333333",
      alpha: 0.2
    });
    g.roundRect(-10, -10, 20, 20, 4);
    g.stroke({
      width: 3,
      color: "#333333",
      alpha: 0.8
    });
    g.rect(this.z-4, this.z-4, 8, 8);
    g.fill({
      color: "#e63333",
      alpha: 0.2
    });
    g.rect(-4, -4, 8, 8);
    g.fill({
      color: "#e63333",
      alpha: 0.8
    });
  }
}

export class SwitchTile extends Tile {
  id: string;
  pushed: ObservableValue<boolean>;
  field: Field;
  
  constructor(state: TileState, x: number, y: number, id: string, field: Field) {
    super(state, x, y);
    this.pushed = new ObservableValue(false);
    this.id = id;
    this.field = field;
    this.pushed.addListener((p, c) => {
      if(c) {
        this.initGraphics(this.g, c);
        field.lasers.forEach(l => {
          if(l.id === id)l.active.value = false;
        })
      }
    });
  }

  initGraphics(g: Graphics, pushed: boolean = this.pushed?.value ?? false): void {
    g.clear();
    g.circle(this.z, this.z, 10);
    g.stroke({
      width: 3,
      color: "#333333",
      alpha: 0.2
    });
    g.circle(0, 0, 10);
    g.stroke({
      width: 3,
      color: "#333333",
      alpha: 0.8
    });
    g.circle(this.z, this.z, 5);
    g.fill({
      color: pushed ? "#a4b1b2" : "#5fc3c9",
      alpha: 0.2
    });
    g.circle(0, 0, 5);
    g.fill({
      color: pushed ? "#a4b1b2" : "#5fc3c9",
      alpha: 0.8
    });
  }
}

export class Node extends Particle {
 from: {x: number, y: number};
 to: {x: number, y: number};

  constructor(from: {x: number, y: number}, to: {x: number, y: number}, options: Texture<TextureSource<any>> | ParticleOptions){
    super(options);
    this.from = from;
    this.to = to;
  }


}