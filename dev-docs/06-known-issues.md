# 06. 既知の問題と技術的負債

> 対象: `plus` ブランチ フェーズ 1 完了時点。
> 各項目に ID を振っているので、コミットメッセージや他の文書から `L-1` の形で参照すること。
> **修正したら末尾の「解決済み」節へ移すこと。**

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

---

## ⚪ 掃除対象（動作に影響しない）

| ID | 内容 | 場所 |
|---|---|---|
| Z-4 | ~~`Laser.update()` が空~~ **won't fix**。毎フレーム更新するギミックの拡張点として意図的に残している | [objects.ts](../src/game/stage/objects.ts) |
| Z-5 | `mouse` は更新されているが誰も読んでいない | [main.ts:5](../src/main.ts#L5) |
| Z-6 | `hasAdjacentTile()` が未使用（`gridToWorld()` はフェーズ 0 で `StageView` から使うようにした）。一方通行タイル等で使う想定なので残している | [field.ts](../src/game/stage/field.ts) |
| Z-7 | `Entity.start` は代入されるだけで読まれない | [entity.ts:9-12](../src/game/stage/entity.ts#L9-L12) |
| Z-10 | `Player` と `Ghost` の `update()` / `move()` / `target` / `gap` / `size` がほぼ完全に重複 | [player.ts:37-50](../src/game/stage/player.ts#L37-L50), [ghost.ts:86-98](../src/game/stage/ghost.ts#L86-L98) |
| Z-12 | Tauri 側の `greet` コマンドがテンプレートのまま未使用 | [src-tauri/src/lib.rs](../src-tauri/src/lib.rs) |
| Z-13 | 補間に `Ticker.deltaTime` を掛けていないため、動きがフレームレート依存 | 全体（[05-visual-style.md](05-visual-style.md#51-補間は一次遅れのみ)） |
| Z-14 | `noUnusedLocals` / `noUnusedParameters` が `false`。L-1 を隠していた原因 | [tsconfig.json](../tsconfig.json) |
| Z-15 | ルールの回帰テストが無い。`bun run verify` はデータ検証のみで、「実際に解けるか」は見ていない（フェーズ 2.5 で解消予定） | [scripts/verify-stages.ts](../scripts/verify-stages.ts) |

---

## 触るときの注意

- **L-1 と F-1 を直すとステージの解き味が変わる可能性がある。**
  フェーズ 2.5 のソルバを先に用意してから直すこと（[07-roadmap.md](07-roadmap.md)）。
- **`docs/` を手で編集しない。** `bun run build` の出力であり、GitHub Pages の配信元。
- `main` ブランチは公開済みビルドと対応しているので、修正は `plus` で行う。

---

## ✅ 解決済み

| ID | 内容 | 解決した方法 | フェーズ |
|---|---|---|---|
| Z-1 | `styles.css` が Tauri テンプレートの残骸 | ファイルと `<link>` を削除 | 0 |
| Z-2 | `Node` クラスが未使用 | 削除 | 0 |
| Z-3 | `addTile()` に空の `if` が 4 つ | 削除 | 0 |
| Z-8 | `console.log(this.currentData)` が残っている | 削除 | 0 |
| R-1 | `R` リセットの退場アニメだけ短い | `this.time = 70;` を設定 | 0 |
| I-1 | WASD 押下中に `R` が効かない | `R` を WASD 走査の前に独立して判定 | 0 |
| O-1 | ステージ順がファイル名の辞書順 | `stages/index.ts` の明示 import 配列に変更 | 1 |
| J-1 | ステージ JSON が 10KB 超でビルド版だけ壊れる | 名前付きエクスポート依存をやめ default import に | 1 |
| Z-9 | Text スタイルの 3 重コピペ | `src/common/text.ts` の `bodyTextStyle` に集約 | 1 |
| Z-11 | ステージデータが `any` | `StageData` 型と `validateStage()` を追加 | 1 |
| — | `S` が無いとクラッシュする | `(0,0)` フォールバック + `bun run verify` の検査 | 1 |
