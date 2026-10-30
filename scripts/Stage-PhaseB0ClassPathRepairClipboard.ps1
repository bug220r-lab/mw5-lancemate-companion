# Stage exactly two reviewed class-path repair nodes once; never paste, wire, compile or execute.
# Parent must freshly verify the exact destination Blueprint and CaptureB0Snapshot graph before Paste.
$Function = 'ClassPathRepair'
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskProof = Join-Path $taskRoot 'research/evidence/phase-b0-capture-class-path-repair-20260927-01'
$taskPayload = Join-Path $taskProof 'ClassPathRepair.clipboard.txt'
$taskRun = Join-Path $taskRoot 'research/evidence/phase-b0-capture-class-path-repair-native-01'
$taskReceipt = Join-Path $taskRun 'ClassPathRepair.clipboard-stage.json'
$taskClaim = Join-Path $taskRun 'ClassPathRepair.clipboard-stage.started.json'
$taskSpecs = @{ ClassPathRepair = @{ bytes=3974; sha256='2d3815b6ed3b5bd61802f0eab53204c1b10f8d1a92d5f30a668eb43712b2b8b3' } }
$taskSpec = $taskSpecs[$Function]
$taskDestination = '/ModOverride/LanceObserverDiagnosticControl/Modes/InstantAction/InstantActionPlayerController.InstantActionPlayerController'
$taskGraph = 'CaptureB0Snapshot'
$taskGraphGuid = '4A6C23DA4EFE38754CED1B87414E93A2'
$taskPrepared = [DateTimeOffset]::Parse('2026-09-27T20:40:33+00:00')
$taskExpires = [DateTimeOffset]::Parse('2026-09-27T22:10:33+00:00')
$taskPins = @(
    @{ path='C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Plugins\LanceObserverDiagnosticControl\ActiveMod.txt'; bytes=0; sha256='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
    @{ path='C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Plugins\LanceObserverDiagnosticControl\Config\Input\LanceObserverDiagnosticControlInput.ini'; bytes=1498; sha256='d1a5492fcb7e0ad41d8f4eb15e953fd0032e174510f3db89a74fec5901dbbd3f' },
    @{ path='C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Plugins\LanceObserverDiagnosticControl\Config\Tags\LanceObserverDiagnosticControlTags.ini'; bytes=43; sha256='ad7f8b6d4415fb7edb4d52e83942a67c66313da7ea504e6196679db31b147e1b' },
    @{ path='C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Plugins\LanceObserverDiagnosticControl\Content\WBP_ObserverDiagnosticControl.uasset'; bytes=30988; sha256='b88cd0e66b357f5ad8105d7d3bb88768b98548cde39e1c9024143f4ad55c548e' },
    @{ path='C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Plugins\LanceObserverDiagnosticControl\LanceObserverDiagnosticControl.uplugin'; bytes=389; sha256='52b5bef1004246ac5377e81d9508579393be258f9c5477cf3626ee4c33cf1c79' },
    @{ path='C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Plugins\LanceObserverDiagnosticControl\mod.json'; bytes=566; sha256='a1bc281bc1b3353d452f7a283ddd24df0378601f0711b4334a72d5df508c127f' },
    @{ path='C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Plugins\LanceObserverDiagnosticControl\ModOverride\Modes\InstantAction\InstantActionPlayerController.uasset'; bytes=858374; sha256='8f5bce1043baab3ec98c2c8eebc49e5d7dbb52defd29ca9ca4268925aad31313' },
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
    @{ path='C:\Program Files\Epic Games\MechWarrior5Editor\MW5Mercs\Plugins\LanceObserverDiagnosticControl\ModOverride\CodexEditorControlScratch20260925\BP_CodexAuthoringProbe.uasset'; bytes=864926; sha256='b6ba981899f49b47c77719822289d7d95344275214de38b365fe3451d80badec' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\artifacts\phase-b0-user-saved-resume-20260927T200945Z\WBP_ObserverDiagnosticControl.uasset'; bytes=30988; sha256='b88cd0e66b357f5ad8105d7d3bb88768b98548cde39e1c9024143f4ad55c548e' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\artifacts\phase-b0-user-saved-resume-20260927T200945Z\mod.json'; bytes=566; sha256='a1bc281bc1b3353d452f7a283ddd24df0378601f0711b4334a72d5df508c127f' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\artifacts\phase-b0-user-saved-resume-20260927T200945Z\InstantActionPlayerController.uasset'; bytes=858374; sha256='8f5bce1043baab3ec98c2c8eebc49e5d7dbb52defd29ca9ca4268925aad31313' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\artifacts\phase-b0-user-saved-resume-20260927T200945Z\BP_CodexAuthoringProbe-ModOverride.uasset'; bytes=864926; sha256='b6ba981899f49b47c77719822289d7d95344275214de38b365fe3451d80badec' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\artifacts\phase-b0-user-saved-resume-20260927T200945Z\TitleScreen_Video.umap'; bytes=39398; sha256='9a928a35ef23cdbdd6d1f9e1c7e7f15c846593ae60f9e6371da0b9b099ab3679' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\artifacts\phase-b0-scratch-saved-checkpoint-20260927T134956Z\BP_CodexAuthoringProbe.uasset'; bytes=863483; sha256='c41690b43992a6713b0fd6babef819d757e829f8a8a40b81917b12783598caa6' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\artifacts\phase-b-scratch-saved-checkpoint-20260927T130837Z\BP_CodexAuthoringProbe.uasset'; bytes=834972; sha256='4a19924a8bb305d5e449e851c508fb7d0cafeccce8961e77f2a351f627583b32' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\artifacts\editor-authoring-probe-20260925\BP_CodexAuthoringProbe.uasset'; bytes=28153; sha256='0b7d06f0004d67d1944cd288b44a4b63d7f95d4e17de22b8ee828f4f96f0b6dc' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\phase-b0-resume-source-native-01\protected-inputs.json'; bytes=28563; sha256='57be0f75fb80c97ff910ec75ea39404c6bb1badb7a40cae0c275cb4b208038df' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\artifacts\phase-b0-user-saved-resume-20260927T200945Z\CHECKPOINT.json'; bytes=4460; sha256='5a93f5a4d220a49a9fddd7ad4a835d6746d55f7bcae647d652d9a934d1000a7e' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\scripts\Prepare-PhaseB0ClassPathRepair.py'; bytes=8342; sha256='85021c464ddf57f853cee5e40a8858295ca2f125c286ed479cdfea5b6cb2b511' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\scripts\Prepare-PhaseB0Capture.py'; bytes=42830; sha256='43e6b08617a6365c4fe6e16e3ee80da896f5a95888c08c10d240961e7cf68644' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\scripts\Test-PhaseB0Capture.py'; bytes=28595; sha256='5ad5f71b9f1e80847a623d768513f67b4e3e19e997097a9793a5a00032b04062' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\phase-b0-capture-class-path-repair-20260927-01\repair-preparation.json'; bytes=6518; sha256='3d1af7e4be039efce5bb40db88ed158816f12da43fa70feb41821be7983c6a4c' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\phase-b0-capture-class-path-repair-20260927-01\repair-independent-review.json'; bytes=3907; sha256='7e9abca210354df88d46d4a679831441ce72b86b5009c643455299f87a857533' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\phase-b0-capture-class-path-repair-20260927-01\MOCK_RESULT.json'; bytes=4792; sha256='aa7f8ea08e6400a6146bb19462a05d8577b85f16cd50ed3d67bb0d963a60cc5f' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\phase-b0-capture-class-path-repair-20260927-01\CaptureB0Snapshot.repaired-draft.graph.json'; bytes=1269878; sha256='a0e314bae5ada0c62ded6ce4233471cd275a3c72bda55e50e83e646b0cfecfb9' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\phase-b0-class-path-scratch-compiled-20260927-01\ProofB0ClassPathConversion.native.clipboard.txt'; bytes=7807; sha256='fa96d5f904d990399354252125d4620a125df4ce1e05c806cac26fc0b94a5054' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\phase-b0-class-path-scratch-compiled-20260927-01\native-chain-review.json'; bytes=5240; sha256='da1403abbfed1908a5483d4d294de8db6aea3bed5f19f3ec2c56b73bdd519022' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\phase-b0-native-class-path-converter-20260927-02\native-result-review.json'; bytes=4808; sha256='23b8a35a420a0c962b9bdcf5ddcb7837c228b1515c10877d36794a07b41077da' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\phase-b0-resume-source-native-01\controller.COPY'; bytes=1112060; sha256='dd31fb6e77953cffe08edec0918d61d849655acc646f07fd112b9a8bdd5e2877' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\phase-b0-resume-source-native-01\widget.COPY'; bytes=33538; sha256='e0f4eb8b0efd1e7e8bac5172ac3a58c15e94cd68b01652cd04c309d21957e86e' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\phase-b0-resume-source-native-01\resume.result.json'; bytes=2224; sha256='748642514714d1662bf3c23e18a898cdb5aac37e8c10fe4e0b327aa08f17744b' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\phase-b0-resume-source-native-01\native-controller-widget-review.json'; bytes=6408; sha256='a3513eb88a4938518877f4d6103abbb16c30fefd8fd03a75da2c9eb47388f1e4' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\phase-b0-capture-failure-native-01\controller.COPY'; bytes=1111868; sha256='e2f5a8b4a2b57cee485e69a7d08f21954d8bf105ff53bfcc3c7238ed5334ab33' },
    @{ path='C:\Users\jlewi\OneDrive\Documents\ChatGPT\MW5 LANCEMATE COMPANION\research\evidence\phase-b0-capture-failure-native-01\native-failure-source-review.json'; bytes=87753; sha256='480783db8a9fada1239c4ca40fb1646926ded84d62f3904af32a1e80f92971ae' }
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

function Assert-TaskTime {
    $taskNow = [DateTimeOffset]::UtcNow
    if ($taskNow -lt $taskPrepared -or $taskNow -gt $taskExpires) { throw 'Staging time window is not current; no clipboard action.' }
}

function Assert-TaskIdentity {
    Assert-TaskTime
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
    foreach ($taskName in @('ClassPathRepair')) {
        $taskCandidate = Join-Path $taskProof ($taskName + '.clipboard.txt')
        Assert-TaskPath $taskCandidate
        if ((Get-Item -LiteralPath $taskCandidate).Length -ne $taskSpecs[$taskName].bytes -or
            (Get-FileHash -LiteralPath $taskCandidate -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskSpecs[$taskName].sha256) {
            throw 'Frozen candidate changed.'
        }
    }
    Assert-TaskTime
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
if (-not $taskText.StartsWith('Begin Object Class=/Script/BlueprintGraph.K2Node_ConvertAsset Name="K2Node_ConvertAsset_9500"') -or
    -not $taskText.EndsWith("End Object`r`n") -or
    [regex]::Matches($taskText, '(?m)^Begin Object Class=').Count -ne 2 -or
    $taskText.Contains('BPGraph(') -or $taskEncoding.GetByteCount($taskText) -ne $taskSpec.bytes) {
    throw 'Wrong exact two-node envelope or encoding.'
}
$taskStart = [DateTime]::UtcNow.ToString('o')
$taskClaimStream = [IO.File]::Open($taskClaim, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
try {
    $taskClaimBytes = $taskEncoding.GetBytes((@{ utc=$taskStart; function=$Function; action='Stage exactly two class-path repair nodes; no editor input'; sha256=$taskSpec.sha256 } | ConvertTo-Json))
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
    status='CLIPBOARD_STAGED_HASH_VERIFIED_NOT_PASTED'; fragment=$Function; destination_blueprint=$taskDestination; destination_function=$taskGraph; destination_graph_guid=$taskGraphGuid; expires_utc=$taskExpires.ToString('o');
    started_utc=$taskStart; completed_utc=[DateTime]::UtcNow.ToString('o'); pid=26084;
    process_creation_filetime=134349606362421498; payload=$taskPayload;
    utf8_bytes=$taskSpec.bytes; sha256=$taskActual; editor_input='NOT_PERFORMED';
    native_execution='NOT_PERFORMED'; prior_clipboard='NOT_READ_OR_PRESERVED';
    destination_state='FRESH_UI_RECHECK_REQUIRED';
    next='Root must freshly verify the exact diagnostic controller CaptureB0Snapshot graph, then paste these two nodes once. Retain all 195 old nodes; disconnect both old GetPathName data edges; connect CurrentClass to new ConvertAsset.Input and new converter ReturnValue to StoreClassPath.ClassPath. The internal new edge is already present. Compile and export for independent review. No routing, invocation, save, package or retail step. This helper does not inspect UI or prove clipboard contents at a later Paste.'
}
$taskReceiptStream = [IO.File]::Open($taskReceipt, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
try {
    $taskReceiptBytes = $taskEncoding.GetBytes(($taskRecord | ConvertTo-Json))
    $taskReceiptStream.Write($taskReceiptBytes, 0, $taskReceiptBytes.Length)
} finally { $taskReceiptStream.Dispose() }
$taskRecord | ConvertTo-Json
