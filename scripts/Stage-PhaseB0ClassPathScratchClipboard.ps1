# Stage the reviewed scratch-only class-path proof shell once. Never paste or execute.
# Both scratch checkpoints, original backup, failed Capture export and reviewed proof source are sealed below.
$Function = 'ProofB0ClassPathConversion'
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskProof = Join-Path $taskRoot 'research/evidence/phase-b0-class-path-scratch-proof-20260927-01'
$taskPayload = Join-Path $taskProof ($Function + '.clipboard.txt')
$taskRun = Join-Path $taskRoot 'research/evidence/phase-b0-class-path-scratch-proof-native-01'
$taskReceipt = Join-Path $taskRun ($Function + '.clipboard-stage.json')
$taskClaim = Join-Path $taskRun ($Function + '.clipboard-stage.started.json')
$taskSpecs = @{
    ProofB0ClassPathConversion = @{ bytes=5601; sha256='fb3e25a7fea1c5246efa1cc32f16265273adda4563889b813ac68b8ce01be3b9' }
}
$taskSpec = $taskSpecs[$Function]
$taskSource = 'C:/Program Files/Epic Games/MechWarrior5Editor/MW5Mercs/Content/CodexEditorControlScratch20260925/BP_CodexAuthoringProbe.uasset'
$taskBackup = Join-Path $taskRoot 'artifacts/editor-authoring-probe-20260925/BP_CodexAuthoringProbe.uasset'
$taskPins = @(
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\scripts\Prepare-PhaseB0ClassPathScratchProof.py'; bytes=7774; sha256='c4cb8c1161e1faf23411fc4c76c3b57ec5336d438f0d904ce731c425de177e0f' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\phase-b0-class-path-scratch-proof-20260927-01\proof-shell-independent-review.json'; bytes=2847; sha256='0402534c322aaa4d80e77c5f8fa3bd70f745a17ff4cdef10a5b9dedcfeb5436b' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\phase-b0-class-path-scratch-proof-20260927-01\proof-shell-preparation.json'; bytes=12210; sha256='211dd049a0eb1085d7232e75202a63badd9b471f5c00f00dc2c52be936aae149' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\phase-b0-class-path-repair-20260927-01\SOURCE_FINDINGS.json'; bytes=5522; sha256='62ad44f8a5dd8b9164b83eea8c793074a9c869a7d28130567c25d87d543a9c93' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\phase-b0-capture-type-function-native-02\full.COPY'; bytes=2296332; sha256='17682425fed807c58ff3a0b745f824bbfd4709f87cfd44cb02f1e1cf5158c37c' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\phase-b0-capture-type-function-native-02\native-full-type-review.json'; bytes=35428; sha256='fd74f47c08b1822a9f80d1e68bd6a02312252fbdd619c15c006c084bc2c993f0' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\phase-b0-capture-failure-native-01\controller.COPY'; bytes=1111868; sha256='e2f5a8b4a2b57cee485e69a7d08f21954d8bf105ff53bfcc3c7238ed5334ab33' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\phase-b0-capture-failure-native-01\widget.COPY'; bytes=33538; sha256='e0f4eb8b0efd1e7e8bac5172ac3a58c15e94cd68b01652cd04c309d21957e86e' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\phase-b0-capture-failure-native-01\failure.result.json'; bytes=1615; sha256='89a9155455bf0b91840983ed1bbf63c45eee1479d9e196801091835e214d25f7' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\phase-b0-capture-failure-native-01\protected-inputs.json'; bytes=21152; sha256='5beac88296e5865892bb30b612819994f944e143b9fd88f9aafdf831675286c3' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\editor-source\ai-research-collection-20260921T030437Z-f7d8e930\006-Dpad_FunctionLib-source.COPY'; bytes=110516; sha256='25bfc6f62c91779886e012b713639c4cd08d613a82371cd92d5db9893280d967' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\editor-source\ai-research-collection-20260921T030437Z-f7d8e930\010-MW5PlayerController-source.COPY'; bytes=1678058; sha256='6faaa7cf5d925123441f8022bda01d7b3475c71849fff94758e7d2c6baa4b530' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\phase-b-missing-template-proof-20260927-01\templates.COPY'; bytes=52688; sha256='f3008173fe7bacc107fe05d8f43f64b9536eccae126706e5989439a294c2ac1e' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\artifacts\phase-b0-scratch-saved-checkpoint-20260927T134956Z\BP_CodexAuthoringProbe.uasset'; bytes=863483; sha256='c41690b43992a6713b0fd6babef819d757e829f8a8a40b81917b12783598caa6' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\artifacts\phase-b0-scratch-saved-checkpoint-20260927T134956Z\CHECKPOINT.json'; bytes=829; sha256='9e983d4ee6f371a4259d92faed569b6ab981dc2fb2d299657675b91378492d98' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\phase-b0-capture-type-function-native-02\native-types-second-review.json'; bytes=24626; sha256='f6e8ddf91e456022350406ad9963f44002681bc1718e0c6f26d03fe1f7989751' },
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
    @{ path=(Join-Path $taskRoot 'research/evidence/phase-b-fixed-text-fixtures-native-01/ROOT_CONTINUATION_DECISION.md'); bytes=3556; sha256='7e74d00d0ba71a4231fb98cd098ba0cd0ab874bd58594b6d904d9eec496431d9' },
    @{ path=(Join-Path $taskRoot 'artifacts/phase-b-scratch-saved-checkpoint-20260927T130837Z/BP_CodexAuthoringProbe.uasset'); bytes=834972; sha256='4a19924a8bb305d5e449e851c508fb7d0cafeccce8961e77f2a351f627583b32' },
    @{ path=(Join-Path $taskRoot 'artifacts/phase-b-scratch-saved-checkpoint-20260927T130837Z/CHECKPOINT.json'); bytes=1243; sha256='b541badb5652984f6e339702cfc7ba56458d5957d4812593e4761e51db8b3496' },
    @{ path=$taskSource; bytes=863483; sha256='c41690b43992a6713b0fd6babef819d757e829f8a8a40b81917b12783598caa6' },
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
    Assert-TaskPath $taskRun
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
    foreach ($taskName in @('ProofB0ClassPathConversion')) {
        $taskCandidate = Join-Path $taskProof ($taskName + '.clipboard.txt')
        Assert-TaskPath $taskCandidate
        if ((Get-Item -LiteralPath $taskCandidate).Length -ne $taskSpecs[$taskName].bytes -or
            (Get-FileHash -LiteralPath $taskCandidate -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskSpecs[$taskName].sha256) {
            throw 'Frozen candidate changed.'
        }
    }
}

Assert-TaskIdentity
if (@(Get-ChildItem -LiteralPath $taskRun -Force | Where-Object { $_.Name -in @([IO.Path]::GetFileName($taskReceipt), [IO.Path]::GetFileName($taskClaim)) }).Count -gt 0) { throw 'Staging receipt or claim pathname already exists; no clipboard action.' }
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
    next='Paste this shell once into BP_CodexAuthoringProbe only. Root adds the actual native softclass-to-string converter and connects its output to Return.Path before reachable compile/export review. Do not invoke or save. Preserve failed diagnostic Capture unchanged. Baseline exports are historical, not current live-state assertions.'
}
$taskReceiptStream = [IO.File]::Open($taskReceipt, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
try {
    $taskReceiptBytes = $taskEncoding.GetBytes(($taskRecord | ConvertTo-Json))
    $taskReceiptStream.Write($taskReceiptBytes, 0, $taskReceiptBytes.Length)
} finally { $taskReceiptStream.Dispose() }
$taskRecord | ConvertTo-Json
