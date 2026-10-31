# CI と自動マージ

## CI（`.github/workflows/ci.yml`）

PR（main 向け）と main への push のたびに、GitHub Actions のジョブ `build` が次を行う。

- `npm ci`（依存関係のクリーンインストール）
- `npx tsc --noEmit`（TypeScript の型チェック）
- `npm test -- --watchAll=false`（Jest による単体テストの実行）

Node.js はバージョン 22（package.json の engines に合わせた環境）。アクションは改ざん防止のためコミットの SHA で固定している（更新するときは SHA ごと書き換える）。

## main の保護と自動マージ

- main は `build` が通らないとマージできない（ブランチの保護。管理者は対象外にしてあり、緊急時は直接 push できる）
- リポジトリで自動マージを有効にし、マージしたブランチは自動で消える
- PR を作ったら、自動マージを予約する。`build` が通った時点でマージされ、失敗したらマージされない

```bash
gh pr create --base main --title "…" --body "…"
gh pr merge --auto --merge   # build が通ったらマージする（マージコミット）
```

CI が失敗したら、同じブランチに直して push すれば、もう一度 CI が走り、通ればそのままマージされる。
