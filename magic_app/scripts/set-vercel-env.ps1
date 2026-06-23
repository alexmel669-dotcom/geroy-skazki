# Скрипт загрузки переменных из .env.local в Vercel
# Запуск: cd magic_app; .\scripts\set-vercel-env.ps1
# Требует: vercel CLI (npm i -g vercel), vercel login

$ErrorActionPreference = 'Stop'
$envFile = Join-Path $PSScriptRoot '..' '.env.local' | Resolve-Path -ErrorAction SilentlyContinue

if (-not $envFile) {
  Write-Error '.env.local не найден в magic_app/'
}

$vars = @{}
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*([A-Z_]+)\s*=\s*(.*)$' -and $_ -notmatch '^\s*#') {
    $vars[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
  }
}

$keys = @('YANDEX_API_KEY', 'YANDEX_FOLDER_ID', 'JWT_SECRET', 'DEEPSEEK_API_KEY')
$envTargets = @('production', 'preview', 'development')

foreach ($name in $keys) {
  if (-not $vars[$name]) {
    Write-Warning "Пропуск $name — пусто в .env.local"
    continue
  }

  $value = $vars[$name].Trim()
  $tempFile = Join-Path $env:TEMP "vercel-env-$name.txt"
  [System.IO.File]::WriteAllText($tempFile, $value, [System.Text.UTF8Encoding]::new($false))

  foreach ($target in $envTargets) {
    Write-Host "Updating $name ($target) ..."
    vercel env rm $name $target -y 2>$null
    Get-Content $tempFile -Raw | vercel env add $name $target
  }

  Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
}

Write-Host ''
Write-Host 'Done. Проверка после деплоя: https://geroy-skazki.vercel.app/api/health'
Write-Host 'Деплой: npm run deploy'
