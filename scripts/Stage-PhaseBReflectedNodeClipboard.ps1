# One NEW-intent clipboard write for the disposable reflected-node reconstruction proof.
# This stages text only; it does not paste, execute, save, compile or launch.
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskProof = Join-Path $taskRoot 'research/evidence/phase-b-reflected-node-proof-20260927-01'
$taskPayload = Join-Path $taskProof 'reflected-nodes.clipboard.txt'
$taskReceipt = Join-Path $taskProof 'clipboard-stage.json'
$taskClaim = Join-Path $taskProof 'clipboard-stage.started.json'
$taskExpected = '576c76631da970f97b6a6721d9c0885fa9f1366b226faca1646eb8b1ef53085b'
$taskBaseline = Join-Path $taskRoot 'research/evidence/phase-b-typed-variable-proof-20260927-01/typed.COPY'
$taskBaselineExpected = 'faf4d7cce4a304693576c9c2207b61a85b79987104d31e71b116ba6e43ffa829'
$taskSource = 'C:/Program Files/Epic Games/MechWarrior5Editor/MW5Mercs/Content/CodexEditorControlScratch20260925/BP_CodexAuthoringProbe.uasset'
$taskBackup = Join-Path $taskRoot 'artifacts/editor-authoring-probe-20260925/BP_CodexAuthoringProbe.uasset'
function Assert-TaskIdentity {
    $taskNativeResult = Join-Path $taskRoot 'research/evidence/phase-b-reflected-functions-20260927-01/native.result.json'
    if ((Get-FileHash -LiteralPath $taskNativeResult -Algorithm SHA256).Hash.ToLowerInvariant() -ne '713eac7306ecb6c639b3752f62d165bec70a90137a5e01f483aa55ac7e378f10') {
        throw 'Observed native function identities changed.'
    }
    foreach ($taskBoundPath in @($taskProof, $taskPayload, $taskBaseline, $taskNativeResult, $taskSource, $taskBackup)) {
        if ((Get-Item -LiteralPath $taskBoundPath).Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw 'Bounded input/output path is a reparse point.'
        }
    }
    if ((Get-Item -LiteralPath $taskBaseline).Length -ne 36240 -or
        (Get-FileHash -LiteralPath $taskBaseline -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskBaselineExpected) {
        throw 'Reviewed typed baseline changed.'
    }
    $taskProcess = Get-Process -Id 26084
    if ($taskProcess.Path -ne 'C:\Program Files\Epic Games\MechWarrior5Editor\Engine\Binaries\Win64\UE4Editor.exe' -or
        $taskProcess.StartTime.ToUniversalTime().ToFileTimeUtc() -ne 134349606362421498) {
        throw 'Editor identity changed.'
    }
    foreach ($taskPinnedFile in @($taskSource, $taskBackup)) {
        if ((Get-Item -LiteralPath $taskPinnedFile).Length -ne 28153 -or
            (Get-FileHash -LiteralPath $taskPinnedFile -Algorithm SHA256).Hash.ToLowerInvariant() -ne '0b7d06f0004d67d1944cd288b44a4b63d7f95d4e17de22b8ee828f4f96f0b6dc') {
            throw 'Scratch source or backup changed.'
        }
    }
    if ((Get-Item -LiteralPath $taskProof).Attributes -band [IO.FileAttributes]::ReparsePoint) {
        throw 'Evidence directory is a reparse point.'
    }
}
Assert-TaskIdentity
if (Test-Path -LiteralPath $taskReceipt) { throw 'Receipt exists; do not stage again.' }
if (Test-Path -LiteralPath $taskClaim) { throw 'Attempt exists; review before any retry.' }
if ((Get-Item -LiteralPath $taskPayload).Length -ne 950 -or
    (Get-FileHash -LiteralPath $taskPayload -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskExpected) {
    throw 'Reviewed pins-omitted payload changed.'
}
$taskEncoding = [Text.UTF8Encoding]::new($false, $true)
$taskPayloadBytes = [IO.File]::ReadAllBytes($taskPayload)
$taskPayloadHasher = [Security.Cryptography.SHA256]::Create()
try { $taskBufferHash = ([BitConverter]::ToString($taskPayloadHasher.ComputeHash($taskPayloadBytes))).Replace('-', '').ToLowerInvariant() }
finally { $taskPayloadHasher.Dispose() }
if ($taskPayloadBytes.Length -ne 950 -or $taskBufferHash -ne $taskExpected) { throw 'Exact staged buffer differs from reviewed payload.' }
$taskText = $taskEncoding.GetString($taskPayloadBytes)
if ($taskEncoding.GetByteCount($taskText) -ne 950) { throw 'Payload encoding mismatch.' }
$taskStart = [DateTime]::UtcNow.ToString('o')
$taskClaimStream = [IO.File]::Open($taskClaim, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
try {
    $taskClaimData = $taskEncoding.GetBytes((@{ utc=$taskStart; action='Stage exact reviewed payload for NEW disconnected reflected-node reconstruction intent only'; sha256=$taskExpected } | ConvertTo-Json))
    $taskClaimStream.Write($taskClaimData, 0, $taskClaimData.Length)
} finally { $taskClaimStream.Dispose() }
Assert-TaskIdentity
Set-Clipboard -Value $taskText
$taskReadback = Get-Clipboard -Raw
if ($taskReadback -isnot [string]) { throw 'Clipboard readback is not Unicode text; do not paste.' }
$taskHasher = [Security.Cryptography.SHA256]::Create()
try { $taskActual = ([BitConverter]::ToString($taskHasher.ComputeHash($taskEncoding.GetBytes($taskReadback)))).Replace('-', '').ToLowerInvariant() }
finally { $taskHasher.Dispose() }
if ($taskActual -ne $taskExpected) { throw 'Clipboard readback differs; do not paste.' }
Assert-TaskIdentity
$taskRecord = @{
    status='CLIPBOARD_STAGED_HASH_VERIFIED_NOT_PASTED'; started_utc=$taskStart;
    completed_utc=[DateTime]::UtcNow.ToString('o'); pid=26084;
    payload=$taskPayload; utf8_bytes=950; sha256=$taskActual;
    editor_input='NOT_PERFORMED'; runtime='NOT_PERFORMED';
    prior_clipboard='NOT_READ_OR_PRESERVED'; next='Fresh typed scratch graph required before one NEW-intent Paste; inspect reconstruction, compile and export; no execution wiring'
}
$taskReceiptStream = [IO.File]::Open($taskReceipt, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
try {
    $taskReceiptData = $taskEncoding.GetBytes(($taskRecord | ConvertTo-Json))
    $taskReceiptStream.Write($taskReceiptData, 0, $taskReceiptData.Length)
} finally { $taskReceiptStream.Dispose() }
$taskRecord | ConvertTo-Json
