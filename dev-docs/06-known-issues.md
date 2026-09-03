# 06. 既知の問題と技術的負債

> 対象: `main` ブランチ ea470f5 時点。15 時間のゲームジャム制作物としての残骸を含む。
> 各項目に ID を振っているので、コミットメッセージや他の文書から `#L-1` の形で参照すること。
> 修正したらこの表の状態を **済** に更新する。

## 優先度の凡例

| 記号 | 意味 |
|---|---|
| 🔴 | 挙動が壊れている。触る前に直したほうがよい |
| 🟡 | 今は表面化していないが、機能追加で必ず踏む地雷 |
| ⚪ | 動作に影響しない負債・掃除対象 |

---

## 🔴 バグ

### L-1 — `isJammed` がレーザーをまったく見ていない
**場所**: [field.ts:110-127](../src/game/stage/field.ts#L110-L127)

```ts
let lx = x; let ly = y;
switch(d) { /* lx, ly を ±0.5 する */ }
const l = this.lasers.get(`${x},${y}`);   // ← lx, ly ではなく x, y を使っている
```

タイル座標は整数、レーザーのキーは半整数なので `l` は**常に `undefined`**。
結果、`isJammed` は「隣に `Unused` タイルがあるか」だけで判定しており、
**レーザーで完全に包囲されていても詰みと認識しない。**

**影響**: プレイヤーは詰んでいるのに操作可能なまま。レーザーに突っ込むか `R` を押すしかない。

**修正**: キーを `` `${lx},${ly}` `` に直すだけ。
ただし `lx`/`ly` が使われていないことを `noUnusedLocals: false` が隠していた点に注意。

> ⚠️ **修正すると既存ステージの挙動が変わりうる。** 直したら全 7 ステージを通しでプレイして確認すること。

### F-1 — フィールドのセンタリングが `aabb.min` を無視している
**場所**: [field.ts:62-65](../src/game/stage/field.ts#L62-L65)

```ts
const w = (this.aabb.max.x - this.aabb.min.x + 1) * this.gap;
this.offset.x = (1280 - w + this.gap) * 0.5;
```

`offset` の計算に `aabb.min` が入っていないため、フィールドの中心は
`640 + aabb.min.x * gap` になる。**左端の列や上端の行が空だと、その分だけ右下にずれる。**

**影響**: 現状の 7 ステージはすべて `min = 0` なので表面化していない。
新規ステージで左詰め・上詰めを崩した瞬間に崩れる。

**修正**: `this.offset.x = (1280 - w + this.gap) * 0.5 - this.aabb.min.x * this.gap;`（y も同様）

### V-1 — タイルが 1 枚だけのステージで 0 除算
**場所**: [stageview.ts:38](../src/game/stage/stageview.ts#L38)

`m = manhattan.max - manhattan.min` が 0 になり `20 / m` が `Infinity` → `pivot.y` が `NaN`。
**影響**: そんなステージを作らなければ起きない。ガードを入れておくのが安全。

---

## 🟡 機能追加で必ず踏む地雷

### G-1 — ゴーストを 2 体以上にできない
**場所**: [stage.ts:26](../src/game/stage/stage.ts#L26), [stage.ts:121-126](../src/game/stage/stage.ts#L121-L126)

`maxGhosts = 1` を単に増やしても動かない。理由:

- 前ループから生き残ったゴーストは**消費済みの状態**のまま次ループへ持ち越される
  （`command` が空、`remainSteps` が 0、`grid` が終点座標）。
- `Ghost` に「初期状態へ戻す」処理が無い。`reset()` で作り直されるのは新しい 1 体だけ。

**必要な修正**: `Ghost` に生成時の `command` / `remainSteps` / 開始座標を保持させ、
ループ開始時に巻き戻す `rewind()` を用意する。あわせて
[stagelogic.ts:32-41](../src/game/stage/stagelogic.ts#L32-L41) の初期配置も全ゴーストに対して正しく動くか確認する。

**これは `plus` で最も価値の高い拡張のひとつ**（[07-roadmap.md](07-roadmap.md) フェーズ 4）。

### O-1 — ステージの順序がファイル名の辞書順
**場所**: [stage.ts:13](../src/game/stage/stage.ts#L13)

`import.meta.glob` + `Object.values` のため、`stage10.json` を作ると
`stage1.json` の次（＝ステージ 2 の位置）に割り込む。
詳細と回避策は [03-stage-format.md のロード順の罠](03-stage-format.md#41-ロード順の罠)。

### J-1 — ステージ JSON が 10KB を超えるとビルド版だけ壊れる
**場所**: [stage.ts:42](../src/game/stage/stage.ts#L42) で `currentData.tiles` と読んでいる

Vite の既定 `json.stringify: 'auto'` は 10KB 超の JSON を `JSON.parse` 化し、
**名前付きエクスポートを生成しなくなる**。そうなると `currentData.tiles` が `undefined` になる。
`dev` では気付きにくく、`build` 後だけ壊れる。

**恒久対策**: `stages[stage].default ?? stages[stage]` と書くか、明示的な import に切り替える
（[07-roadmap.md](07-roadmap.md) フェーズ 1 で同時に解消される）。

### X-1 — ゴーストがゴールに乗るとクリア扱いになる
**場所**: [stagelogic.ts:135-138](../src/game/stage/stagelogic.ts#L135-L138)

`next()` の `if(t instanceof EndTile)` に「プレイヤーであること」の判定が無い。
ゴーストの経路は必ず前ループのプレイヤーの軌跡（＝ゴールを含まない）なので**現状は到達不能**だが、
ワープ・分岐・複数ゴーストなどを足した瞬間に顕在化する。

**修正**: `if(e instanceof Player && t instanceof EndTile)` にする。

### X-2 — ゴーストの移動先を検証していない
**場所**: [stagelogic.ts:88-93](../src/game/stage/stagelogic.ts#L88-L93), [:128](../src/game/stage/stagelogic.ts#L128)

ゴーストは `getAdjacentTile()` の結果が `null` でも `Used` でも構わず `next()` に渡され、
`getTile(...)!` の非 null アサーションで参照される。
**フィールド外に出る経路が生まれた瞬間に例外で落ちる。**

### E-1 — `grid` と `start` がオブジェクトを共有している
**場所**: [player.ts:19](../src/game/stage/player.ts#L19), [ghost.ts:24](../src/game/stage/ghost.ts#L24)

```ts
this.grid = this.start = start;   // 同じオブジェクトへの 2 本の参照
```

移動すると `start` も一緒に書き換わる。`Ghost` も `player.grid` を**コピーせず**参照している。
現状 `start` を読むコードが無く、古い `Player` は即捨てられるので実害は無いが、
「開始位置に戻す」「ゴーストを巻き戻す」といった機能（G-1）を入れる前に必ず直すこと。

**修正**: `this.grid = { ...start }; this.start = { ...start };`

### C-1 — `Scene` に入退場フックが無い
**場所**: [scene.ts](../src/game/scene.ts), [game.ts:19-25](../src/game/game.ts#L19-L25)

`Fin` は `time === null` を初期化フラグに使っているため（[fin.ts:17](../src/game/fin/fin.ts#L17)）、
**2 回目に入ると初期化されない**。ステージセレクトやポーズ画面など、
再入場するシーンを足すときは自前で `enter()` を用意する必要がある。

### S-1 — `Stage.reset()` の `container.destroy()` が子を破棄していない
**場所**: [stage.ts:69](../src/game/stage/stage.ts#L69)

`destroy()` を引数なしで呼んでいるため、子の `Graphics` / `GraphicsContext` は破棄されない。
ループのたびにタイル数ぶんの `Graphics` を作り直しているので、
**長時間プレイで GPU リソースが積み上がる可能性がある**（要計測）。

**確認方法**: `bun run dev` で 1 ステージを 50 回リセットし、
`app.renderer.textureGC` とブラウザのメモリを観察する。
問題があれば `destroy({ children: true, texture: true })` にする。

### R-1 — `R` リセットの退場アニメだけ短い
**場所**: [stagelogic.ts:102-105](../src/game/stage/stagelogic.ts#L102-L105)

他の終了経路は `this.time = 70` を設定するが、`R` は設定しないので `time` は 50 のまま。
**修正**: `this.time = 70;` を足すだけ。

### I-1 — WASD が押されていると同フレームで `R` が評価されない
**場所**: [stagelogic.ts:73-106](../src/game/stage/stagelogic.ts#L73-L106)

`key.keys` の走査で WASD が先に見つかると `break` するため、`R` の分岐に到達しない。
移動キーを押しながら `R` を押すと反応しないことがある。

---

## ⚪ 掃除対象（動作に影響しない）

| ID | 内容 | 場所 |
|---|---|---|
| Z-1 | `styles.css` が Tauri テンプレートの残骸。`index.html` から読み込まれているが、対象要素が 1 つも存在しない | [src/styles.css](../src/styles.css), [index.html:5](../index.html#L5) |
| Z-2 | `Node` クラスが未使用（`Particle` を継承しただけの残骸） | [field.ts:306-317](../src/game/stage/field.ts#L306-L317) |
| Z-3 | `addTile()` の中身が空の `if` が 4 つ残っている | [field.ts:67-78](../src/game/stage/field.ts#L67-L78) |
| Z-4 | `Laser.update()` が空 | [objects.ts:53-55](../src/game/stage/objects.ts#L53-L55) |
| Z-5 | `mouse` は更新されているが誰も読んでいない | [main.ts:5](../src/main.ts#L5) |
| Z-6 | `hasAdjacentTile()` / `gridToWorld()` が未使用（`StageView` は同じ計算を手書きしている） | [field.ts:100](../src/game/stage/field.ts#L100), [field.ts:140](../src/game/stage/field.ts#L140) |
| Z-7 | `Entity.start` は代入されるだけで読まれない | [entity.ts:9-12](../src/game/stage/entity.ts#L9-L12) |
| Z-8 | `console.log(this.currentData)` が残っている | [stage.ts:42](../src/game/stage/stage.ts#L42) |
| Z-9 | Text のスタイル定義が `Title` / `Fin` / `UI` に 3 回コピペされている | [title.ts:21-31](../src/game/title/title.ts#L21-L31) ほか |
| Z-10 | `Player` と `Ghost` の `update()` / `move()` / `target` / `gap` / `size` がほぼ完全に重複 | [player.ts:37-50](../src/game/stage/player.ts#L37-L50), [ghost.ts:86-98](../src/game/stage/ghost.ts#L86-L98) |
| Z-11 | ステージデータが `any`。`currentData.tiles` の型安全性がゼロ | [stage.ts:18](../src/game/stage/stage.ts#L18) |
| Z-12 | Tauri 側の `greet` コマンドがテンプレートのまま未使用 | [src-tauri/src/lib.rs](../src-tauri/src/lib.rs) |
| Z-13 | 補間に `Ticker.deltaTime` を掛けていないため、動きがフレームレート依存 | 全体（[05-visual-style.md](05-visual-style.md#51-補間は一次遅れのみ)） |
| Z-14 | `noUnusedLocals` / `noUnusedParameters` が `false`。L-1 を隠していた原因 | [tsconfig.json](../tsconfig.json) |
| Z-15 | 自動テストが存在しない。ルール変更の回帰を検出できない | — |

---

## 触るときの注意

- **L-1 と F-1 を直すとステージの解き味が変わる可能性がある。** 修正後は全ステージを通しプレイする。
- **`docs/` を手で編集しない。** `bun run build` の出力であり、GitHub Pages の配信元。
- `main` ブランチは公開済みビルドと対応しているので、修正は `plus` で行う。
