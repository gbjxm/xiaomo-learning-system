$ErrorActionPreference = 'Stop'
$terminalRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $terminalRoot '.env.local'
$serverFile = Join-Path $terminalRoot 'server.mjs'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw '未找到 Node.js。请先安装 Node.js 20.6 或更新版本。'
}

Write-Host '小陌的个人系统正在启动…'
Write-Host '打开 http://127.0.0.1:8787/learning/ （如已有 LEARNING_PORT 配置，请使用对应端口）。按 Ctrl+C 停止。'
Write-Host '素材观察室与信息收集在同一应用导航中；信息服务启动不采集。'

Push-Location -LiteralPath $terminalRoot
try {
    if (Test-Path -LiteralPath $envFile) {
        & node "--env-file=$envFile" $serverFile
    } else {
        & node $serverFile
    }
} finally {
    Pop-Location
}
