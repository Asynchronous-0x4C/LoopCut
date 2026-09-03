# 06. 既知の問題と技術的負債

> 対象: `plus` ブランチ フェーズ 3 完了時点。
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

## 🟡 機能追加で必ず踏む地雷

### G-1 — ゴーストを 2 体以上にできない
**場所**: [stagedata.ts](../src/game/stage/stagedata.ts) の `MAX_GHOSTS`、`Stage.reset()`、[solver.ts](../src/game/stage/solver.ts) の `Sim.build()`

`MAX_GHOSTS = 1` を単に増やしても動かない。理由:

- 前ループから生き残ったゴーストは**消費済みの状態**のまま次ループへ持ち越される
  （`command` が空、`remainSteps` が 0、`grid` が終点座標）。
- `Ghost` に「初期状態へ戻す」処理が無い。`reset()` で作り直されるのは新しい 1 体だけ。

**必要な修正**: `Ghost` に生成時の `command` / `remainSteps` / 開始座標を保持させ、
ループ開始時に巻き戻す `rewind()` を用意する。あわせて `StageLogic` のコンストラクタの
初期配置が全ゴーストに対して正しく動くか確認する。
`MAX_GHOSTS` はゲーム本体とソルバの共通定数なので、`bun run verify` がそのまま検証してくれる。

**これは `plus` で最も価値の高い拡張のひとつ**（[07-roadmap.md](07-roadmap.md) フェーズ 4）。

### C-1 — `Scene` に入退場フックが無い
**場所**: [scene.ts](../src/game/scene.ts), [game.ts](../src/game/game.ts) の `setScene()`

`Fin` は `time === null` を初期化フラグに使っているため（[fin.ts](../src/game/fin/fin.ts)）、
**2 回目に入ると初期化されない**。ステージセレクトやポーズ画面など、
再入場するシーンを足すときは自前で `enter()` を用意する必要がある。

---

## ⚪ 掃除対象（動作に影響しない）

| ID | 内容 | 場所 |
|---|---|---|
| Z-4 | ~~`Laser.update()` が空~~ **won't fix**。毎フレーム更新するギミックの拡張点として意図的に残している | [objects.ts](../src/game/stage/objects.ts) |
| Z-5 | `mouse` は更新されているが誰も読んでいない | [main.ts](../src/main.ts) |
| Z-6 | `hasAdjacentTile()` が未使用。一方通行タイル等で使う想定なので残している | [field.ts](../src/game/stage/field.ts) |
| Z-12 | Tauri 側の `greet` コマンドがテンプレートのまま未使用 | [src-tauri/src/lib.rs](../src-tauri/src/lib.rs) |
| Z-14 | `noUnusedParameters` は `false` のまま。`update(t: Ticker)` など未使用引数が多くノイズになるため（`noUnusedLocals` は有効化済み） | [tsconfig.json](../tsconfig.json) |

---

## 触るときの注意

- **ルールに触ったら必ず `bun run verify`。** 最小ループ数が変わっていたら、それは仕様変更。
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
| X-1 | ゴーストがゴールに乗るとクリア扱い | `next()` のゴール判定に `e instanceof Player` を追加 | 2 |
| X-2 | ゴーストの移動先を検証していない | 移動先タイルが無ければゴーストを動かさず `console.error` | 2 |
| E-1 | `grid` と `start` がオブジェクト共有 | `Entity` のコンストラクタでコピーする。`start` 自体は削除 | 2 |
| Z-7 | `Entity.start` が読まれない | 削除 | 2 |
| Z-10 | `Player` と `Ghost` の重複 | `Entity` に `move()` / `update()` / `bump()` / `target` / `size` を集約 | 2 |
| Z-15 | ルールの回帰テストが無い | `bun run verify` が**ゲーム本体と同じ `StageLogic`** で全ステージを解いて検証 | 2.5 |
| L-1 | `isJammed` がレーザーを見ていない | `existsLaser()` を使うよう書き直し。全ステージの最小ループ数は不変 | 3 |
| F-1 | センタリングが `aabb.min` を無視 | `offset` から `aabb.min * gap` を引く | 3 |
| V-1 | タイル 1 枚のステージで 0 除算 | `manhattan` の幅を `Math.max(1, …)` で下限を設ける | 3 |
| S-1 | `destroy()` が子を破棄していない | 古いツリーの破棄を `reset()` の最後に移し `{ children: true }` に。UI のドットテクスチャも使い回すよう変更 | 3 |
| Z-13 | 補間がフレームレート依存 | `damp()`（[interpolate.ts](../src/common/interpolate.ts)）を全補間に適用 | 3 |
