# Stage the reviewed no-local wrapper whole-function candidate once. Never paste or execute.
$Function = 'ProofNoLocalWrapper'
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskProof = Join-Path $taskRoot 'research/evidence/phase-b-no-local-wrapper-20260927-01'
$taskPayload = Join-Path $taskProof ($Function + '.clipboard.txt')
$taskReceipt = Join-Path $taskProof ($Function + '.clipboard-stage.json')
$taskClaim = Join-Path $taskProof ($Function + '.clipboard-stage.started.json')
$taskSpecs = @{
    ProofNoLocalWrapper = @{ bytes=6444; sha256='b5adf6d792c232cdf4bdcb0e2c815451cb310142acc5defd0435634ba11b1e58' }
}
$taskSpec = $taskSpecs[$Function]
$taskSource = 'C:/Program Files/Epic Games/MechWarrior5Editor/MW5Mercs/Content/CodexEditorControlScratch20260925/BP_CodexAuthoringProbe.uasset'
$taskBackup = Join-Path $taskRoot 'artifacts/editor-authoring-probe-20260925/BP_CodexAuthoringProbe.uasset'
$taskPins = @(
    @{ path=(Join-Path $taskRoot 'research/evidence/phase-b-no-local-wrapper-20260927-01/independent-review.json'); bytes=2987; sha256='f627e40b00efc41c32c65a8f2079653281fde62a70ab99ba354197425ff8dbb6' },
    @{ path=(Join-Path $taskRoot 'research/evidence/phase-b-no-local-wrapper-20260927-01/MODEL_RESULT.json'); bytes=1864; sha256='3f8653a576c6f3b2b55102535eb27908d0d81f91583e1d4c8087aa230ab39177' },
    @{ path=(Join-Path $taskRoot 'research/evidence/phase-b-no-local-wrapper-20260927-01/PLAN.md'); bytes=3938; sha256='c410b82244ab793b446db8b2a0018212dfcd92426624448daf5d27ceab65fcae' },
    @{ path=(Join-Path $taskRoot 'scripts/PhaseBBlueprintAssembly.py'); bytes=17128; sha256='385db1e4aec7276a5a8a3ad8262ac5b8e641f2082ff207d13332b4cb552176f0' },
    @{ path=(Join-Path $taskRoot 'scripts/Prepare-PhaseBNoLocalWrapper.py'); bytes=8468; sha256='641b0ce7867ade0552db8ab2dfe9caa1703730a967806844a4c2f864f3668b62' },
    @{ path=(Join-Path $taskRoot 'scripts/Test-PhaseBNoLocalWrapper.py'); bytes=4339; sha256='37c04895a43efec005c0cbecee2fe03c48d8d6dfbd28b9e056428df8033fcdf8' },
    @{ path=(Join-Path $taskRoot 'research/evidence/phase-b-no-local-wrapper-20260927-01/ProofNoLocalWrapper.graph.json'); bytes=17046; sha256='1c49c4280d894b156ac0b7dde920360f3a997ed27c2f2226c8dc78bbc46ee880' },
    @{ path=(Join-Path $taskRoot 'research/evidence/phase-b-textfunctions-native-01/both.COPY'); bytes=479538; sha256='4d10b66f99231ad40a9ed885dc88fbb23b42badcb02c23e2959f59c81cf0743a' },
    @{ path=(Join-Path $taskRoot 'research/evidence/phase-b-textfunctions-native-02/three.COPY'); bytes=851035; sha256='d0bc9f2bae0b38b49b648f5a16474eb4adf2ead021a56dca56f042a532fc1fab' },
    @{ path=(Join-Path $taskRoot 'research/evidence/phase-b-textfunctions-native-02/native-decorator-review.json'); bytes=53412; sha256='d1fc49e67fcf4a446d5bfa6390389b61e370d373eff0e6cd432af58b543856fd' },
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
    foreach ($taskName in @('ProofNoLocalWrapper')) {
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
