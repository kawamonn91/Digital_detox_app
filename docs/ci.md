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

## CD（`.github/workflows/release.yml`）

`v` で始まるタグ（`v1.0.3` など）を push すると、ジョブ `release` が次を行う。

1. タグが `DebtRunApp/android/app/build.gradle` の `versionName` と合っているか確かめる（`v` + versionName）
2. `npm ci`・型チェック・単体テスト
3. GitHub Secrets から署名鍵を書き出し、`./gradlew :app:assembleRelease`（4 つの ABI 分のネイティブコードもビルドするので時間がかかる）
4. `apksigner` で署名を確かめる。証明書の SHA-256 がストアに出している版と同じか（ワークフローの `EXPECTED_CERT_SHA256`）も見る
5. `debtrun-<版>.apk` と `SHA256SUMS` を GitHub Releases に置く

手で動かす（`gh workflow run release.yml`）と、4 までを行ってリリースは作らない（CD の動作確認用）。

### GitHub Secrets

| 名前 | 中身 |
| --- | --- |
| `RELEASE_KEYSTORE_BASE64` | 署名鍵（`DebtRunApp/android/app/debtrun.jks`）を base64 にしたもの |
| `RELEASE_KEYSTORE_PASSWORD` | `DebtRunApp/android/app/keystore.properties` の `storePassword` |
| `RELEASE_KEY_ALIAS` | `keyAlias` |
| `RELEASE_KEY_PASSWORD` | `keyPassword` |

登録（し直し）は `bash scripts/set-release-secrets.sh`。手元のファイルから読み、値をコマンドの引数に出さずに標準入力から `gh secret set` に渡す。

### 新しい版を出す

1. 作業ブランチで `DebtRunApp/android/app/build.gradle` の `versionCode` を 1 つ上げ、`versionName` を変える（T-tech Store は同じ versionCode を受け付けない）
2. PR を作り、自動マージで main に入るのを待つ
3. main でタグを付けて push し、`release` が終わるのを待つ

   ```bash
   git switch main && git pull --ff-only
   git tag v1.0.3 && git push origin v1.0.3
   gh run watch "$(gh run list --workflow release.yml --limit 1 --json databaseId -q '.[0].databaseId')"
   ```

4. Releases の APK を手元に取り、appstore の `publish-app.mjs` で T-tech Store に出す（本番の鍵は raspi1 から環境変数にだけ読む。`~/.claude/notes/infra.md` の「T-tech Store のスクリプトを本番に向けて動かす」）

   ```bash
   gh release download v1.0.3 -R kawamonn91/Digital_detox_app -p '*.apk' -D "$SP"
   cd /c/dev/appstore/web
   while IFS='=' read -r k v; do [ -n "$k" ] && export "$k=$v"; done < <(ssh -o BatchMode=yes raspi1 'grep -E "^(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|R2_[A-Z_]+)=" /home/pi/.config/ttech-store/env')
   node scripts/publish-app.mjs --apk "$SP/debtrun-1.0.3.apk" --notes "…" --publish
   ```
