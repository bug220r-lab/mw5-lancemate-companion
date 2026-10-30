# Stage the reviewed decorator whole-function candidate once. Never paste or execute.
$Function = 'DecorateBoundedPage'
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskProof = Join-Path $taskRoot 'research/evidence/phase-b-decorate-page-20260927-01'
$taskPayload = Join-Path $taskProof ($Function + '.clipboard.txt')
$taskReceipt = Join-Path $taskProof ($Function + '.clipboard-stage.json')
$taskClaim = Join-Path $taskProof ($Function + '.clipboard-stage.started.json')
$taskSpecs = @{
    DecorateBoundedPage = @{ bytes=353475; sha256='47ddca8a08b0ff7998a447c9337c134ea7828d54b003c3ad1df153b7e96ae38d' }
}
$taskSpec = $taskSpecs[$Function]
$taskSource = 'C:/Program Files/Epic Games/MechWarrior5Editor/MW5Mercs/Content/CodexEditorControlScratch20260925/BP_CodexAuthoringProbe.uasset'
$taskBackup = Join-Path $taskRoot 'artifacts/editor-authoring-probe-20260925/BP_CodexAuthoringProbe.uasset'
$taskPins = @(
    @{ path=(Join-Path $taskRoot 'research/evidence/phase-b-decorate-page-20260927-01/independent-review.json'); bytes=4723; sha256='db5328816a2fbcef3923d6867146a8643d276a8f3d79b0fb3d853270de94684e' },
    @{ path=(Join-Path $taskRoot 'research/evidence/phase-b-local-binding-proof-20260927-01/bindings.COPY'); bytes=60287; sha256='df7db4ca13667e154780d6ace2cba0fea4a0d593d295c789a1bec6fedb05bcd2' },
    @{ path=(Join-Path $taskRoot 'scripts/PhaseBBlueprintAssembly.py'); bytes=17128; sha256='385db1e4aec7276a5a8a3ad8262ac5b8e641f2082ff207d13332b4cb552176f0' },
    @{ path=(Join-Path $taskRoot 'scripts/Prepare-PhaseBTextFunctions.py'); bytes=13301; sha256='155dd012f6a90afb4cf08aee141ee34ddf68408c0741bb970ff702ffd8c5b977' },
    @{ path=(Join-Path $taskRoot 'scripts/Prepare-PhaseBDecoratePage.py'); bytes=13092; sha256='dc91824b91531b696a20361856b63f9b7b5afc969776c86fca2dbdcc62617fdf' },
    @{ path=(Join-Path $taskRoot 'scripts/Test-PhaseBDecoratePage.py'); bytes=12543; sha256='bf482e5843b25da1340f0ec465d0e1ddcdf42b26ac9c86ab26a0ad2a6f64e3f3' },
    @{ path=(Join-Path $taskRoot 'research/evidence/phase-b-decorate-page-20260927-01/MODEL_RESULT.json'); bytes=2748; sha256='9c02c0ba18cbd42e09e41ad4ad328793dd6ca072e5c2407f6b92c2da5a7f1c86' },
    @{ path=(Join-Path $taskRoot 'research/evidence/phase-b-decorate-page-20260927-01/DecorateBoundedPage.graph.json'); bytes=806187; sha256='bb0c2594ee41821e14cce2538a8b725487446e20f7ecae550f0074553e0a3712' },
    @{ path=(Join-Path $taskRoot 'scripts/ObserverPhaseBModel.py'); bytes=20477; sha256='d4091eb4628e191e6a87999b7a4bb4a9abb0e23111cc1bf309866a052b881cd5' },
    @{ path=$taskSource; bytes=28153; sha256='0b7d06f0004d67d1944cd288b44a4b63d7f95d4e17de22b8ee828f4f96f0b6dc' },
    @{ path=$taskBackup; bytes=28153; sha256='0b7d06f0004d67d1944cd288b44a4b63d7f95d4e17de22b8ee828f4f96f0b6dc' }
)

function Assert-TaskPath([string]$Path) {
    $taskCurrent = [IO.Path]::GetFullPath($Path)
    while ($taskCurrent) {
        $taskItem = Get-Item -LiteralPath $taskCurrent
        if ($taskItem.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw 'Bounded path or ancestor is a reparse point.'
        }
        $taskParent = Split-Path -Parent $taskCurrent
        if ($taskParent -eq $taskCurrent) { break }
        $taskCurrent = $taskParent
    }
}

