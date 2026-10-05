$ErrorActionPreference = 'Stop'
$backupScript = Join-Path $PSScriptRoot 'unified\backup.py'
if (!(Get-Command python -ErrorAction SilentlyContinue)) { throw '未找到现有Python；没有安装新依赖。' }
& python -B -X utf8 $backupScript
if ($LASTEXITCODE -ne 0) { throw '统一备份未完成，原数据保留；请查看上方错误。' }
