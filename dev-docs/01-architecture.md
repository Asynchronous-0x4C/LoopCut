# 01. アーキテクチャ

> 記述時点: `plus` ブランチ フェーズ 2.5 完了時点。ソース合計 約 1,800 行。

## 1. 全体像

```
index.html
  └ src/main.ts          … PixiJS Application の生成、入力収集、リサイズ、ticker 起動
      └ Game             … シーンの保持と切り替え（title / game / fin）
          ├ Title        … タイトル画面
          ├ Stage        … ゲーム本体（シーン）。StageContext を実装する
          │   ├ Field    … タイルとレーザーの集合（Container）
          │   ├ Player   … 操作キャラ（Entity）
          │   ├ Ghost[]  … 過去のループの分身（Entity）
          │   ├ StageLogic   … ルール。描画にも入力にも依存しない
          │   ├ KeyboardInput … キー入力 → StageLogic の操作
          │   ├ StageView    … 演出（タイルのせり上がり、フェード）
          │   └ UI           … 残歩数ドット、操作説明
          └ Fin          … クリア後の画面

scripts/verify-stages.ts （bun run verify）
  └ Sim                  … StageContext を実装したヘッドレス版
      └ StageLogic       … ↑ とまったく同じインスタンス
```

### ルールと描画の分離

フェーズ 2 で **`StageLogic` から PixiJS と入力への依存を切った。**

- `StageLogic` が知っているのは [`StageContext`](../src/game/stage/stagelogic.ts) だけ
  （`field` / `player` / `ghosts` / `steps` と、`restart()` / `clear()` の 2 つのコールバック）。
- 入力は [`KeyboardInput`](../src/game/stage/stageinput.ts) が `tryMove()` / `requestReset()` を
  呼ぶ形で外から与える。
- おかげで [`solver.ts`](../src/game/stage/solver.ts) の `Sim` が `StageContext` を実装するだけで、
  **ルールを一切再実装せずに**ステージが解けるかを検証できる。

> PixiJS v8 の `Container` / `Graphics` は描画コンテキストが無くても構築できるので、
> `Field` / `Tile` / `Player` / `Ghost` はヘッドレス（bun）でもそのまま動く。
> **ルールに関わるコードで `app`（レンダラ）を参照しないこと。** 参照した瞬間にソルバが動かなくなる。

## 2. ファイル一覧と責務

