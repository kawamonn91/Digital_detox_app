#!/usr/bin/env powershell
# setup.ps1
# DebtRun Android アプリ セットアップスクリプト
# 実行: powershell -ExecutionPolicy Bypass -File setup.ps1

$AppName = "DebtRunApp"
$ProjectDir = "G:\マイドライブ\app\Digital_detox_app\$AppName"
$SrcDir = "G:\マイドライブ\app\Digital_detox_app\rn_src"
$AndroidSrcDir = "G:\マイドライブ\app\Digital_detox_app\android_src"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  DebtRun Android App セットアップ" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Step 1: React Native プロジェクト初期化
Write-Host "`n[1/6] React Native プロジェクト初期化..." -ForegroundColor Yellow
Set-Location "G:\マイドライブ\app\Digital_detox_app"
npx @react-native-community/cli@latest init $AppName --template react-native-template-typescript --skip-install

# Step 2: 依存パッケージインストール
Write-Host "`n[2/6] 依存パッケージインストール..." -ForegroundColor Yellow
Set-Location $ProjectDir
Copy-Item "$SrcDir\package.json" -Destination ".\package.json" -Force
npm install

# Step 3: React Native ソースファイルをコピー
Write-Host "`n[3/6] ソースファイルをコピー..." -ForegroundColor Yellow
# src ディレクトリ構造を作成
New-Item -ItemType Directory -Force -Path ".\src\screens"
New-Item -ItemType Directory -Force -Path ".\src\services"
New-Item -ItemType Directory -Force -Path ".\src\store"
New-Item -ItemType Directory -Force -Path ".\src\components"

# ソースファイルをコピー
Copy-Item "$SrcDir\src\*" -Destination ".\src\" -Recurse -Force
Write-Host "  ✓ TypeScript ソースファイルをコピーしました" -ForegroundColor Green

# Step 4: Android ネイティブモジュールをコピー
Write-Host "`n[4/6] Android Kotlin モジュールをコピー..." -ForegroundColor Yellow
$KotlinDir = ".\android\app\src\main\java\com\debtrunapp"
New-Item -ItemType Directory -Force -Path $KotlinDir
New-Item -ItemType Directory -Force -Path ".\android\app\src\main\res\xml"

Copy-Item "$AndroidSrcDir\*.kt" -Destination "$KotlinDir\" -Force
Copy-Item "$AndroidSrcDir\AndroidManifest.xml" -Destination ".\android\app\src\main\AndroidManifest.xml" -Force
Copy-Item "$AndroidSrcDir\res\xml\*" -Destination ".\android\app\src\main\res\xml\" -Force
Write-Host "  ✓ Kotlin ネイティブモジュールをコピーしました" -ForegroundColor Green

# Step 5: MainApplication.kt のパッケージ登録を追記するメッセージ
Write-Host "`n[5/6] MainApplication.kt 手動更新が必要です..." -ForegroundColor Yellow
Write-Host @"
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  手動で以下を MainApplication.kt に追加してください:
  ファイル: android/app/src/main/java/com/debtrunapp/MainApplication.kt

  packages.add(UsageStatsPackage())
  packages.add(ScrollTrackerPackage())

  (getPackages() メソッド内に追加)
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"@ -ForegroundColor Cyan

# Step 6: アプリ起動
Write-Host "`n[6/6] セットアップ完了！次のコマンドでアプリを起動:" -ForegroundColor Green
Write-Host "  cd $AppName" -ForegroundColor White
Write-Host "  npx react-native run-android" -ForegroundColor White
Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "  セットアップ完了！" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
