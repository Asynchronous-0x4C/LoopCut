# 07. 整理ロードマップ（`plus` ブランチ）

**目的**: 「ステージ / ギミック / 画面の追加を AI 主導で安全に回せる」状態にすること。
グラフィックは完成しているので、**触るのはロジックとデータ構造だけ**。

## 進め方の原則

- **1 フェーズ = 1 まとまりのコミット**。フェーズをまたいだ変更を混ぜない。
- 各フェーズの完了条件を満たすまで次へ進まない。
- **ルールやデータ形式を変えたら、同じコミットで `dev-docs/` を更新する。**
- 変更のたびに `./node_modules/.bin/tsc --noEmit` を通す。
- `docs/` は最後にまとめて `bun run build` で更新する。作業中は触らない。

## 依存関係と実施順

```mermaid
flowchart LR
  P0[フェーズ0<br/>掃除] --> P1[フェーズ1<br/>データ層の型付け]
  P1 --> P2[フェーズ2<br/>ロジック分離]
  P2 --> P25[フェーズ2.5<br/>ソルバ/検証]
  P25 --> P3[フェーズ3<br/>バグ修正]
  P3 --> P4[フェーズ4<br/>機能追加]
  P1 --> S[ステージ追加<br/>いつでも可]
```

**ステージ追加だけはフェーズ 1 が終われば独立して進められる。**
ギミック追加はフェーズ 2 の後にすると劇的に楽になる。

> **実施順の変更（2026-09-03）**: 当初フェーズ 3 の一項目だった「ヘッドレスソルバ」を
> **フェーズ 2.5 として独立させ、バグ修正より前に持ってきた**。
> 挙動を変える修正（L-1 / F-1）を入れる前に自動検証を用意しておかないと、
> 全ステージの手動通しプレイでしか回帰を検出できないため。
> ソルバはフェーズ 2 でロジックが描画から分離されて初めて安く作れるので、
> 2 → 2.5 → 3 の順が最も効率がよい。

---

## フェーズ 0 — 掃除 ✅ 完了

**目的**: ノイズを消して、以降の差分を読みやすくする。挙動はほぼ変えない。

- [x] `CLAUDE.md` と `dev-docs/` を追加する
- [x] `console.log(this.currentData)` を消す（Z-8 解消）
- [x] `src/styles.css` を削除し、`index.html` の `<link>` も消す（Z-1 解消）
- [x] `Node` クラスと `addTile()` の空 `if` 4 つを削除（Z-2 / Z-3 解消）
- [x] `gridToWorld()` を `StageView` から実際に使うよう置き換える（Z-6 の半分を解消）
- [x] `R` リセットに `this.time = 70;` を足す（R-1 解消）
- [x] `R` の判定を WASD の走査から独立させる（I-1 解消）
- [x] `loop()` の未使用ローカル `input` を削除

**判断メモ**:

