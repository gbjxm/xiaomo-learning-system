param([ValidateRange(1,65535)][int]$Port = 8787)
$ErrorActionPreference = 'Stop'
$serverPath = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'server.mjs'
$workerPath = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'unified\information-worker.py'
$projectPath = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Where-Object {$_.LocalAddress -eq '127.0.0.1'})
if ($listeners.Count -eq 0) { Write-Host "本机 $Port 端口没有学习终端服务。"; exit 0 }
foreach ($serverPid in @($listeners.OwningProcess | Sort-Object -Unique)) {
    $serverProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $serverPid"
    if (!$serverProcess -or !$serverProcess.CommandLine -or !$serverProcess.CommandLine.Contains($serverPath, [StringComparison]::OrdinalIgnoreCase)) {
        throw "端口 $Port 的进程不是本项目 server.mjs，未停止。"
    }
    $ownedChildren = @(Get-CimInstance Win32_Process -Filter "ParentProcessId = $serverPid" | Where-Object {$_.CommandLine -and $_.CommandLine.Contains($workerPath, [StringComparison]::OrdinalIgnoreCase)})
    $graceful = $false
    try {
        $bootstrap = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/app/bootstrap" -TimeoutSec 3
        if (!$bootstrap.ok -or $bootstrap.data.app -ne 'xiaomo-personal-unified' -or $bootstrap.data.pid -ne $serverPid -or $bootstrap.data.projectRoot -ne $projectPath) { throw '应用身份不符。' }
        $headers = @{'X-Learning-Token' = $bootstrap.data.token}
        $stopped = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/app/stop" -Method Post -ContentType 'application/json' -Headers $headers -Body '{"confirmation":"stop-local-app"}' -TimeoutSec 5
        $graceful = $stopped.ok -and $stopped.data.stopping
    } catch { Write-Host '正常停止接口未确认；将只处理已核对的本项目进程。' }
    if ($graceful) {
        for ($stopAttempt = 0; $stopAttempt -lt 120 -and (Get-Process -Id $serverPid -ErrorAction SilentlyContinue); $stopAttempt++) { Start-Sleep -Milliseconds 100 }
    }
    foreach ($ownedChild in $ownedChildren) {
        $currentChild = Get-CimInstance Win32_Process -Filter "ProcessId = $($ownedChild.ProcessId)" -ErrorAction SilentlyContinue
        if ($currentChild -and $currentChild.ParentProcessId -eq $serverPid -and $currentChild.CommandLine -eq $ownedChild.CommandLine -and $currentChild.CommandLine.Contains($workerPath, [StringComparison]::OrdinalIgnoreCase)) {
            Stop-Process -Id $currentChild.ProcessId
            Write-Host "已回收统一应用自身启动的信息子进程 $($currentChild.ProcessId)。"
        }
    }
    if (Get-Process -Id $serverPid -ErrorAction SilentlyContinue) {
        $currentServer = Get-CimInstance Win32_Process -Filter "ProcessId = $serverPid" -ErrorAction SilentlyContinue
        if (!$currentServer -or $currentServer.CommandLine -ne $serverProcess.CommandLine) { throw '原进程身份已变化，未强制停止其他进程。' }
        Stop-Process -Id $serverPid
    }
    for ($exitAttempt = 0; $exitAttempt -lt 80; $exitAttempt++) {
        $remainingProcess = Get-Process -Id $serverPid -ErrorAction SilentlyContinue
        $remainingListener = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Where-Object {$_.LocalAddress -eq '127.0.0.1' -and $_.OwningProcess -eq $serverPid})
        if (!$remainingProcess -and $remainingListener.Count -eq 0) { break }
        Start-Sleep -Milliseconds 100
    }
    if ((Get-Process -Id $serverPid -ErrorAction SilentlyContinue) -or $remainingListener.Count -gt 0) { throw '停止请求已发出，但原进程或监听尚未退出；不要立即重开。' }
    $otherListeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Where-Object {$_.LocalAddress -eq '127.0.0.1'})
    if ($otherListeners.Count -gt 0) { throw "原应用已退出，但端口 $Port 已被其他进程监听，未停止该进程。" }
    Write-Host "已停止本项目个人系统（端口 $Port）；已有独立信息服务保持运行。"
}
