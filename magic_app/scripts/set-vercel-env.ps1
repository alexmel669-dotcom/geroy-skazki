# Скрипт загрузки переменных из .env.local в Vercel (production)
# Запуск: cd magic_app; .\scripts\set-vercel-env.ps1
# Требует: vercel CLI, авторизация vercel login

$ErrorActionPreference = 'Stop'
$envFile = Join-Path $PSScriptRoot '..' '.env.local' | Resolve-Path -ErrorAction SilentlyContinue

if (-not $envFile) {
  Write-Error '.env.local не найден в magic_app/'
}

$vars = @{}
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*([A-Z_]+)\s*=\s*(.*)$' -and $_ -notmatch '^\s*#') {
    $vars[$Matches[1]] = $Matches[2].Trim()
  }
}

$keys = @('YANDEX_API_KEY', 'YANDEX_FOLDER_ID', 'JWT_SECRET', 'DEEPSEEK_API_KEY')
$envTargets = @('production', 'preview', 'development')

foreach ($name in $keys) {
  if (-not $vars[$name]) {
    Write-Warning "Пропуск $name — пусто в .env.local"
    continue
  }
  foreach ($target in $envTargets) {
    Write-Host "Updating $name ($target) ..."
    vercel env rm $name $target -y 2>$null
    $vars[$name] | vercel env add $name $target
  }
}

Write-Host 'Done. Run: npm run deploy'
