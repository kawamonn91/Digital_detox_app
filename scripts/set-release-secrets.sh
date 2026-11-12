#!/usr/bin/env bash
# CD（.github/workflows/release.yml）が使う GitHub Secrets を、手元の鍵から登録する。
# 値はコマンドの引数に出さず、標準入力から gh に渡す。
#
# 使い方（リポジトリの直下で）: bash scripts/set-release-secrets.sh
# 要るもの: DebtRunApp/android/app/ の keystore.properties と、そこに書いた署名鍵（どちらも Git の対象外）、gh のログイン
set -euo pipefail

repo="${REPO:-kawamonn91/Digital_detox_app}"
cd "$(dirname "$0")/../DebtRunApp/android/app"

prop() { grep "^$2=" "$1" | head -n 1 | cut -d= -f2- | tr -d '\r\n'; }

[ -f keystore.properties ] || { echo "DebtRunApp/android/app/keystore.properties がありません" >&2; exit 1; }
store_file="$(prop keystore.properties storeFile)"
[ -f "$store_file" ] || { echo "署名鍵 $store_file がありません" >&2; exit 1; }

base64 -w0 "$store_file" | gh secret set RELEASE_KEYSTORE_BASE64 -R "$repo"
prop keystore.properties storePassword | gh secret set RELEASE_KEYSTORE_PASSWORD -R "$repo"
prop keystore.properties keyAlias | gh secret set RELEASE_KEY_ALIAS -R "$repo"
prop keystore.properties keyPassword | gh secret set RELEASE_KEY_PASSWORD -R "$repo"

gh secret list -R "$repo"
