# Stage the reviewed six-case fixture whole-function candidate once. Never paste or execute.
$Function = 'RunFixedTextHelperFixtures_Proof'
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskProof = Join-Path $taskRoot 'research/evidence/phase-b-fixed-text-fixtures-20260927-01'
$taskPayload = Join-Path $taskProof ($Function + '.clipboard.txt')
$taskReceipt = Join-Path $taskProof ($Function + '.clipboard-stage.json')
$taskClaim = Join-Path $taskProof ($Function + '.clipboard-stage.started.json')
$taskSpecs = @{
    RunFixedTextHelperFixtures_Proof = @{ bytes=225325; sha256='52b70b702a1b2fa43ffd7333ff2ef88746a6d713bb18bb8155e639940347b23d' }
}
$taskSpec = $taskSpecs[$Function]
$taskSource = 'C:/Program Files/Epic Games/MechWarrior5Editor/MW5Mercs/Content/CodexEditorControlScratch20260925/BP_CodexAuthoringProbe.uasset'
$taskBackup = Join-Path $taskRoot 'artifacts/editor-authoring-probe-20260925/BP_CodexAuthoringProbe.uasset'
$taskPins = @(
    @{ path=(Join-Path $taskRoot 'research/evidence/phase-b-fixed-text-fixtures-20260927-01/independent-review.json'); bytes=4401; sha256='1e88661f2bacbc56d9c555ce5e5d25b6e5a3ba4c6cb97ea985fd71f197fe34d1' },
    @{ path=(Join-Path $taskRoot 'research/evidence/phase-b-fixed-text-fixtures-20260927-01/MODEL_RESULT.json'); bytes=1513; sha256='701bac1fc65a9cc104f5bd7d51d4d6672189d4ff97caac7f6c8db439494570ca' },
    @{ path=(Join-Path $taskRoot 'research/OBSERVER_CALL_IN_EDITOR_FIXTURE_UNIT_2026-09-27.md'); bytes=10234; sha256='5596e60b1bb598eeca9246cce850fbe0ae52553c38c66a8582756f792527480c' },
    @{ path=(Join-Path $taskRoot 'scripts/PhaseBBlueprintAssembly.py'); bytes=17128; sha256='385db1e4aec7276a5a8a3ad8262ac5b8e641f2082ff207d13332b4cb552176f0' },
    @{ path=(Join-Path $taskRoot 'scripts/Prepare-PhaseBFixedTextFixtures.py'); bytes=12050; sha256='40f1fde3713d84ba28c183ea04c22421fb7df543f796fe09162a9947cfebadd9' },
    @{ path=(Join-Path $taskRoot 'scripts/Test-PhaseBFixedTextFixtures.py'); bytes=12575; sha256='22662bbef4ce3033b6d37bdda3be0bd770f6c0ba4fe5dec43cc2b9371c25ec41' },
    @{ path=(Join-Path $taskRoot 'research/evidence/phase-b-fixed-text-fixtures-20260927-01/RunFixedTextHelperFixtures_Proof.graph.json'); bytes=463876; sha256='cc5ed8d99643c91473e2121f965a305df0e7d92cebbef8b96198347a96a07825' },
    @{ path=(Join-Path $taskRoot 'research/evidence/phase-b-texthelper-callers-native-01/callers.COPY'); bytes=893094; sha256='4e10ce0efec65aaabab0f3e7316997fd00906be7c9c7158665a5e6244539c6c2' },
    @{ path=(Join-Path $taskRoot 'research/evidence/phase-b-texthelper-callers-native-01/native-callers-review.json'); bytes=6874; sha256='c55f3c86ba56b6850870111abc55c38f45763c4b1cb3181883ca31072cad2d17' },
    @{ path=(Join-Path $taskRoot 'research/evidence/phase-b-call-in-editor-fixture-20260927-01/fixed-fixture-expectations.json'); bytes=2768; sha256='e5b97cff7896a0d96a2d35847ce236aaf99b19dc6f638e2c245baf70db9325f3' },
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
    foreach ($taskName in @('RunFixedTextHelperFixtures_Proof')) {
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
    next='Paste the distinct fixture function once into disposable scratch Blueprint; compile/export/review metadata, all six cases, and exact supplementary literals. No invocation in this unit. Preserve the empty native template. Baseline file is source evidence, not a current live-state assertion.'
}
$taskReceiptStream = [IO.File]::Open($taskReceipt, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
try {
    $taskReceiptBytes = $taskEncoding.GetBytes(($taskRecord | ConvertTo-Json))
    $taskReceiptStream.Write($taskReceiptBytes, 0, $taskReceiptBytes.Length)
} finally { $taskReceiptStream.Dispose() }
$taskRecord | ConvertTo-Json
