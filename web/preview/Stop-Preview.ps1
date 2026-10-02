$ErrorActionPreference = 'Stop'
$previewHealth = Invoke-RestMethod -Uri 'http://127.0.0.1:8790/preview/api/health'
if ($previewHealth.app -ne 'xiaomo-exploration-preview' -or $previewHealth.projectRoot -ne 'D:\codex\小陌的学习系统') { throw '端口不是本项目探索预览，拒绝停止。' }
Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8790/preview/api/stop' -Headers @{'X-Preview-Token'=$previewHealth.stopToken}
