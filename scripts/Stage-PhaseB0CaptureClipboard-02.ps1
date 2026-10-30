# Stage corrected CaptureB0Snapshot candidate02 only; previous candidate was never imported.
$Function = 'CaptureB0Snapshot'
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskProof = Join-Path $taskRoot 'research/evidence/phase-b0-capture-candidate-20260927-02'
$taskRun = Join-Path $taskRoot 'research/evidence/phase-b0-capture-native-01'
$taskPayload = Join-Path $taskProof ($Function + '.clipboard.txt')
$taskReceipt = Join-Path $taskRun ($Function + '.clipboard-stage.json')
$taskClaim = Join-Path $taskRun ($Function + '.clipboard-stage.started.json')
$taskSpec = @{ bytes=538301; sha256='92018c935f16d72599711badb0f372f2a2f3475c3cf58c5979eda2873f8ed9f2' }
$taskPins = @(
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\scripts\Prepare-PhaseB0Capture.py'; bytes=38883; sha256='64042924099538d8101b5630ee121db3a5dbd974e1f2ce715b62694d7854e2b9' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\scripts\PhaseBBlueprintAssembly.py'; bytes=17128; sha256='385db1e4aec7276a5a8a3ad8262ac5b8e641f2082ff207d13332b4cb552176f0' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\scripts\Prepare-PhaseBTextFunctions.py'; bytes=13301; sha256='155dd012f6a90afb4cf08aee141ee34ddf68408c0741bb970ff702ffd8c5b977' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\phase-b0-capture-candidate-20260927-02\CaptureB0Snapshot.graph.json'; bytes=1265214; sha256='b2e211e4910f3c3f3d693cde3ee2db3b6c3bc3da361cbf676c7d59da33c1ef6b' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\phase-b0-capture-candidate-20260927-02\PREPARATION.json'; bytes=3494; sha256='a52acd9db865f30206c2d685b99d3a73e5b8d2da5c6a58a02048e7449e721830' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\phase-b0-capture-candidate-20260927-02\independent-review.json'; bytes=4592; sha256='8e1b845d06dd861e7be4a56120db350cb7b4fc7c52946074aca41d6d779eed96' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\phase-b0-capture-output-correction-20260927-01\MOCK_RESULT.json'; bytes=4339; sha256='82a2376eea39c80067eb1adac351f5b3abf25ffdd85337c8c352e55c0ae6fceb' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\phase-b0-destination-bindings-native-01\capture-bindings.json'; bytes=3613; sha256='777c47ca929fee7d0cbb0ed11471d0389f960bff90bf08d62e1da482ce7144b4' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\phase-b0-destination-bindings-native-01\controller.COPY'; bytes=541137; sha256='13e689068052a740b53d04db9f93ae5fb3d1f7d062277452e5daa744e44277e7' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\phase-b0-destination-bindings-native-01\native-bindings-review.json'; bytes=62734; sha256='0dca33892cddd5ecba8d6ff2b627f9fa15ecba988ae072eb0b516b46675c7dd3' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\phase-b0-destination-bindings-native-01\protected-inputs.json'; bytes=17443; sha256='08694e522ae70179717dbfc722b31d169d8820c99b5e70eb5895ef362a2c4050' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\phase-b0-destination-bindings-20260927-01\preparation.json'; bytes=64771; sha256='5e8bbe917fdd170608a19231ab17291973d073fdff5c5ed3f3ef1c424ba76044' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\phase-b0-destination-bindings-20260927-01\independent-payload-review.json'; bytes=5602; sha256='aa2efdc1918f1e8ef78d7286a39e4a69a6994407acf16ff766f14f8c7351b594' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\phase-b0-destination-bindings-20260927-01\binding-unit.json'; bytes=4576; sha256='f1796d7f0102223228ef4fda8d5dd37a6f8e0f3b0805f646f84395c4d2a8ac74' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\scripts\Prepare-PhaseB0DestinationBindings.py'; bytes=11736; sha256='975d0df9cc204d8c927b01f7b34b4fe52ab35dead70260cb241a853edbf411cd' },
    @{ path='C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Plugins\LanceObserverDiagnosticControl\ActiveMod.txt'; bytes=0; sha256='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
    @{ path='C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Plugins\LanceObserverDiagnosticControl\Config\Input\LanceObserverDiagnosticControlInput.ini'; bytes=1498; sha256='d1a5492fcb7e0ad41d8f4eb15e953fd0032e174510f3db89a74fec5901dbbd3f' },
    @{ path='C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Plugins\LanceObserverDiagnosticControl\Config\Tags\LanceObserverDiagnosticControlTags.ini'; bytes=43; sha256='ad7f8b6d4415fb7edb4d52e83942a67c66313da7ea504e6196679db31b147e1b' },
    @{ path='C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Plugins\LanceObserverDiagnosticControl\Content\WBP_ObserverDiagnosticControl.uasset'; bytes=30768; sha256='80f52bb21156b638ca22d6c8ab778bfcfc7a6feb1f26286977a3324ac5978b4b' },
    @{ path='C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Plugins\LanceObserverDiagnosticControl\LanceObserverDiagnosticControl.uplugin'; bytes=389; sha256='52b5bef1004246ac5377e81d9508579393be258f9c5477cf3626ee4c33cf1c79' },
    @{ path='C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Plugins\LanceObserverDiagnosticControl\mod.json'; bytes=532; sha256='24ae37d564c49cf345b0edec5f6a834a5a018ccee6a99f4628c8e4b898efd5af' },
    @{ path='C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Plugins\LanceObserverDiagnosticControl\ModOverride\Modes\InstantAction\InstantActionPlayerController.uasset'; bytes=92019; sha256='ba725129011767a82935bd36a811ce2583bfebbfbbd8c4b2cff3fcbc1ca14948' },
    @{ path='C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Plugins\LanceObserverDiagnosticControl\Resources\Icon128.png'; bytes=12352; sha256='ec157f56f486e5a68fd4b27df6c88fecdb1b8f9bfff18aa5ef10a21bca6a4c5e' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\artifacts\LanceObserverDiagnosticControl\package-20260927-01\LanceObserverDiagnosticControl\mod.json'; bytes=532; sha256='24ae37d564c49cf345b0edec5f6a834a5a018ccee6a99f4628c8e4b898efd5af' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\artifacts\LanceObserverDiagnosticControl\package-20260927-01\LanceObserverDiagnosticControl\Paks\LanceObserverDiagnosticControl.pak'; bytes=20780; sha256='0162669d380166bc94244412fb2212d4d5145b20410f01742517f581f6bb1722' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\artifacts\LanceObserverDiagnosticControl\package-20260927-01\LanceObserverDiagnosticControl\Resources\Icon128.png'; bytes=12352; sha256='ec157f56f486e5a68fd4b27df6c88fecdb1b8f9bfff18aa5ef10a21bca6a4c5e' },
    @{ path='C:\Program Files (x86)\Steam\steamapps\common\MechWarrior 5 Mercenaries\MW5Mercs\Mods\LanceObserverDiagnosticControl\mod.json'; bytes=532; sha256='24ae37d564c49cf345b0edec5f6a834a5a018ccee6a99f4628c8e4b898efd5af' },
    @{ path='C:\Program Files (x86)\Steam\steamapps\common\MechWarrior 5 Mercenaries\MW5Mercs\Mods\LanceObserverDiagnosticControl\Paks\LanceObserverDiagnosticControl.pak'; bytes=20780; sha256='0162669d380166bc94244412fb2212d4d5145b20410f01742517f581f6bb1722' },
    @{ path='C:\Program Files (x86)\Steam\steamapps\common\MechWarrior 5 Mercenaries\MW5Mercs\Mods\LanceObserverDiagnosticControl\Resources\Icon128.png'; bytes=12352; sha256='ec157f56f486e5a68fd4b27df6c88fecdb1b8f9bfff18aa5ef10a21bca6a4c5e' },
    @{ path='C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Plugins\LanceObserverProbe\LanceObserverProbe.uplugin'; bytes=422; sha256='fdee15a050ec0df0a0b54af070c0680e248190d21e10e6ade1efaaddec010a08' },
    @{ path='C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Plugins\LanceObserverProbe\Config\Input\LanceObserverProbeInput.ini'; bytes=1383; sha256='fc21b00d6db183e8434466e27f0f4fc194f7e852f66ce68bc15c9323271aa17d' },
    @{ path='C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Plugins\LanceObserverProbe\Config\Tags\LanceObserverProbeTags.ini'; bytes=43; sha256='ad7f8b6d4415fb7edb4d52e83942a67c66313da7ea504e6196679db31b147e1b' },
    @{ path='C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Plugins\LanceObserverProbe\Content\BP_LanceObserverProbeComponent.uasset'; bytes=139586; sha256='6a364cd8e9a35da959de67c0ab1ac0707a062100083f4503da74aef9ad57913a' },
    @{ path='C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Plugins\LanceObserverProbe\Content\WBP_LanceObserverProbeReadout.uasset'; bytes=31659; sha256='937538d7420b6b810cfaa1b4bfcc2fa5c2f7e50be2eb25ff8a771f0e00564282' },
    @{ path='C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Plugins\LanceObserverProbe\Content\DA_LanceObserverProbeRegistration.uasset'; bytes=2111; sha256='c5c09bbc3f6ee38e18e8ed330f405a6d7aba649a9ca8c4b9aad6581f82a28c35' },
    @{ path='C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Plugins\LanceObserverProbe\Resources\Icon128.png'; bytes=12352; sha256='ec157f56f486e5a68fd4b27df6c88fecdb1b8f9bfff18aa5ef10a21bca6a4c5e' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\artifacts\LanceObserverProbe\package-20260925-01\LanceObserverProbe\mod.json'; bytes=405; sha256='dce8fc883da38b6cafdfd7baf4256ecd350bf9c6c6d621861bc9393e142793a7' },
    @{ path='C:\Program Files (x86)\Steam\steamapps\common\MechWarrior 5 Mercenaries\MW5Mercs\Mods\LanceObserverProbe\mod.json'; bytes=405; sha256='dce8fc883da38b6cafdfd7baf4256ecd350bf9c6c6d621861bc9393e142793a7' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\artifacts\LanceObserverProbe\package-20260925-01\LanceObserverProbe\Paks\LanceObserverProbe.pak'; bytes=19675; sha256='b913e0f0a8c9f6aa53b8f25e2414f8c700e06fbab0a53bcec5884ab8ce5211d6' },
    @{ path='C:\Program Files (x86)\Steam\steamapps\common\MechWarrior 5 Mercenaries\MW5Mercs\Mods\LanceObserverProbe\Paks\LanceObserverProbe.pak'; bytes=19675; sha256='b913e0f0a8c9f6aa53b8f25e2414f8c700e06fbab0a53bcec5884ab8ce5211d6' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\artifacts\LanceObserverProbe\package-20260925-01\LanceObserverProbe\Resources\Icon128.png'; bytes=12352; sha256='ec157f56f486e5a68fd4b27df6c88fecdb1b8f9bfff18aa5ef10a21bca6a4c5e' },
    @{ path='C:\Program Files (x86)\Steam\steamapps\common\MechWarrior 5 Mercenaries\MW5Mercs\Mods\LanceObserverProbe\Resources\Icon128.png'; bytes=12352; sha256='ec157f56f486e5a68fd4b27df6c88fecdb1b8f9bfff18aa5ef10a21bca6a4c5e' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\editor-source\diagnostic-final-source-20260925T221745Z-530263a1\controller-source.COPY'; bytes=97628; sha256='1c46d0589b6c79342fcba90857d0ea1970d463325a9eeb00a31e86fbd2afa0db' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\editor-source\diagnostic-final-source-20260925T221745Z-530263a1\widget-source.COPY'; bytes=33486; sha256='f74f506601b395e34036d4e417a9c82ef4acaacd8587f8df7fc3dd1f4b9f7ee6' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\editor-authored\LanceObserverDiagnosticControl-20260925T222809Z-548b77b2-source-checkpoint\content\ModOverride\Modes\InstantAction\InstantActionPlayerController.uasset'; bytes=92019; sha256='ba725129011767a82935bd36a811ce2583bfebbfbbd8c4b2cff3fcbc1ca14948' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\editor-authored\LanceObserverDiagnosticControl-20260925T222809Z-548b77b2-source-checkpoint\content\Content\WBP_ObserverDiagnosticControl.uasset'; bytes=30768; sha256='80f52bb21156b638ca22d6c8ab778bfcfc7a6feb1f26286977a3324ac5978b4b' },
    @{ path='C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Content\Modes\InstantAction\InstantActionPlayerController.uasset'; bytes=53635; sha256='7107745a8de461275a7acfa1f3ffc5be9bcb7002682c37b7705af5f00783e4f6' },
    @{ path=(Join-Path $taskRoot 'research/evidence/phase-b0-destination-baseline-native-01/controller.COPY'); bytes=97231; sha256='726f5413e4166d7ff5dcc0e67469e95610b3b954d9a06cc0526251df77ba031a' },
    @{ path=(Join-Path $taskRoot 'research/evidence/phase-b0-destination-baseline-native-01/widget.COPY'); bytes=33292; sha256='4511e9da9711f3b44908c0dc1bc2d93916e5db41f7fa19fe03b7ef878145130b' },
    @{ path=(Join-Path $taskRoot 'research/evidence/phase-b0-destination-baseline-native-01/native-baseline-review.json'); bytes=26212; sha256='102be95ba4e14a57a3b7216963645aab939f712eb40c1b2a6f5ad69bb660a017' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\phase-b0-destination-baseline-native-01\baseline.result.json'; bytes=1621; sha256='ed690687be76a36c366d952fad386810e89bb2091b39c3c640a491befa0d871a' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\phase-b0-destination-bindings-native-01\dormant-body-independent-review.json'; bytes=3121; sha256='7242edcd0357923c4eaa171ca1c1275a3df7336a4503f2b3a556442081706993' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\phase-b0-destination-bindings-20260927-01\routing-binding-addendum.json'; bytes=1523; sha256='90f05eb8ce0c64a33298203603f159895bfe2112fefbbef3abb044608916d384' }
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
    Assert-TaskPath $taskPayload
    if ((Get-Item -LiteralPath $taskPayload).Length -ne $taskSpec.bytes -or
        (Get-FileHash -LiteralPath $taskPayload -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskSpec.sha256) {
        throw 'Frozen candidate changed.'
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
$taskEnvelope = 'BPGraph(GraphName="CaptureB0Snapshot",GraphType=GT_Function,'
if (-not $taskText.StartsWith($taskEnvelope) -or $taskEncoding.GetByteCount($taskText) -ne $taskSpec.bytes) {
    throw 'Wrong fixed payload envelope or encoding.'
}
$taskStart = [DateTime]::UtcNow.ToString('o')
$taskClaimStream = [IO.File]::Open($taskClaim, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
try {
    $taskClaimBytes = $taskEncoding.GetBytes((@{ utc=$taskStart; function=$Function; action='Stage the exact reviewed CaptureB0Snapshot candidate'; sha256=$taskSpec.sha256 } | ConvertTo-Json))
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
    next='Paste this whole function once into the freshly reviewed exact diagnostic override. Preserve existing event wiring. Collect one disconnected native CaptureB0Snapshot caller, then compile/export/review; no save or invocation.'
}
$taskReceiptStream = [IO.File]::Open($taskReceipt, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
try {
    $taskReceiptBytes = $taskEncoding.GetBytes(($taskRecord | ConvertTo-Json))
    $taskReceiptStream.Write($taskReceiptBytes, 0, $taskReceiptBytes.Length)
} finally { $taskReceiptStream.Dispose() }
$taskRecord | ConvertTo-Json