| ファイル | 行数 | 責務 | 備考 |
|---|---:|---|---|
| [src/main.ts](../src/main.ts) | 70 | Pixi 初期化、`app` / `mouse` / `key` / `startTime` のグローバル公開、リサイズ | グローバル可変状態が 4 つある |
| [src/common/observable.ts](../src/common/observable.ts) | 24 | `ObservableValue<T>`。値変更時にリスナを呼ぶ | 変更**前**に通知する点に注意（§5） |
| [src/common/text.ts](../src/common/text.ts) | 21 | 本文テキストの共通スタイル `bodyTextStyle` | |
| [src/game/game.ts](../src/game/game.ts) | 33 | シーンの Map と切り替え | シーンは起動時に全部インスタンス化される |
| [src/game/scene.ts](../src/game/scene.ts) | 8 | `Scene` 抽象クラス（`container` + `update`） | 入退場フックが無い（C-1） |
| [src/game/title/title.ts](../src/game/title/title.ts) | 63 | タイトル画面、ロゴ SVG 表示、キー入力でステージ 0 へ | 遷移先がハードコード |
| [src/game/fin/fin.ts](../src/game/fin/fin.ts) | 31 | クリア画面、プレイ時間表示 | Text を `update` 内で遅延生成 |
| [src/game/ui/ui.ts](../src/game/ui/ui.ts) | 63 | 残歩数ドット（ParticleContainer）、操作説明 | `Stage` を直接参照 |
| **ルール（描画・入力に依存しない）** | | | |
| [src/game/stage/direction.ts](../src/game/stage/direction.ts) | 43 | `Direction` と `offsetOf` / `opposite` / `directionFromKey` | 方向の計算はすべてここ経由 |
| [src/game/stage/tiles.ts](../src/game/stage/tiles.ts) | 226 | `TileState` / `Tile` / `StartTile` / `EndTile` / `SwitchTile` / **`tileRegistry`** | **新しいタイルはここに 1 行** |
| [src/game/stage/objects.ts](../src/game/stage/objects.ts) | 99 | `Laser` と **`objectRegistry`** | **新しいギミックはここに 1 行** |
| [src/game/stage/field.ts](../src/game/stage/field.ts) | 139 | `Field`。タイル/レーザーの集合、座標変換、詰み判定、ターン通知 | スイッチ→レーザーの結線もここ |
| [src/game/stage/entity.ts](../src/game/stage/entity.ts) | 55 | `Entity`。グリッド移動・補間・レーザーへの突っ込み演出 | `Player`/`Ghost` の共通部 |
| [src/game/stage/player.ts](../src/game/stage/player.ts) | 38 | プレイヤー。移動履歴 `command` を保持 | 常に `solid` |
| [src/game/stage/ghost.ts](../src/game/stage/ghost.ts) | 83 | ゴースト。逆再生コマンドと `remainSteps` | `remainSteps > 0` の間だけ `solid` |
| [src/game/stage/stagelogic.ts](../src/game/stage/stagelogic.ts) | 188 | **ルールの正**。`StageContext` / `LogicState` / `tryMove` / `requestReset` | PixiJS の `Ticker` 型以外に描画依存なし |
| **データ** | | | |
| [src/game/stage/stagedata.ts](../src/game/stage/stagedata.ts) | 55 | ステージ JSON の型と定数 | `StageData` / `DEFAULT_STEPS` / `MAX_GHOSTS` ほか |
| [src/game/stage/stages/index.ts](../src/game/stage/stages/index.ts) | 27 | **プレイ順のステージ配列**。ここの並びが順序の正 | |
| [src/game/stage/validate.ts](../src/game/stage/validate.ts) | 119 | ステージデータの検証 | dev サーバ起動時と `bun run verify` |
| **描画・入力・検証** | | | |
| [src/game/stage/stage.ts](../src/game/stage/stage.ts) | 165 | シーン。`StageContext` を実装し、データからシーングラフを組み立てる | |
| [src/game/stage/stageinput.ts](../src/game/stage/stageinput.ts) | 43 | キー入力 → `StageLogic` の操作 | ここだけが `key` を読む |
| [src/game/stage/stageview.ts](../src/game/stage/stageview.ts) | 66 | 入退場演出（マンハッタン距離による波） | `logic.time` を読むだけ |
| [src/game/stage/solver.ts](../src/game/stage/solver.ts) | 220 | ヘッドレスな `StageContext` 実装とソルバ | **ゲーム本体からは import されない** |
| [scripts/verify-stages.ts](../scripts/verify-stages.ts) | 82 | `bun run verify` の本体 | |

## 3. 起動から 1 フレームまで

```mermaid
sequenceDiagram
  participant M as main.ts
  participant G as Game
  participant S as Scene(current)
  M->>M: app.init({1280x720, bg #e6e6e6})
  M->>M: document.body.appendChild(app.canvas)
  M->>M: initEvent() でキー/ポインタを Set に収集
  M->>M: resize() でステージ全体を等比スケール
  M->>G: new Game()
  G->>G: title / game / fin を全部生成し setScene("title")
  M->>M: app.ticker.add(t => game.update(t))
  loop 毎フレーム
    G->>S: update(t)
  end
```

- **入力はポーリング方式。** `keydown`/`keyup` で `key.keys: Set<string>` を更新するだけで、
  実際の判定は [`KeyboardInput.update()`](../src/game/stage/stageinput.ts) が毎フレーム Set を走査し、
  `StageLogic.tryMove()` / `requestReset()` を呼ぶ。**`key` を読むのはこのファイルだけ。**
- リサイズは `app.stage.scale` を一律に変え、レンダラのサイズを追従させる。
  **ゲームコードは常に 1280x720 の座標系で書いてよい。**

## 4. Stage の再構築サイクル

`Stage` は「ループが終わるたびにシーングラフを丸ごと作り直す」設計になっている。

```mermaid
stateDiagram-v2
  [*] --> Start: reset()
  Start --> Loop: time >= 50
  Loop --> Next: 歩数切れ / 詰み / レーザー衝突 / R キー
  Loop --> End: ゴールに到達
  Next --> Start: time <= 0 → ctx.restart(keepGhost)
  End --> [*]: time <= 0 → ctx.clear()
```

