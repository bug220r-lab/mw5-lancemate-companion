# One bounded editor commandlet run. No retail executable or gameplay is used.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskEditorRoot = 'C:\Program Files\Epic Games\MechWarrior5Editor'
$taskExecutable = Join-Path $taskEditorRoot 'Engine\Binaries\Win64\UE4Editor-Cmd.exe'
$taskProject = Join-Path $taskEditorRoot 'MW5Mercs\MW5Mercs.uproject'
$taskScript = Join-Path $PSScriptRoot 'Inspect-EditorReflection.py'
$taskEvidence = Join-Path $taskRoot 'research\evidence\editor-source'
$taskReport = Join-Path $taskEvidence 'native-reflection.json'
$taskRunRecord = Join-Path $taskEvidence 'native-reflection-run.json'
$taskLog = Join-Path $taskEvidence 'native-reflection-editor.log'
$taskStdout = Join-Path $taskEvidence 'native-reflection-stdout.log'
$taskStderr = Join-Path $taskEvidence 'native-reflection-stderr.log'
foreach ($taskPath in @($taskExecutable, $taskProject, $taskScript)) {
    if (-not (Test-Path -LiteralPath $taskPath -PathType Leaf)) { throw "Missing required file: $taskPath" }
}
foreach ($taskPath in @($taskReport, ($taskReport + '.tmp'), $taskRunRecord, $taskLog, $taskStdout, $taskStderr)) {
    if (Test-Path -LiteralPath $taskPath) { throw "Existing evidence must be preserved: $taskPath" }
}
if (([IO.DriveInfo]::new('C:\')).AvailableFreeSpace -lt 8GB) {
    throw 'Probe not started: less than the chosen 8 GiB starting headroom (a local guard, not a publisher requirement).'
}
$null = New-Item -ItemType Directory -Path $taskEvidence -Force
$taskArgs = '"{0}" -Installed -run=pythonscript -script="{1}" -unattended -nop4 -nosplash -NullRHI -NoShaderCompile -abslog="{2}"' -f $taskProject, $taskScript, $taskLog
$taskStarted = (Get-Date).ToString('o')
$taskInitialFree = ([IO.DriveInfo]::new('C:\')).AvailableFreeSpace
$taskProcess = $null
$taskStopReason = $null
$taskMonitorError = $null
$taskCleanupError = $null
try {
    $taskProcess = Start-Process -FilePath $taskExecutable -ArgumentList $taskArgs -WorkingDirectory $taskEditorRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput $taskStdout -RedirectStandardError $taskStderr
    $taskWatch = [Diagnostics.Stopwatch]::StartNew()
    while (-not $taskProcess.WaitForExit(2000)) {
        if (([IO.DriveInfo]::new('C:\')).AvailableFreeSpace -lt 4GB) { $taskStopReason = 'FREE_SPACE_GUARD'; break }
        if ($taskWatch.Elapsed.TotalSeconds -ge 180) { $taskStopReason = 'THREE_MINUTE_PROBE_LIMIT'; break }
    }
}
catch {
    $taskMonitorError = $_.Exception.Message
    $taskStopReason = 'MONITOR_OR_LAUNCH_ERROR'
}
finally {
    if ($null -ne $taskProcess) {
        try {
            $taskProcess.Refresh()
            if (-not $taskProcess.HasExited) {
                if (-not $taskStopReason) { $taskStopReason = 'MONITOR_INTERRUPTED' }
                # Only the diagnostic process object created above; never a name match.
                $taskProcess.Kill()
                if (-not $taskProcess.WaitForExit(5000)) { $taskCleanupError = 'Owned process did not exit within five seconds after Kill' }
            }
        }
        catch { $taskCleanupError = $_.Exception.Message }
    }
}
$taskExitCode = if ($null -ne $taskProcess -and $taskProcess.HasExited) { $taskProcess.ExitCode } else { $null }
$taskResult = [ordered]@{
    observed_at = (Get-Date).ToString('o')
    started_at = $taskStarted
    executable = $taskExecutable
    arguments = $taskArgs
    process_id = if ($null -ne $taskProcess) { $taskProcess.Id } else { $null }
    exit_code = $taskExitCode
    stop_reason = $taskStopReason
    monitor_error = $taskMonitorError
    cleanup_error = $taskCleanupError
    initial_free_bytes = $taskInitialFree
    final_free_bytes = ([IO.DriveInfo]::new('C:\')).AvailableFreeSpace
    report_present = (Test-Path -LiteralPath $taskReport)
    scope = 'Editor reflection metadata only; inspection script requests no asset loads, gameplay calls, PIE, saves, cooking or deployment'
    limits = 'Editor startup may load dependencies and create logs/cache/stubs; polled guards are not hard resource caps; reflected API presence is not shipping behavior proof'
}
$taskResult | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $taskRunRecord -Encoding UTF8
$taskResult | ConvertTo-Json -Depth 4
