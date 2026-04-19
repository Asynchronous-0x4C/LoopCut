import { Container, Ticker } from "pixi.js";

export abstract class Entity extends Container {
  grid: {
    x: number,
    y: number
  } = {x: 0, y: 0};

  start: {
    x: number,
    y: number
  } = {x: 0, y: 0};

  abstract update(t: Ticker): void;
}