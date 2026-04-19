import { Container, Ticker } from "pixi.js";
import { Game } from "./game";

export abstract class Scene {
  abstract game: Game;
  container: Container = new Container();

  abstract update(t: Ticker): void;
}