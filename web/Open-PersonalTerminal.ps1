param(
    [ValidateRange(1024,65535)][int]$Port = 8787,
    [switch]$NoBrowser
)
$ErrorActionPreference = 'Stop'
$webRoot = $PSScriptRoot
$projectRoot = Split-Path -Parent $webRoot
$serverFile = Join-Path $webRoot 'server.mjs'
$envFile = Join-Path $webRoot '.env.local'
$entryUrl = "http://127.0.0.1:$Port/"
$nodeCommand = Get-Command node.exe -ErrorAction Stop

function Read-TerminalIdentity {
    $identity = Invoke-RestMethod -Uri "${entryUrl}api/app/bootstrap" -TimeoutSec 2
    if (!$identity.ok -or $identity.data.app -ne 'xiaomo-personal-unified' -or $identity.data.projectRoot -ne $projectRoot) {
        throw "端口 $Port 不是这个项目的个人终端，未启动其他进程。"
    }
    $servicePid = [int]$identity.data.pid
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $servicePid"
    $listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Where-Object {$_.LocalAddress -eq '127.0.0.1' -and $_.OwningProcess -eq $servicePid})
    if (!$process -or !$process.CommandLine -or !$process.CommandLine.Contains($serverFile, [StringComparison]::OrdinalIgnoreCase) -or $listeners.Count -ne 1) {
        throw '终端进程或监听身份不一致，未复用。'
    }
    return $identity.data
}

$startupMutex = [System.Threading.Mutex]::new($false, "Local\XiaomoPersonalTerminal-$Port")
$hasMutex = $false
$startedProcess = $null
try {
    try { $hasMutex = $startupMutex.WaitOne(20000) } catch [System.Threading.AbandonedMutexException] { $hasMutex = $true }
    if (!$hasMutex) { throw '另一次启动还在进行，请稍后再试。' }
    $listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
    if ($listeners.Count -gt 0) {
        $running = Read-TerminalIdentity
        Write-Host "个人终端已经在运行，继续使用同一个服务（PID $($running.pid)）。"
    } else {
        $logRoot = Join-Path $webRoot 'logs'
        New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
        $stdoutLog = Join-Path $logRoot "terminal-$stamp.out.log"
        $stderrLog = Join-Path $logRoot "terminal-$stamp.err.log"
        $arguments = @()
        if (Test-Path -LiteralPath $envFile) { $arguments += ('"--env-file={0}"' -f $envFile) }
        $arguments += ('"{0}"' -f $serverFile)
        $previousPort = [Environment]::GetEnvironmentVariable('LEARNING_PORT','Process')
        try {
            $env:LEARNING_PORT = [string]$Port
            $startedProcess = Start-Process -FilePath $nodeCommand.Source -ArgumentList $arguments -WorkingDirectory $webRoot -WindowStyle Hidden -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -PassThru
        } finally {
            [Environment]::SetEnvironmentVariable('LEARNING_PORT',$previousPort,'Process')
        }
        $running = $null
        $lastIssue = ''
        for ($attempt=0; $attempt -lt 30; $attempt++) {
            $startedProcess.Refresh()
            if ($startedProcess.HasExited) { throw "启动进程已退出，请查看：$stderrLog" }
            try { $running = Read-TerminalIdentity; break } catch { $lastIssue = $_.Exception.Message }
            Start-Sleep -Milliseconds 250
        }
        if (!$running) { throw "启动尚未确认：$lastIssue`n日志：$stderrLog" }
        if ([int]$running.pid -ne $startedProcess.Id) { throw '当前服务不是本次启动的进程，未继续操作。' }
        Write-Host "个人终端已在后台启动（PID $($running.pid)）。"
        Write-Host "运行日志：$logRoot"
    }
    $page = Invoke-WebRequest -Uri "${entryUrl}terminal/" -TimeoutSec 8
    if ($page.StatusCode -ne 200 -or !$page.Content.Contains('小陌的个人终端')) { throw '终端首页尚未就绪。' }
    Write-Host "打开：$entryUrl"
    if ($Port -eq 8787) {
        Write-Host '关闭浏览器不会停止服务；不用时双击项目根目录的“停止个人终端.cmd”。'
    } else {
        Write-Host ("停止此端口：& '{0}' -Port {1}" -f (Join-Path $webRoot 'Stop-LearningTerminal.ps1'), $Port)
    }
} catch {
    Write-Error $_
    exit 1
} finally {
    if ($hasMutex) { $startupMutex.ReleaseMutex() }
    $startupMutex.Dispose()
}

if (!$NoBrowser) {
    $edgePaths = @(
        (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
        (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'),
        (Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\Application\msedge.exe')
    )
    $edgePath = $edgePaths | Where-Object {Test-Path -LiteralPath $_} | Select-Object -First 1
    try {
        if ($edgePath) { Start-Process -FilePath $edgePath -ArgumentList $entryUrl }
        else { Start-Process $entryUrl }
    } catch { Write-Warning "服务已启动；浏览器未自动打开，请手动访问 $entryUrl" }
}
