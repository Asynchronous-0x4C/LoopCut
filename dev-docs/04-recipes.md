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
// SwitchTile が実際にやっている回避（field.ts:279）
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
`Field` / `Tile` / `Player` / `StageLogic` / `StageView` / `UI` は**毎ループ捨てられる**。

### 0.5 描画は必ず「影 + 本体」の二重描き

このゲームの見た目の要。詳細は [05-visual-style.md](05-visual-style.md)。

---

## レシピ A: 新しいタイルを追加する

例として **「2 回まで通れるタイル」** を追加する。

### A-1. まず基底 `Tile` に判定メソッドを生やす（初回だけ）

現状、進入可否とタイル消費が `state.value` の直接読み書きで散らばっている。
タイルを増やす前に、この 2 つをメソッドに寄せる。

```ts
// src/game/stage/field.ts の class Tile に追加
canEnter(): boolean {
  return this.state.value === TileState.Unused;
}

enter(): void {
  this.state.value = TileState.Used;
}
```

呼び出し側を差し替える（**この 5 箇所がすべて**）:

| ファイル:行 | 変更前 | 変更後 |
|---|---|---|
| [stagelogic.ts:28](../src/game/stage/stagelogic.ts#L28) | `pt!.state.value = TileState.Used;` | `pt!.enter();` |
| [stagelogic.ts:35](../src/game/stage/stagelogic.ts#L35) | `t!.state.value = TileState.Used;` | `t!.enter();` |
| [stagelogic.ts:86](../src/game/stage/stagelogic.ts#L86) | `t.state.value === TileState.Unused` | `t.canEnter()` |
| [stagelogic.ts:128](../src/game/stage/stagelogic.ts#L128) | `getTile(p.x, p.y)!.state.value = TileState.Used;` | `getTile(p.x, p.y)!.enter();` |
| [field.ts:113](../src/game/stage/field.ts#L113) | `t.state.value === TileState.Unused` | `t.canEnter()`（`isJammed` 内） |

### A-2. タイルクラスを書く

```ts
// src/game/stage/field.ts の末尾付近
export class DoubleTile extends Tile {
  remain: ObservableValue<number>;

  constructor(state: TileState, x: number, y: number) {
    super(state, x, y);
    this.remain = new ObservableValue(2);
    this.remain.addListener((p, c) => this.initGraphics(this.g, c));
  }

  // 0.1 の回避パターン: 状態は引数で受け取る
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

  enter(): void {
    this.remain.value = this.remain.value - 1;
    if (this.remain.value <= 0) this.state.value = TileState.Used;
  }
}
```

### A-3. ステージ文字にマッピングする

```ts
// src/game/stage/stage.ts の getTile()
private getTile(c: string, x: number, y: number): Tile|null {
  switch(c){
    case 'S': return new StartTile(TileState.Unused, x, y);
    case 'G': return new EndTile(TileState.Unused, x, y);
    case '#': return new Tile(TileState.Unused, x, y);
    case '@': return new Tile(TileState.Used, x, y);
    case '=': return new DoubleTile(TileState.Unused, x, y);   // ← 追加
    default: break;
  }
  if(/[a-z]/.test(c)) return new SwitchTile(TileState.Unused, x, y, c, this.field);
  return null;
}
```

> **`a`〜`z` は `SwitchTile` に予約済み。** 新しいタイル文字は記号（`=`, `+`, `*`, `%`, `~` など）から選ぶ。
> `import` の追加も忘れずに（`stage.ts` の 5 行目）。

### A-4. ドキュメントを更新する

[03-stage-format.md の「使える文字」](03-stage-format.md#使える文字) の表に 1 行足す。**これを忘れないこと。**

### A-5. 確認

- [ ] `tsc --noEmit` が通る
- [ ] テスト用ステージで 2 回通れる／3 回目は通れない
- [ ] 2 回目通過後に見た目が変わる
- [ ] `isJammed` が正しく効く（残り 0 のタイルしか隣に無い → 詰み）

---

## レシピ B: 新しいオブジェクト（ギミック）を追加する

タイルではなく、フィールド上に置く独立要素（レーザーのようなもの）。
例として **「N ターンごとに ON/OFF が切り替わるレーザー」** を追加する。

### B-1. 現状のオブジェクトの通り道

```
stages/*.json の objects[]
  → Stage.reset()          … switch(v.type) でインスタンス化        [stage.ts:107-117]
  → Field.addLaser()       … Map に登録 + addChild(laser.g)         [field.ts:81-84]
  → StageView.constructor  … g.x / g.y をグリッド座標から決める       [stageview.ts:29-32]
  → StageView.update()     … 入退場アニメで g.pivot.y を動かす        [stageview.ts:50-54]
  → Field.update()         … 毎フレーム laser.update(t)              [field.ts:49-51]
  → StageLogic.next()      … existsLaser() で通行判定                [stagelogic.ts:114]
```

**新しい種類のオブジェクトを足すときは、この 6 箇所すべてを埋めること。**
どれか 1 つでも抜けると「見えるけど当たらない」「当たるけど見えない」「アニメだけ動かない」になる。

### B-2. ターン経過フックを用意する（初回だけ）

現状、「1 ターン進んだ」を通知する仕組みが無い。まずこれを作る。

```ts
// src/game/stage/field.ts の class Field に追加
turn: number = 0;

nextTurn() {
  ++this.turn;
  this.lasers.forEach(l => l.onTurn(this.turn));
}
```

```ts
// src/game/stage/stagelogic.ts の loop() 内、ゴーストの forEach [stagelogic.ts:88-93] の直後
this.stage.field.nextTurn();
```

```ts
// src/game/stage/objects.ts の class Laser に追加（既定は何もしない）
onTurn(turn: number) {}
```

### B-3. クラスを書く

```ts
// src/game/stage/objects.ts
export class PulseLaser extends Laser {
  interval: number;

  constructor(x: number, y: number, id: string, interval: number) {
    super(x, y, id);
    this.interval = Math.max(1, interval);
  }

  onTurn(turn: number) {
    // スイッチで恒久的に切られていたら復活させない
    if (this.disabled) return;
    this.active.value = Math.floor(turn / this.interval) % 2 === 0;
  }
}
```

`Laser` 側に「スイッチで切られた」を覚えるフラグを足す:

```ts
// src/game/stage/objects.ts の class Laser
disabled: boolean = false;
```

```ts
// src/game/stage/field.ts の SwitchTile のリスナ [field.ts:271-275]
field.lasers.forEach(l => {
  if (l.id === id) {
    l.disabled = true;      // ← 追加
    l.active.value = false;
  }
});
```

### B-4. JSON からインスタンス化する

```ts
// src/game/stage/stage.ts の reset() 内
switch(v.type) {
  case "laser":
    this.field.addLaser(new Laser(v.position.x, v.position.y, v.id));
    break;
  case "pulse":                                                        // ← 追加
    this.field.addLaser(new PulseLaser(v.position.x, v.position.y, v.id, v.interval ?? 2));
    break;
  default: break;
}
```

`PulseLaser` は `Laser` を継承しているので既存の `lasers` Map に入れてよい。
**まったく別種のオブジェクト**（タイルの上に乗るアイテム等）なら、
`Field` に別の Map と `addXxx()` / `getXxx()` を用意し、B-1 の 6 箇所を新設する。

### B-5. ドキュメントを更新する

[03-stage-format.md の objects の節](03-stage-format.md#3-objects-の書き方) に `type` の項を足す。

### B-6. 確認

- [ ] `tsc --noEmit`
- [ ] ステージ開始アニメで他のタイルと一緒にせり上がる（B-1 の StageView 側が効いているか）
- [ ] 実体ゴーストが当たる／非実体ゴーストがすり抜ける
- [ ] 対応スイッチを踏むと恒久停止する

---

## レシピ C: 新しい画面（シーン）を追加する

例: **ステージセレクト画面**。

### C-1. 現状の制約を理解する

- `Game` のコンストラクタで**全シーンが即座にインスタンス化される**（[game.ts:12-17](../src/game/game.ts#L12-L17)）。
  重い初期化をコンストラクタに書くと起動が遅くなる。
- `Scene` に**入退場フックが無い**（[scene.ts](../src/game/scene.ts)）。
  再入場したときに状態が残る（`Fin` の `time` が `null` に戻らないのがその例）。
  → **再入場を想定するシーンは、自前の `enter()` を作って `setScene` の後に呼ぶ。**

### C-2. シーンを書く

```ts
// src/game/select/select.ts
import { Container, Ticker } from "pixi.js";
import { Scene } from "../scene";
import { Game } from "../game";
import { key } from "../../main";
import { Stage } from "../stage/stage";

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

  enter(count: number) {
    this.index = 0;
    this.inputAvailable = false;
    // 選択肢を作り直す
  }

  update(t: Ticker): void {
    if (!key.pressed) { this.inputAvailable = true; return; }
    if (!this.inputAvailable) return;

    if (key.keys.has("d")) { this.index++; this.inputAvailable = false; }
    if (key.keys.has("a")) { this.index--; this.inputAvailable = false; }
    if (key.keys.has("Enter")) {
      this.game.setScene("game");
      const s = this.game.getScene();
      if (s instanceof Stage) s.load(this.index);
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

タイトルの遷移先は [title.ts:66-70](../src/game/title/title.ts#L66-L70) にハードコードされている。
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

- テキストは `Title` / `Fin` / `UI` で**同じスタイル定義が 3 回コピペされている**。
  新規で足すなら、先に共通化してから使うこと（[07-roadmap.md](07-roadmap.md) フェーズ 1）:

```ts
// src/common/text.ts（新規）
import { TextStyle } from "pixi.js";

export const bodyStyle = new TextStyle({
  fontFamily: 'Noto Sans JP',
  fontSize: 25,
  fill: 0x646464,
  dropShadow: { color: '#646464', blur: 0, distance: 3, alpha: 0.25 }
});
```

- `UI` 全体の alpha は `StageView.update()` が毎フレーム上書きする（[stageview.ts:60](../src/game/stage/stageview.ts#L60)）。
  UI 側で `this.alpha` を直接いじっても効かない。個別要素の alpha を使うこと。
- 残歩数ドットは `ParticleContainer`。前半 `steps` 個が影、後半 `steps` 個が本体
  （[ui.ts:27-39](../src/game/ui/ui.ts#L27-L39)）。数を変えるならこの 2 重構造を維持する。

---

## レシピ E: 進捗を保存する

README にある「ブラウザをリロードすると進捗がリセットされる」を直す場合。

- 保存先は `localStorage`（Tauri でも Web でも動く）。
- 書き込みポイント: [stagelogic.ts:65](../src/game/stage/stagelogic.ts#L65) の
  `this.stage.load(this.stage.currentIndex + 1)` の直前。
- 読み込みポイント: [title.ts:69](../src/game/title/title.ts#L69) の `s.load(0)`。
- `Stage.load()` は範囲外の index で `fin` シーンへ飛ぶ（[stage.ts:46-48](../src/game/stage/stage.ts#L46-L48)）ので
  保存値が壊れていても致命傷にはならないが、`Number.isInteger` の検証は入れること。

---

## レシピ F: 効果音を足す

現状**音は一切鳴っていない**（依存も無い）。追加するなら:

1. `pixi.js` にサウンド機能は含まれないので `@pixi/sound` か `howler` を入れる。
2. 音のトリガは `StageLogic` に集約する（移動成功 / レーザー衝突 / スイッチ / クリア / ループ開始）。
   `StageView` は演出専用なので、そちらには書かない。
3. ブラウザの自動再生制限があるため、**タイトルでの最初のキー入力で `AudioContext` を resume する**
   （[title.ts:56-58](../src/game/title/title.ts#L56-L58) が最初のユーザー操作を捕まえている）。
