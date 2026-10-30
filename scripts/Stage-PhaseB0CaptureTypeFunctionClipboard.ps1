# Stage the reviewed PCC capture type whole-function candidate once. Never paste or execute.
# Fixture preservation baseline and its independent source reviews are sealed below.
$Function = 'ProofB0CaptureTypes_Full'
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskProof = Join-Path $taskRoot 'research/evidence/phase-b0-capture-type-function-20260927-01'
$taskPayload = Join-Path $taskProof ($Function + '.clipboard.txt')
$taskReceipt = Join-Path $taskProof ($Function + '.clipboard-stage.json')
$taskClaim = Join-Path $taskProof ($Function + '.clipboard-stage.started.json')
$taskSpecs = @{
    ProofB0CaptureTypes_Full = @{ bytes=30803; sha256='7e55eee9e936d592bc2d28cd437928d6e3d09286352ac47b2c4996efdd7d757e' }
}
$taskSpec = $taskSpecs[$Function]
$taskSource = 'C:/Program Files/Epic Games/MechWarrior5Editor/MW5Mercs/Content/CodexEditorControlScratch20260925/BP_CodexAuthoringProbe.uasset'
$taskBackup = Join-Path $taskRoot 'artifacts/editor-authoring-probe-20260925/BP_CodexAuthoringProbe.uasset'
$taskPins = @(
    @{ path=(Join-Path $taskRoot 'research/evidence/phase-b0-capture-type-function-20260927-01/independent-review.json'); bytes=4491; sha256='8db846876055ab82bf40c6e892baf49bb8cdf0a392e2e55bd456d245d541c70e' },
    @{ path=(Join-Path $taskRoot 'research/evidence/phase-b0-capture-type-function-20260927-01/preparation.json'); bytes=3629; sha256='48aef88acf8b5c688c2309d81c047f5e22202c1c6644019ede7fa65f1c605abc' },
    @{ path=(Join-Path $taskRoot 'research/evidence/phase-b0-capture-type-function-20260927-01/TEST_RESULT.json'); bytes=1897; sha256='aaf62821ec255b9a159ad0e2fdda054a77232d49a909b77f9cbc9e6e541f2213' },
    @{ path=(Join-Path $taskRoot 'research/evidence/phase-b0-capture-type-function-20260927-01/ProofB0CaptureTypes_Full.graph.json'); bytes=150609; sha256='275a2af14c4851cc6a40875994a38135328819c86b9d695f7f855e5e9123c5c7' },
    @{ path=(Join-Path $taskRoot 'scripts/Prepare-PhaseB0CaptureTypeFunction.py'); bytes=17171; sha256='fc463eb140f12a9cf61b0401d331ebef9cd514f39baadf8f597552a75a03494e' },
    @{ path=(Join-Path $taskRoot 'scripts/Test-PhaseB0CaptureTypeFunction.py'); bytes=5653; sha256='90e58278faa4f8f88e7df5deb9ddbdf833339e061decbb0a1843af68d0fb21e2' },
    @{ path=(Join-Path $taskRoot 'scripts/PhaseBBlueprintAssembly.py'); bytes=17128; sha256='385db1e4aec7276a5a8a3ad8262ac5b8e641f2082ff207d13332b4cb552176f0' },
    @{ path=(Join-Path $taskRoot 'research/OBSERVER_PHASE_B0_CAPTURE_TYPE_ADDENDUM_2026-09-27.md'); bytes=5748; sha256='7fd11d945637feedb5d807e7e90c5d4f41769d434a73449b37e6a56c34e60d17' },
    @{ path=(Join-Path $taskRoot 'research/evidence/phase-b-texthelper-callers-native-01/callers.COPY'); bytes=893094; sha256='4e10ce0efec65aaabab0f3e7316997fd00906be7c9c7158665a5e6244539c6c2' },
    @{ path=(Join-Path $taskRoot 'research/evidence/phase-b-texthelper-callers-native-01/native-callers-review.json'); bytes=6874; sha256='c55f3c86ba56b6850870111abc55c38f45763c4b1cb3181883ca31072cad2d17' },
    @{ path=(Join-Path $taskRoot 'research/evidence/phase-b-fixed-text-fixtures-native-01/fixtures.COPY'); bytes=2229892; sha256='245dcd262b233bddc77116e4393c780501394654f71ab1823e6364106e46b34e' },
    @{ path=(Join-Path $taskRoot 'research/evidence/phase-b-fixed-text-fixtures-native-01/native-fixtures-review.json'); bytes=8607; sha256='a537c045197c2b10448c733fb3048a831f143c9104f52abad2c05a94a434297b' },
    @{ path=(Join-Path $taskRoot 'research/evidence/phase-b-fixed-text-fixtures-native-01/native-fixtures-second-review.json'); bytes=59427; sha256='5da1470f6be7514a71ebc805a90ab8afd6b11c6e7dde3ced29dc858ee9f4e13d' },
    @{ path=(Join-Path $taskRoot 'research/evidence/phase-b-fixed-text-fixtures-native-01/fixtures.result.json'); bytes=863; sha256='ba14cb18948065ffc356f8cba1c6713c9c24dd270561bdade1ad1ac829f736d2' },
    @{ path=(Join-Path $taskRoot 'research/evidence/phase-b-fixed-text-fixtures-native-01/ROOT_CONTINUATION_DECISION.md'); bytes=2579; sha256='7d3eee224ebdae6f3394bd153ff360f12ac496d23f0ab729005536cc47505b1b' },
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
    foreach ($taskName in @('ProofB0CaptureTypes_Full')) {
        $taskCandidate = Join-Path $taskProof ($taskName + '.clipboard.txt')
        Assert-TaskPath $taskCandidate
        if ((Get-Item -LiteralPath $taskCandidate).Length -ne $taskSpecs[$taskName].bytes -or
            (Get-FileHash -LiteralPath $taskCandidate -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskSpecs[$taskName].sha256) {
            throw 'Frozen candidate changed.'
        }
    }
}

Assert-TaskIdentity
if (@(Get-ChildItem -LiteralPath $taskProof -Force | Where-Object { $_.Name -in @([IO.Path]::GetFileName($taskReceipt), [IO.Path]::GetFileName($taskClaim)) }).Count -gt 0) { throw 'Staging receipt or claim pathname already exists; no clipboard action.' }
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
    next='Paste once via reviewed whole-function route into disposable scratch Blueprint; compile/export/review this disconnected type proof. Invocation remains outside this unit. Baseline file is historical source evidence, not a current live-state assertion.'
}
$taskReceiptStream = [IO.File]::Open($taskReceipt, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
try {
    $taskReceiptBytes = $taskEncoding.GetBytes(($taskRecord | ConvertTo-Json))
    $taskReceiptStream.Write($taskReceiptBytes, 0, $taskReceiptBytes.Length)
} finally { $taskReceiptStream.Dispose() }
$taskRecord | ConvertTo-Json
