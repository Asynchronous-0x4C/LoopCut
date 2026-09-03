# 04. 追加レシピ

新しいタイル / ギミック / 画面 / UI を足すときの手順書。
**着手前に [02-game-rules.md](02-game-rules.md) と §0 の落とし穴に目を通すこと。**

---

## 0. 先に知っておく落とし穴

### 0.1 サブクラスのフィールドは `super()` の後に初期化される

`tsconfig.json` は `useDefineForClassFields: true`。
`Tile` の基底コンストラクタは `this.initGraphics(this.g)` を呼ぶが、
**その時点でサブクラスのフィールドはまだ `undefined`**。

```ts
// SwitchTile が実際にやっている回避（tiles.ts の SwitchTile.initGraphics）
initGraphics(g: Graphics, pushed: boolean = this.pushed?.value ?? false): void { ... }
```

→ **`initGraphics` をオーバーライドするときは、状態を引数で受け取り `?.` と `??` で既定値を用意する。**

### 0.2 `app` はモジュールのトップレベルで参照してはいけない

`app` は [main.ts](../src/main.ts) の非同期即時関数の中で代入される。
モジュール読み込み時点では `undefined`。**必ずコンストラクタ以降で触る。**

### 0.3 `ObservableValue` は「代入前」に通知する

リスナ内で `this.value` を読むと**旧値**が返る。必ず引数の `cur` を使う。
詳細は [01-architecture.md §5](01-architecture.md#5-observablevalue-の注意点)。

### 0.4 `Stage.reset()` はシーングラフを毎ループ作り直す

ループをまたいで保持したい状態は `Stage` のフィールドに置く（`ghosts` がそう）。
`Field` / `Tile` / `Player` / `StageLogic` / `KeyboardInput` / `StageView` / `UI` は**毎ループ捨てられる**。

### 0.5 描画は必ず「影 + 本体」の二重描き

このゲームの見た目の要。詳細は [05-visual-style.md](05-visual-style.md)。

### 0.6 ルールに関わるコードで `app` を参照しない

`Field` / `Tile` / `Entity` / `Player` / `Ghost` / `StageLogic` は
**ヘッドレス（`bun run verify` のソルバ）でも動く必要がある。**
この 6 つのファイルで `app`（レンダラ）や `key`（入力）を import した瞬間、
`bun run verify` が動かなくなる。

- レンダラが要る処理 → `StageView` か `UI` へ
- 入力が要る処理 → `KeyboardInput`（[stageinput.ts](../src/game/stage/stageinput.ts)）へ

`Container` や `Graphics` の生成そのものは描画コンテキスト無しでもできるので問題ない。

---

## レシピ A: 新しいタイルを追加する

例として **「2 回まで通れるタイル」** を追加する。触るファイルは
[tiles.ts](../src/game/stage/tiles.ts) の 1 つだけ。

### A-1. タイルクラスを書く

`Tile` が持つ拡張点は 3 つ。

| メンバ | 意味 |
|---|---|
| `canEnter(): boolean` | このタイルに進入できるか |
| `onEnter(solid: boolean): void` | 進入されたときの処理。`solid` は実体を持つエンティティか |
| `get isGoal(): boolean` | 進入したらクリアか |

```ts
// src/game/stage/tiles.ts の末尾付近
export class DoubleTile extends Tile {
  remain: ObservableValue<number>;

  constructor(state: TileState, x: number, y: number) {
    super(state, x, y);
    this.remain = new ObservableValue(2);
    this.remain.addListener((p, c) => this.initGraphics(this.g, c));
  }

  // §0.1 の回避パターン: 状態は引数で受け取り、既定値を ?. と ?? で守る
  initGraphics(g: Graphics, remain: number = this.remain?.value ?? 2): void {
    g.clear();
    // --- 影（z オフセット, alpha 0.2）---
    g.circle(this.z, this.z, 10);
    g.stroke({ width: 3, color: "#333333", alpha: 0.2 });
    if (remain > 1) {
      g.circle(this.z, this.z, 4.5);
      g.stroke({ width: 2, color: "#333333", alpha: 0.2 });
    }
    // --- 本体（alpha 0.8）---
    g.circle(0, 0, 10);
    g.stroke({ width: 3, color: "#333333", alpha: 0.8 });
    if (remain > 1) {
      g.circle(0, 0, 4.5);
      g.stroke({ width: 2, color: "#333333", alpha: 0.8 });
    }
  }

  canEnter(): boolean {
    return this.remain.value > 0;
  }

  onEnter(solid: boolean): void {
    if (!solid) return;                 // 非実体のゴーストは消費しない
    this.remain.value = this.remain.value - 1;
    if (this.remain.value <= 0) this.state.value = TileState.Used;
  }
}
```

> `onEnter` で `super.onEnter(solid)` を呼ぶかは、そのタイルが
> 「通常どおり `Used` になる」かどうかで決める。`SwitchTile` は呼び、`DoubleTile` は呼ばない。

### A-2. レジストリに 1 行足す

```ts
// src/game/stage/tiles.ts の tileRegistry
export const tileRegistry: Record<string, TileFactory> = {
  "S": (x, y) => new StartTile(TileState.Unused, x, y),
  "G": (x, y) => new EndTile(TileState.Unused, x, y),
  "#": (x, y) => new Tile(TileState.Unused, x, y),
  "@": (x, y) => new Tile(TileState.Used, x, y),
  "=": (x, y) => new DoubleTile(TileState.Unused, x, y)    // ← これだけ
};
```

> **`a`〜`z` は `SwitchTile` に予約済み。** 新しいタイル文字は記号（`=`, `+`, `*`, `%`, `~` など）から選ぶ。

### A-3. 検証用の文字を登録する

```ts
// src/game/stage/stagedata.ts
export const TILE_CHARS = ["S", "G", "#", "@", "="] as const;   // ← 追加
```

これを忘れると `bun run verify` が「タイルにならない文字」として警告する。

### A-4. ドキュメントを更新する

[03-stage-format.md の「使える文字」](03-stage-format.md#使える文字) の表に 1 行足す。**これを忘れないこと。**

### A-5. 確認

- [ ] `./node_modules/.bin/tsc --noEmit` が通る
- [ ] `bun run verify` が通る（既存ステージの最小ループ数が変わっていない）
- [ ] 新しい文字を使ったテストステージを 1 つ作り、`bun run verify` で解けることを確認
- [ ] `bun run dev` で見た目を確認（2 回目通過後に変化するか）

---

## レシピ B: 新しいオブジェクト（ギミック）を追加する

タイルではなく、フィールド上に置く独立要素（レーザーのようなもの）。
例として **「N ターンごとに ON/OFF が切り替わるレーザー」** を追加する。

### B-1. 現状のオブジェクトの通り道

```
stages/*.json の objects[]
  → createObject()         … objectRegistry でインスタンス化      [objects.ts]
  → Field.addLaser()       … Map に登録 + addChild(laser.g)       [field.ts]
  → StageView.constructor  … gridToWorld() で g.x / g.y を決める   [stageview.ts]
  → StageView.update()     … 入退場アニメで g.pivot.y を動かす      [stageview.ts]
  → Field.update()         … 毎フレーム laser.update(t)            [field.ts]
  → Field.nextTurn()       … 1 ターンごとに laser.onTurn(turn)     [field.ts]
  → StageLogic.next()      … existsLaser() で通行判定              [stagelogic.ts]
```

`Laser` を継承する限り、**書くのは B-2 と B-3 の 2 箇所だけ**で残りは自動でつながる。
まったく別種のオブジェクト（タイルの上に乗るアイテム等）を作る場合は、
`Field` に別の Map と `addXxx()` を用意し、上の 7 箇所すべてを新設すること。

### B-2. クラスを書く

```ts
// src/game/stage/objects.ts
export class PulseLaser extends Laser {
  interval: number;

  constructor(x: number, y: number, id: string, interval: number) {
    super(x, y, id);
    this.interval = Math.max(1, interval);
  }

  onTurn(turn: number) {
    if (this.disabled) return;          // スイッチで恒久停止済みなら復活させない
    this.active.value = Math.floor(turn / this.interval) % 2 === 0;
  }
}
```

### B-3. レジストリと検証用の型に 1 行ずつ足す

```ts
// src/game/stage/objects.ts
export const objectRegistry: Record<string, ObjectFactory> = {
  laser: d => new Laser(d.position.x, d.position.y, d.id),
  pulse: d => new PulseLaser(d.position.x, d.position.y, d.id, 2)   // ← 追加
};
```

```ts
// src/game/stage/stagedata.ts
export const OBJECT_TYPES = ["laser", "pulse"] as const;            // ← 追加
```

> `interval` のような追加パラメータを JSON から取りたい場合は
> `StageObjectData` に省略可能なフィールドを足し、`validateStage()` にも検査を足すこと。

### B-4. ドキュメントを更新する

[03-stage-format.md の objects の節](03-stage-format.md#3-objects-の書き方) に `type` の項を足す。

### B-5. 確認

- [ ] `tsc --noEmit` / `bun run verify`
- [ ] ステージ開始アニメで他のタイルと一緒にせり上がる
- [ ] 実体ゴーストが当たる／非実体ゴーストがすり抜ける
- [ ] 対応スイッチを踏むと恒久停止する（`disabled` が効いているか）

---

## レシピ C: 新しい画面（シーン）を追加する

例: **ステージセレクト画面**。

### C-1. 現状の決まりを理解する

- `Game` のコンストラクタで**全シーンが即座にインスタンス化される**（[game.ts](../src/game/game.ts)）。
  重い初期化をコンストラクタに書くと起動が遅くなる。
- `Scene` には `enter()` / `exit()` がある（[scene.ts](../src/game/scene.ts)）。
  **再入場時の初期化はコンストラクタではなく `enter()` に書く。**
  `Select` は `enter()` でマップを組み立て直し、`Fin` は `enter()` でテキストを作り直している。
- **シーン同士は互いを import しない。** 遷移は `Game` のメソッドが仲介する
  （`openSelect()` / `playStage()` / `returnToSelect()`）。
  引数を渡したいときは、`setScene()` の前に対象シーンの `prepare◯◯()` を呼んでおく。
- 実例として [Select](../src/game/select/select.ts) を読むのが早い。

### C-2. シーンを書く

```ts
// src/game/select/select.ts
import { Container, Ticker } from "pixi.js";
import { Scene } from "../scene";
import { Game } from "../game";
import { key } from "../../main";
export class Select extends Scene {
  game: Game;
  index: number = 0;
  items: Array<Container> = [];
  inputAvailable: boolean = false;

  constructor(game: Game) {
    super();
    this.game = game;
    // 表示物の生成…（描画規約は 05-visual-style.md）
  }

  enter(): void {
    this.index = 0;
    this.inputAvailable = false;
    // 表示物を作り直す
  }

  update(t: Ticker): void {
    if (!key.pressed) { this.inputAvailable = true; return; }
    if (!this.inputAvailable) return;

    if (key.keys.has("d")) { this.index++; this.inputAvailable = false; }
    if (key.keys.has("a")) { this.index--; this.inputAvailable = false; }
    if (key.keys.has("Enter")) {
      // 遷移は Game 経由。シーンから他のシーンを import しない
      this.game.playStage(this.index, "1-1");
    }
  }
}
```

> 入力は必ず `inputAvailable` パターンで受けること。
> `key.keys` は押されている間ずっと値が入っているので、素直に読むと毎フレーム連射される。

### C-3. `Game` に登録する

```ts
// src/game/game.ts
import { Select } from "./select/select";
// ...
this.scenes.set("title", new Title(this));
this.scenes.set("select", new Select(this));   // ← 追加
this.scenes.set("game", new Stage(this));
this.scenes.set("fin", new Fin(this));
```

### C-4. 遷移元をつなぐ

タイトルの遷移先は [title.ts](../src/game/title/title.ts) の `update()` にハードコードされている。
ここを `this.game.setScene("select")` に変える。

### C-5. 確認

- [ ] `tsc --noEmit`
- [ ] 画面を往復しても状態が壊れない（`enter()` を呼んでいるか）
- [ ] 入力が連射にならない
- [ ] 1280x720 の座標系で置いている（中央は `x = 640, y = 360`）

---

## レシピ D: UI 要素を追加する

`UI` は `Container` を継承し、`Stage` を直接参照する（[ui.ts](../src/game/ui/ui.ts)）。
ステージ内 UI はここに足す。

- テキストのスタイルは [src/common/text.ts](../src/common/text.ts) の `bodyTextStyle` を使う:

```ts
import { bodyTextStyle } from "../../common/text";

const t = new Text({ text: "…", style: bodyTextStyle, x: 5, y: 30 });
```

- `UI` 全体の alpha は `StageView.update()` が毎フレーム上書きする（[stageview.ts](../src/game/stage/stageview.ts)）。
  UI 側で `this.alpha` を直接いじっても効かない。個別要素の alpha を使うこと。
- 残歩数ドットは `ParticleContainer`。前半 `steps` 個が影、後半 `steps` 個が本体
  （[ui.ts](../src/game/ui/ui.ts)）。数を変えるならこの 2 重構造を維持する。

---

## レシピ E: 進捗に何かを記録する

**実装済み。** [src/common/progress.ts](../src/common/progress.ts) が `localStorage` を扱う。

```ts
import { isCleared, markCleared, clearedCount } from "../../common/progress";
```

- 記録するタイミングは [stage.ts](../src/game/stage/stage.ts) の `clear()`。
  **`StageLogic` には書かないこと**（§0.6。ソルバが動かなくなる）。
- 保存する項目を増やすときは `Progress` に足し、`loadProgress()` の検証も足す。
  **壊れた値が入っていてもゲームが起動しなくなってはいけない。**
- 選択画面のイベント演出も、再生済みかどうかをここに記録している
  （[08-select-format.md](08-select-format.md)）。

---

## レシピ F: 効果音を足す

現状**音は一切鳴っていない**（依存も無い）。追加するなら:

1. `pixi.js` にサウンド機能は含まれないので `@pixi/sound` か `howler` を入れる。
2. **`StageLogic` に直接 `play()` を書かない**（§0.6。ソルバが動かなくなる）。
   `StageContext` に `onSound(name)` のような通知を足し、`Stage` 側で鳴らす。
   ソルバ側（`Sim`）は空実装にすればよい。
3. ブラウザの自動再生制限があるため、**タイトルでの最初のキー入力で `AudioContext` を resume する**
   （[title.ts](../src/game/title/title.ts) の `update()` が最初のユーザー操作を捕まえている）。
