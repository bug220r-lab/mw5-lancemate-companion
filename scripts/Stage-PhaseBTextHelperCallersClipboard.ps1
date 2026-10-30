# Stage the reviewed three disconnected text-helper caller nodes once. Never paste or execute.
$Group = 'TextHelperCallers'
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskProof = Join-Path $taskRoot 'research/evidence/phase-b-texthelper-callers-20260927-01'
$taskPayload = Join-Path $taskProof ($Group + '.clipboard.txt')
$taskReceipt = Join-Path $taskProof ($Group + '.clipboard-stage.json')
$taskClaim = Join-Path $taskProof ($Group + '.clipboard-stage.started.json')
$taskSpecs = @{
    TextHelperCallers = @{ bytes=897; sha256='de80274c4d5e4995da930bce57986eaeb960df4526a10f84f9a9d8ef84211f83' }
}
$taskSpec = $taskSpecs[$Group]
$taskSource = 'C:/Program Files/Epic Games/MechWarrior5Editor/MW5Mercs/Content/CodexEditorControlScratch20260925/BP_CodexAuthoringProbe.uasset'
$taskBackup = Join-Path $taskRoot 'artifacts/editor-authoring-probe-20260925/BP_CodexAuthoringProbe.uasset'
$taskPins = @(
    @{ path=(Join-Path $taskRoot 'research/evidence/phase-b-texthelper-callers-20260927-01/preparation.json'); bytes=2988; sha256='3f42bd0eed55e5cefc9e353ea474a413f5d68ac9bc03113c425e755e632fd35c' },
    @{ path=(Join-Path $taskRoot 'research/evidence/phase-b-texthelper-callers-20260927-01/PLAN.md'); bytes=1596; sha256='d7cd1e85ee311bb38ccefab7681f4096c40fce5b2b67c254ab81712e29a2fdd3' },
    @{ path=(Join-Path $taskRoot 'research/evidence/phase-b-no-local-wrapper-native-01/wrapper.COPY'); bytes=858187; sha256='677e2269f8cc78d9bb84b8ebf91c2fa39d7e95e5d7091fdab7f47369221c4b41' },
    @{ path=(Join-Path $taskRoot 'research/evidence/phase-b-no-local-wrapper-native-01/native-wrapper-review.json'); bytes=27200; sha256='e51663ecf5fa55afceae92ea33383a91b2fa591bd76739be6ad5bc540ca02d6a' },
    @{ path=(Join-Path $taskRoot 'research/evidence/phase-b-no-local-wrapper-call-20260927-01/native.result.json'); bytes=2742; sha256='6a2ff0af0c8d10eb9c2a27396a2936b14806fca7df37e7a8cb47ae805b28ad86' },
    @{ path=(Join-Path $taskRoot 'scripts/PhaseBBlueprintAssembly.py'); bytes=17128; sha256='385db1e4aec7276a5a8a3ad8262ac5b8e641f2082ff207d13332b4cb552176f0' },
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
    foreach ($taskName in @('TextHelperCallers')) {
        $taskCandidate = Join-Path $taskProof ($taskName + '.clipboard.txt')
        Assert-TaskPath $taskCandidate
        if ((Get-Item -LiteralPath $taskCandidate).Length -ne $taskSpecs[$taskName].bytes -or
            (Get-FileHash -LiteralPath $taskCandidate -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskSpecs[$taskName].sha256) {
            throw 'Frozen candidate changed.'
        }
    }
}

Assert-TaskIdentity
if (Test-Path -LiteralPath $taskReceipt) { throw 'This node group has a staging receipt; do not stage again.' }
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
if (-not $taskText.StartsWith('Begin Object Class=/Script/BlueprintGraph.K2Node_CallFunction ') -or
    [regex]::Matches($taskText, '(?m)^Begin Object ').Count -ne 3 -or
    $taskText.Contains('CustomProperties Pin') -or $taskText.Contains('LinkedTo=') -or
    $taskEncoding.GetByteCount($taskText) -ne $taskSpec.bytes) {
    throw 'Wrong three-node pinless envelope or encoding.'
}
$taskStart = [DateTime]::UtcNow.ToString('o')
$taskClaimStream = [IO.File]::Open($taskClaim, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
try {
    $taskClaimBytes = $taskEncoding.GetBytes((@{ utc=$taskStart; group=$Group; action='Stage exactly three disconnected pinless caller nodes'; sha256=$taskSpec.sha256 } | ConvertTo-Json))
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
    status='CLIPBOARD_STAGED_HASH_VERIFIED_NOT_PASTED'; group=$Group;
    started_utc=$taskStart; completed_utc=[DateTime]::UtcNow.ToString('o'); pid=26084;
    process_creation_filetime=134349606362421498; payload=$taskPayload;
    utf8_bytes=$taskSpec.bytes; sha256=$taskActual; editor_input='NOT_PERFORMED';
    native_execution='NOT_PERFORMED'; prior_clipboard='NOT_READ_OR_PRESERVED';
    destination_state='FRESH_UI_RECHECK_REQUIRED';
    next='Paste this node group once into the disposable scratch EventGraph; all reconstructed pins must remain disconnected. Compile/export/review signatures only; no invocation. Baseline file is source evidence, not a current live-state assertion.'
}
$taskReceiptStream = [IO.File]::Open($taskReceipt, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
try {
    $taskReceiptBytes = $taskEncoding.GetBytes(($taskRecord | ConvertTo-Json))
    $taskReceiptStream.Write($taskReceiptBytes, 0, $taskReceiptBytes.Length)
} finally { $taskReceiptStream.Dispose() }
$taskRecord | ConvertTo-Json
