# CLAUDE.md — LoopCut (plus)

このファイルは AI エージェントがこのリポジトリで作業する際の入口です。
**作業前に必ず [dev-docs/README.md](dev-docs/README.md) の該当章を読んでから着手してください。**

## プロジェクト概要

LoopCut は PixiJS v8 + TypeScript + Vite で作られたグリッドベースの一筆書きパズルゲーム。
15 時間のゲームジャムで制作した初版（`main` ブランチ）を、`plus` ブランチでブラッシュアップ中。

- 論理解像度は固定 1280x720。CSS/JS でウィンドウにフィットさせる（[src/main.ts:17-23](src/main.ts#L17-L23)）。
- 描画はすべて PixiJS の `Graphics` によるベクター描画。画像アセットは使わない（ロゴの SVG のみ例外）。
- Tauri v2 のデスクトップ殻が同梱されているが、本番配信は GitHub Pages（Web）。

## ディレクトリの約束

| パス | 役割 | 手で編集するか |
|---|---|---|
| `src/` | ゲーム本体のソース | **する** |
| `src/game/stage/stages/*.json` | ステージ定義データ | **する** |
| `dev-docs/` | 開発者・AI 向けドキュメント | **する** |
| `docs/` | **Vite のビルド出力**（GitHub Pages の配信元） | **絶対にしない** |
| `src-tauri/` | Tauri デスクトップ殻。ゲームロジックは一切含まない | 基本しない |
| `img/` | README 用スクリーンショット | しない |

> `docs/` は `vite.config.ts` の `build.outDir` であり、`bun run build` で丸ごと上書きされます。
> ドキュメントは必ず `dev-docs/` に置いてください。

## コマンド

```bash
bun install          # 依存導入（npm/pnpm でも可）
bun run dev          # 開発サーバ http://localhost:1420
./node_modules/.bin/tsc --noEmit   # 型チェックのみ（変更後は必ず通すこと）
bun run build        # tsc + vite build → docs/ を更新（配信物を更新する時だけ）
bun run tauri dev    # デスクトップ版
```

自動テストは存在しない。**変更後は最低限 `tsc --noEmit` を通し、`bun run dev` で該当ステージの挙動を確認すること。**

## 作業別の参照先

| やりたいこと | 読むべき文書 |
|---|---|
| 全体像・どのファイルが何をしているか | [dev-docs/01-architecture.md](dev-docs/01-architecture.md) |
| ゲームルールの正確な仕様（ゴースト・レーザー等） | [dev-docs/02-game-rules.md](dev-docs/02-game-rules.md) |
| **ステージを追加する** | [dev-docs/03-stage-format.md](dev-docs/03-stage-format.md) |
| **新しいギミック / タイル / シーンを追加する** | [dev-docs/04-recipes.md](dev-docs/04-recipes.md) |
| 見た目を既存に合わせる（色・影・アニメ） | [dev-docs/05-visual-style.md](dev-docs/05-visual-style.md) |
| 既知のバグ・触ると危ない箇所 | [dev-docs/06-known-issues.md](dev-docs/06-known-issues.md) |
| リファクタの順序と方針 | [dev-docs/07-roadmap.md](dev-docs/07-roadmap.md) |

## コーディング規約（現行コードの流儀）

- インデント 2 スペース、セミコロンあり、ダブルクォート優先。
- クラスベース。`update(t: Ticker)` を持つオブジェクトをツリー状に呼び出す。
- 補間は `v += (target - v) * 係数` の一次遅れで統一（イージング関数は使わない）。
- 色は文字列リテラル（`"#646464"` など）。パレットは [dev-docs/05-visual-style.md](dev-docs/05-visual-style.md) を参照。
- `any` は既存コードに残っているが、**新規コードでは使わない**。特にステージデータは型を付ける。

## 変更時の必須確認

1. `tsc --noEmit` が通る。
2. `docs/` を編集していない。
3. ステージを追加した場合、**ロード順の罠**（[03-stage-format.md](dev-docs/03-stage-format.md#41-ロード順の罠)）を踏んでいない。
4. ルール・データ形式を変えた場合、`dev-docs/` の該当箇所も同じコミットで更新する。