function Assert-TaskIdentity {
    Assert-TaskPath $taskProof
    $taskProcess = Get-Process -Id 26084
    if ($taskProcess.Path -ne 'C:\Program Files\Epic Games\MechWarrior5Editor\Engine\Binaries\Win64\UE4Editor.exe' -or
        $taskProcess.StartTime.ToUniversalTime().ToFileTimeUtc() -ne 134349606362421498) {
        throw 'Editor process identity changed.'
    }
    foreach ($taskPin in $taskPins) {
        Assert-TaskPath $taskPin.path
        if ((Get-Item -LiteralPath $taskPin.path).Length -ne $taskPin.bytes -or
            (Get-FileHash -LiteralPath $taskPin.path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskPin.sha256) {
            throw ('Pinned baseline/source changed: ' + $taskPin.path)
        }
    }
    foreach ($taskName in @('DecorateBoundedPage')) {
        $taskCandidate = Join-Path $taskProof ($taskName + '.clipboard.txt')
        Assert-TaskPath $taskCandidate
        if ((Get-Item -LiteralPath $taskCandidate).Length -ne $taskSpecs[$taskName].bytes -or
            (Get-FileHash -LiteralPath $taskCandidate -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskSpecs[$taskName].sha256) {
            throw 'Frozen candidate changed.'
        }
    }
}

Assert-TaskIdentity
if (Test-Path -LiteralPath $taskReceipt) { throw 'This function has a staging receipt; do not stage again.' }
if (Test-Path -LiteralPath $taskClaim) { throw 'This staging intent was already consumed; review before any retry.' }
$taskEncoding = [Text.UTF8Encoding]::new($false, $true)
$taskPayloadBytes = [IO.File]::ReadAllBytes($taskPayload)
$taskHasher = [Security.Cryptography.SHA256]::Create()
try { $taskBufferHash = ([BitConverter]::ToString($taskHasher.ComputeHash($taskPayloadBytes))).Replace('-', '').ToLowerInvariant() }
finally { $taskHasher.Dispose() }
if ($taskPayloadBytes.Length -ne $taskSpec.bytes -or $taskPayloadBytes.Length -gt 1048576 -or $taskBufferHash -ne $taskSpec.sha256) {
    throw 'Exact staged buffer differs from the reviewed candidate.'
}
$taskText = $taskEncoding.GetString($taskPayloadBytes)
if (-not $taskText.StartsWith(('BPGraph(GraphName="' + $Function + '",GraphType=GT_Function,')) -or
    $taskEncoding.GetByteCount($taskText) -ne $taskSpec.bytes) {
    throw 'Wrong whole-function envelope or encoding.'
}
$taskStart = [DateTime]::UtcNow.ToString('o')
$taskClaimStream = [IO.File]::Open($taskClaim, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
try {
    $taskClaimBytes = $taskEncoding.GetBytes((@{ utc=$taskStart; function=$Function; action='Stage one exact whole-function candidate'; sha256=$taskSpec.sha256 } | ConvertTo-Json))
    $taskClaimStream.Write($taskClaimBytes, 0, $taskClaimBytes.Length)
} finally { $taskClaimStream.Dispose() }
Assert-TaskIdentity
Set-Clipboard -Value $taskText
$taskReadback = Get-Clipboard -Raw
if ($taskReadback -isnot [string]) { throw 'Clipboard readback is not Unicode text; do not paste.' }
$taskHasher = [Security.Cryptography.SHA256]::Create()
try { $taskActual = ([BitConverter]::ToString($taskHasher.ComputeHash($taskEncoding.GetBytes($taskReadback)))).Replace('-', '').ToLowerInvariant() }
finally { $taskHasher.Dispose() }
if ($taskActual -ne $taskSpec.sha256) { throw 'Clipboard readback differs; do not paste.' }
Assert-TaskIdentity
$taskRecord = @{
    status='CLIPBOARD_STAGED_HASH_VERIFIED_NOT_PASTED'; function=$Function;
    started_utc=$taskStart; completed_utc=[DateTime]::UtcNow.ToString('o'); pid=26084;
    process_creation_filetime=134349606362421498; payload=$taskPayload;
    utf8_bytes=$taskSpec.bytes; sha256=$taskActual; editor_input='NOT_PERFORMED';
    native_execution='NOT_PERFORMED'; prior_clipboard='NOT_READ_OR_PRESERVED';
    destination_state='FRESH_UI_RECHECK_REQUIRED';
    next='Paste once via reviewed whole-function route into disposable scratch Blueprint; compile/export/review before any invocation. Baseline file is historical source evidence, not a current live-state assertion.'
}
$taskReceiptStream = [IO.File]::Open($taskReceipt, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
try {
    $taskReceiptBytes = $taskEncoding.GetBytes(($taskRecord | ConvertTo-Json))
    $taskReceiptStream.Write($taskReceiptBytes, 0, $taskReceiptBytes.Length)
} finally { $taskReceiptStream.Dispose() }
$taskRecord | ConvertTo-Json