`StageLogic` は自分では何も作り直さない。時間切れになったら `StageContext` の
`restart()` / `clear()` を呼ぶだけで、実際の作り直しは `Stage` が行う。

`Stage.reset(init)` がやること（[stage.ts の reset()](../src/game/stage/stage.ts)）:

1. `steps` をステージデータから取得（既定 `DEFAULT_STEPS`）
2. `container.destroy()` → `new Container()` で作り直し
3. 背景グラデーションを描画
4. `new Field()` を作り、`tiles` 文字列を 1 文字ずつ `createTile()` でタイル化して登録
5. `objects` 配列を `createObject()` でインスタンス化して登録
6. `init === false` なら、**直前の `player` から `Ghost` を生成**して `ghosts` に追加
   （`MAX_GHOSTS` を超えたら古いものを `shift()`）
7. `new Player(start, gap)`
8. `new StageLogic(this)` → `new KeyboardInput()` → `new StageView(this)` → `new UI(this)`

`init` の意味:

| 呼び出し | `init` | 効果 |
|---|---|---|
| `load()` から（新ステージ） | `true` | ゴーストを全消去してやり直し |
| ループ終了（`restart(true)`） | `false` | 直前のプレイヤーをゴースト化して引き継ぐ |
| `R` キーでのリセット（`restart(false)`） | `true` | ゴーストを消してやり直し |

**ソルバ（[solver.ts](../src/game/stage/solver.ts) の `Sim`）もこの 1〜8 と同じ手順を踏む。**
ここの順序を変えたら `Sim.build()` も合わせること。

## 5. `ObservableValue` の注意点

```ts
set value(value: T) {
  this.listeners.forEach(l => l(this._value, value));  // ← 先に通知
  this._value = value;                                  // ← 後で代入
}
```

**リスナが呼ばれた時点では `_value` はまだ古い。** リスナ内で `this.value` を読むと旧値が返る。
そのため `Tile`/`Ghost`/`Laser` のリスナはすべて引数 `(prev, cur)` の `cur` を使っている。
新しくリスナを書く時もこの流儀に従うこと。

また `--g.remainSteps.value` のような複合代入は getter → setter の順で動くため通知は 1 回で正しく動く。

## 6. グローバル状態

| シンボル | 定義 | 用途 |
|---|---|---|
| `app` | [main.ts:4](../src/main.ts#L4) | `Application`。`app.stage` / `app.screen` / `app.renderer` を各所が直接触る |
| `key` | [main.ts:10](../src/main.ts#L10) | 押下中のキー集合。`pressed` は「何か押されている」 |
| `mouse` | [main.ts:5](../src/main.ts#L5) | 現状**未使用**（将来のマウス操作用） |
| `startTime` | [main.ts:15](../src/main.ts#L15) | `Fin` のプレイ時間計算にのみ使用 |

`app` は `main.ts` の即時関数内で代入されるため、**モジュールのトップレベルで `app` を参照してはいけない**
（`undefined` になる）。必ずコンストラクタ以降で触る。

## 7. ビルドと配信

- ステージデータは [stages/index.ts](../src/game/stage/stages/index.ts) の明示 import。
  開発ビルド（`import.meta.env.DEV`）では [stage.ts](../src/game/stage/stage.ts) の
  モジュール読み込み時に `validateAllStages()` が走る。
- `vite.config.ts` の `build.outDir` が `docs`、`base` が `./`。
  → `bun run build` すると `docs/` が GitHub Pages 用の成果物として更新される。
- `src-tauri/tauri.conf.json` の `frontendDist` も `../docs` を指しており、Web とデスクトップで同じ出力を共有する。
- Tauri 側の Rust コード（`greet` コマンド）は**テンプレートのまま未使用**。

## 8. 依存

| パッケージ | バージョン | 用途 |
|---|---|---|
| `pixi.js` | ^8.18.1 | 描画のすべて |
| `@tauri-apps/api` / `plugin-opener` | ^2 | デスクトップ殻（現状フロントからは未呼び出し） |
| `vite` / `typescript` | ^6.4 / ~5.6 | ビルド |

外部のゲームエンジン・状態管理・テストフレームワークは入っていない。
