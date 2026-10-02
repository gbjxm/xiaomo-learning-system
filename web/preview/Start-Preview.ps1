$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
Write-Host '电脑探索预览：http://127.0.0.1:8790/preview/'
Write-Host '请保持原8787应用运行；预览只读正式资料。Ctrl+C仅停止本预览。'
& node (Join-Path $PSScriptRoot 'server.mjs')
