# A local file-only audition. No microphone, network, game access or playback.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $projectRoot 'synthetic\zira-audition.json'
$spec = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$outputRoot = Join-Path $projectRoot 'audio\zira-audition-001'
if (Test-Path -LiteralPath $outputRoot) {
    throw 'Audition output already exists. Preserve it; use a new audition revision to regenerate.'
}
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    $synth.SetOutputToNull()
    $available = @($synth.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Name -eq $spec.voice })
    if ($available.Count -ne 1) { throw 'The requested installed Zira voice is unavailable.' }
    if ($spec.lines.Count -ne 6) { throw 'Expected exactly six audition lines.' }
    foreach ($line in $spec.lines) {
        if ($line.id -notmatch '^VA-00[1-6]$' -or $line.text.Length -gt 200) { throw 'Invalid audition input.' }
    }
    if (@($spec.lines.id | Select-Object -Unique).Count -ne 6) { throw 'Duplicate line ID.' }
    $synth.SelectVoice($spec.voice)
    $synth.Rate = [int]$spec.rate
    $synth.Volume = [int]$spec.volume
    $format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(
        [int]$spec.sample_rate,
        [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,
        [System.Speech.AudioFormat.AudioChannel]::Mono
    )
    $rawRoot = Join-Path $outputRoot 'raw'
    New-Item -ItemType Directory -Path $rawRoot | Out-Null
    $records = foreach ($line in $spec.lines) {
        $wavPath = Join-Path $rawRoot ($line.id + '.wav')
        $synth.SetOutputToWaveFile($wavPath, $format)
        $timer = [System.Diagnostics.Stopwatch]::StartNew()
        $synth.Speak([string]$line.text)
        $synth.SetOutputToNull()
        $timer.Stop()
        [pscustomobject]@{
            id = $line.id
            path = ('raw/' + $line.id + '.wav')
            elapsed_synthesis_ms = $timer.ElapsedMilliseconds
            sha256 = (Get-FileHash -LiteralPath $wavPath -Algorithm SHA256).Hash
        }
    }
    $record = [ordered]@{
        status = 'LOCAL_SPEECH_FILES_GENERATED'
        generated_at = (Get-Date).ToUniversalTime().ToString('o')
        engine = 'System.Speech.Synthesis.SpeechSynthesizer'
        assembly_version = $synth.GetType().Assembly.GetName().Version.ToString()
        voice = $synth.Voice.Name
        culture = $synth.Voice.Culture.Name
        rate = $synth.Rate
        volume = $synth.Volume
        manifest_sha256 = (Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash
        api_requests = 0
        api_fees_usd = 0
        microphone_capture = $false
        automatic_playback = $false
        game_access = $false
        files = @($records)
        timing_limit = 'Offline synthesis wall time only; not conversation or in-game latency.'
    }
    $record | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $outputRoot 'generation.json') -Encoding UTF8
    [pscustomobject]@{status=$record.status; voice=$record.voice; clips=@($records).Count; output=$outputRoot} | ConvertTo-Json
}
finally {
    $synth.Dispose()
}