- **`Laser.update()` は削除せず残した**（Z-4 は「解消しない」で確定）。
  [04-recipes.md レシピ B](04-recipes.md#レシピ-b-新しいオブジェクトギミックを追加する) で
  毎フレーム更新するギミックの拡張点として使うため。意図が伝わるようコメントを付けた。
- **`hasAdjacentTile()` も残した。** 将来の一方通行タイル等で使う。
- **`noUnusedLocals` の有効化はフェーズ 3 に移した。**
  有効にすると [L-1](06-known-issues.md) の未使用 `lx`/`ly` が即エラーになり、
  「挙動を変えない」というフェーズ 0 の前提を破るため。L-1 を直すのと同じコミットで入れる。

**完了条件**: `tsc --noEmit` が通る ✅ / `vite build` が通る ✅

---

## フェーズ 1 — データ層の型付けと明示化 ✅ 完了

**目的**: **ステージを AI が安全に追加できる状態を作る。**

- [x] [src/game/stage/stagedata.ts](../src/game/stage/stagedata.ts) にステージ JSON の型と定数を定義
      （`StageData` / `DEFAULT_STEPS` / `MAX_COLUMNS` / `MAX_ROWS` / `OBJECT_TYPES` / `PERMANENT_WALL_ID`）
- [x] [src/game/stage/stages/index.ts](../src/game/stage/stages/index.ts) を作り、
      `import.meta.glob` を**明示的な import の配列**に置き換え（O-1 / J-1 解消）
- [x] `stage.ts` の `currentData` に `StageData|null` の型を付け、`any` を排除（Z-11 解消）
- [x] `S` が無い場合に落ちる問題を解消（`(0,0)` フォールバック + エラーログ）
- [x] [src/game/stage/validate.ts](../src/game/stage/validate.ts) に `validateStage()` を追加
- [x] `bun run verify` で全ステージを検証できるようにした（[scripts/verify-stages.ts](../scripts/verify-stages.ts)）
- [x] 開発サーバ起動時にも同じ検証が走るようにした（`import.meta.env.DEV`）
- [x] Text スタイルを [src/common/text.ts](../src/common/text.ts) の `bodyTextStyle` に共通化（Z-9 解消）

**判断メモ**:

- **`StageObjectData.type` は `string` のままにした。**
  JSON は外部データなので `"laser"` のリテラル型で受けると型が合わず、
  結局キャストが必要になる。境界で `validateStage()` が絞り込む方針にした。
- **恒久的に消せないレーザーの表現として `id: "-"` を導入した**（`PERMANENT_WALL_ID`）。
  これが無いと「対応スイッチが無いレーザー」を検証時に typo と区別できない。
- `src/vite-env.d.ts` を追加して `import.meta.env` に型を付けた。

**完了条件**: `bun run verify` が全ステージ OK ✅ / `tsc --noEmit` が通る ✅ / `vite build` が通る ✅

> **この時点で「ステージを 10 個追加して」を AI に任せられる。**
> ただし「本当に解けるか」はまだ機械では検証できない（フェーズ 2.5 で解消）。

---

## フェーズ 2 — ロジックの分離（2〜3 日 / リスク中）

**目的**: **ギミックを追加できる状態を作る。** タイルとオブジェクトの振る舞いを多態にする。

- [ ] `Tile` に `canEnter()` / `enter()` を導入し、`state.value` の直接操作を 5 箇所から排除
      （[04-recipes.md レシピ A-1](04-recipes.md#a-1-まず基底-tile-に判定メソッドを生やす初回だけ)）
- [ ] `field.ts` (316 行) を分割する

```
src/game/stage/
  field.ts          … Field クラスのみ
  tiles/
    tile.ts         … Tile 基底 + TileState
    start.ts        … StartTile
    end.ts          … EndTile
    switch.ts       … SwitchTile
    index.ts        … 文字 → クラスのレジストリ
  objects/
    object.ts       … StageObject 基底
    laser.ts        … Laser
```

- [ ] 文字 → タイルの対応を `stage.ts` の `switch` からレジストリへ移す

```ts
// tiles/index.ts
export const tileRegistry: Record<string, (x: number, y: number) => Tile> = {
  'S': (x, y) => new StartTile(TileState.Unused, x, y),
  'G': (x, y) => new EndTile(TileState.Unused, x, y),
  '#': (x, y) => new Tile(TileState.Unused, x, y),
  '@': (x, y) => new Tile(TileState.Used, x, y),
};
```

  → **以降、新しいタイルの追加はこの表に 1 行足すだけになる。**
- [ ] オブジェクトも同様に `objectRegistry` にして `Stage.reset()` の `switch` を消す
- [ ] `Entity` に `target` / `gap` / `size` / `move()` / `update()` を集約し、
      `Player` と `Ghost` の重複を解消（[Z-10](06-known-issues.md)）
- [ ] `grid` / `start` のオブジェクト共有を解消（[E-1](06-known-issues.md)）
- [ ] `next()` のゴール判定に `e instanceof Player` を足す（[X-1](06-known-issues.md)）
- [ ] ゴーストの移動先を検証してから `next()` に渡す（[X-2](06-known-issues.md)）
- [ ] `Field.nextTurn()` を追加し、`StageLogic.loop()` から呼ぶ
      （[04-recipes.md レシピ B-2](04-recipes.md#b-2-ターン経過フックを用意する初回だけ)）
- [ ] `Stage` (150 行) の責務を分ける
  - `StageLoader` … `StageData` の解決と検証
  - `StageBuilder` … `StageData` → `Field` / `Player` / `Ghost` の構築
  - `Stage` … シーンとしての振る舞いとループ管理のみ

**完了条件**: 新しいタイル 1 種類を、`tiles/` にファイルを 1 つ足して
レジストリに 1 行書くだけで追加できる。全 7 ステージが従来どおり解ける。

---

## フェーズ 2.5 — ヘッドレスソルバと検証（リスク小 / 効果最大）

**目的**: **ステージが解けるかを自動で検証できるようにする。**
以降のバグ修正・リファクタ・ステージ量産すべての安全網になる。

- [ ] `StageData` を入力に、描画抜きでルールだけをシミュレートする層を作る
  - フェーズ 2 でルールが `Graphics` から切り離されていれば、**ゲーム本体と同じコードを再利用できる**
  - ルールを二重実装すると必ず食い違うので、**絶対にコピーして書かない**
- [ ] 全ループを探索して「解が存在するか」「何ループで解けるか」を返すソルバを書く
- [ ] `bun run verify` で全ステージを検証するスクリプトを用意する
- [ ] 既存 7 ステージが全部「解あり」になることを確認し、**期待ループ数を固定値として記録する**

**完了条件**: `bun run verify` が全ステージ緑。
以降、ルールを変えたらこのコマンドが即座に回帰を教えてくれる。

> **AI にステージを量産させる場合、このコマンドが受け入れ基準になる。**

---

## フェーズ 3 — バグ修正と堅牢化（1〜2 日 / リスク中）

**目的**: 公開できる品質にする。**ステージの解き味が変わるので、フェーズ 2.5 のソルバで必ず検証する。**

- [ ] `isJammed` のレーザー判定を修正（[L-1](06-known-issues.md)）
- [ ] `tsconfig.json` の `noUnusedLocals` を `true` にする（[Z-14](06-known-issues.md)。L-1 と同じコミットで）
  - `noUnusedParameters` は `false` のままにする。`update(t: Ticker)` など
    Pixi 側のシグネチャに合わせた未使用引数が多数あり、ノイズのほうが大きいため
- [ ] フィールドのセンタリングに `aabb.min` を反映（[F-1](06-known-issues.md)）
- [ ] `StageView` の 0 除算にガードを入れる（[V-1](06-known-issues.md)）
- [ ] `Stage.reset()` の `destroy()` を計測し、必要なら `{ children: true }` にする（[S-1](06-known-issues.md)）
- [ ] 補間に `Ticker.deltaTime` を反映させる（[Z-13](06-known-issues.md)）。
      係数は `1 - Math.pow(1 - k, t.deltaTime)` の形にすると見た目を保てる

**完了条件**: `bun run verify` が全ステージ緑。手動でも全クリアできる。

---

## フェーズ 4 — 機能追加（`plus` の本体）

フェーズ 2 / 2.5 / 3 が終わってから着手する。優先順は好みで入れ替えてよい。

- [ ] **複数ゴースト対応**（[G-1](06-known-issues.md)）。`Ghost.rewind()` を作り `maxGhosts` を実質的に有効化する。
      パズルの表現力が一段上がる、最も価値の高い拡張
- [ ] **`Scene` の入退場フック**（[C-1](06-known-issues.md)）。`enter()` / `exit()` を `Game.setScene()` から呼ぶ
- [ ] **ステージセレクト画面**（[04-recipes.md レシピ C](04-recipes.md#レシピ-c-新しい画面シーンを追加する)）
- [ ] **進捗の保存**（[04-recipes.md レシピ E](04-recipes.md#レシピ-e-進捗を保存する)）。README の注意書きを 1 つ消せる
- [ ] **効果音**（[04-recipes.md レシピ F](04-recipes.md#レシピ-f-効果音を足す)）
- [ ] **新ギミック**。案:
  - 複数回通れるタイル（[04-recipes.md レシピ A](04-recipes.md#レシピ-a-新しいタイルを追加する) がそのまま実装）
  - ターンで点滅するレーザー（[04-recipes.md レシピ B](04-recipes.md#レシピ-b-新しいオブジェクトギミックを追加する) がそのまま実装）
  - 一方通行タイル（進入方向を制限）
  - ゴーストの実体歩数を増減させるアイテム（「歩数の保存則」を崩す仕掛け）
  - トグルスイッチ（押すたびに ON/OFF が反転する。現状は押しっぱなし）
- [ ] **ステージ追加**（8 以降）。フェーズ 1 完了後ならいつでも並行して進められる

---

## AI に作業を任せるときの粒度

| 依頼の粒度 | 例 | 前提 |
|---|---|---|
| ◎ 任せやすい | 「ステージを 5 個追加。ギミックはレーザーとスイッチのみ、steps は 6〜10」 | フェーズ 1 完了 |
| ◎ 任せやすい | 「[04-recipes.md](04-recipes.md) のレシピ A に従って一方通行タイルを追加」 | フェーズ 2 完了 |
| ○ 任せられる | 「フェーズ 0 のチェックリストを全部やって」 | — |
| ○ 任せられる | 「[06-known-issues.md](06-known-issues.md) の L-1 を直して、全ステージが解けるか確認」 | フェーズ 3 |
| △ 相談しながら | 「フェーズ 2 の `field.ts` 分割」 | 設計判断が入る |
| ✕ 任せにくい | 「面白いステージを作って」 | 面白さの基準が言語化されていない |

**依頼するときは必ず「どの文書のどの節に従うか」を明示すること。**
これがこの文書群を用意した最大の理由。

---

## 公開の段取り

- GitHub Pages は `docs/` を配信元にしている（[vite.config.ts](../vite.config.ts) の `build.outDir`）。
- `plus` の内容を公開するには、次のどちらか:
  1. `plus` が安定した時点で `main` にマージし、`bun run build` して `docs/` を更新する（推奨）
  2. GitHub の Pages 設定で配信ブランチを `plus` に切り替える（先行公開したい場合）
- **`docs/` を含むコミットは差分が大きくノイズになる。** 公開のタイミングでまとめて 1 コミットにする。
- 公開前に [README.md](../README.md) の注意書き（「リロードで進捗リセット」など）を実態に合わせて更新する。
