<#
Read-only post-install evidence collector. Writes JSON to stdout only.
Does not start Epic/editor/game, install, repair, change settings, or scan assets.
Readiness means metadata can be reviewed, never compatibility or gameplay PASS.
#>
[CmdletBinding()]
param(
    [string]$EditorRoot = 'C:\Program Files\Epic Games\MechWarrior5Editor',
    [string]$RetailRoot = 'C:\Program Files (x86)\Steam\steamapps\common\MechWarrior 5 Mercenaries'
)

$ErrorActionPreference = 'Stop'
$editorPath = [IO.Path]::GetFullPath($EditorRoot).TrimEnd('\')
$retailPath = [IO.Path]::GetFullPath($RetailRoot).TrimEnd('\')
$inspectionErrors = [Collections.Generic.List[string]]::new()

function Read-SmallJson([string]$Path) {
    try {
        if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
        if ((Get-Item -LiteralPath $Path).Length -gt 8MB) {
            throw 'Metadata exceeds the 8 MiB inspection limit.'
        }
        return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    } catch {
        $inspectionErrors.Add("${Path}: $($_.Exception.Message)")
        return $null
    }
}

function Same-Path([string]$Candidate, [string]$Expected) {
    if ([string]::IsNullOrWhiteSpace($Candidate)) { return $false }
    try { return [IO.Path]::GetFullPath($Candidate).TrimEnd('\') -ieq $Expected }
    catch { return $false }
}

function Fingerprint([string]$Path) {
    try {
        $item = Get-Item -LiteralPath $Path
        if ($item.Length -gt 8MB) { throw 'Metadata exceeds the 8 MiB inspection limit.' }
        [pscustomobject]@{
            path = $item.FullName
            bytes = $item.Length
            last_write_utc = $item.LastWriteTimeUtc.ToString('o')
            sha256 = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
        }
    } catch {
        $inspectionErrors.Add("${Path}: $($_.Exception.Message)")
    }
}

function Test-MetadataPath([string]$Path, [string]$PathType) {
    try { return Test-Path -LiteralPath $Path -PathType $PathType }
    catch {
        $inspectionErrors.Add("${Path}: $($_.Exception.Message)")
        return $false
    }
}

function Get-MetadataFiles([string]$Path, [string]$Filter) {
    try {
        if (Test-Path -LiteralPath $Path -PathType Container) {
            Get-ChildItem -LiteralPath $Path -File -Filter $Filter
        }
    } catch {
        $inspectionErrors.Add("${Path}: $($_.Exception.Message)")
    }
}

function Test-EngineVersion($Version) {
    if ($null -eq $Version) { return $false }
    foreach ($field in @('MajorVersion', 'MinorVersion', 'PatchVersion')) {
        $value = $Version.$field
        if ($null -eq $value -or $value -is [bool]) { return $false }
        $number = 0
        if (-not [int]::TryParse([string]$value, [ref]$number) -or $number -lt 0) { return $false }
        if ($field -eq 'MajorVersion' -and $number -eq 0) { return $false }
    }
    return $true
}

$launcherPath = 'C:\ProgramData\Epic\UnrealEngineLauncher\LauncherInstalled.dat'
$manifestDirectory = 'C:\ProgramData\Epic\EpicGamesLauncher\Data\Manifests'
$launcher = Read-SmallJson $launcherPath
$registeredEntries = @($launcher.InstallationList | Where-Object { Same-Path $_.InstallLocation $editorPath })
$editorManifests = @()
foreach ($item in @(Get-MetadataFiles $manifestDirectory '*.item')) {
    $manifest = Read-SmallJson $item.FullName
    if ($null -ne $manifest -and (Same-Path $manifest.InstallLocation $editorPath)) {
        $editorManifests += [pscustomobject]@{
            manifest_path = $item.FullName
            display_name = $manifest.DisplayName
            app_name = $manifest.AppName
            catalog_item_id = $manifest.CatalogItemId
            catalog_namespace = $manifest.CatalogNamespace
            version = $manifest.AppVersionString
            install_location = $manifest.InstallLocation
            incomplete = $manifest.bIsIncompleteInstall
            declared_install_bytes = $manifest.InstallSize
        }
    }
}

$completeManifest = @($editorManifests | Where-Object { $_.incomplete -is [bool] -and $_.incomplete -eq $false })
$completionRecorded = $registeredEntries.Count -eq 1 -and $editorManifests.Count -eq 1 -and $completeManifest.Count -eq 1
$engineVersion = $null
$projectFiles = @()
$metadataFiles = @()
$pluginDescriptors = @()
$editorExePresent = Test-MetadataPath (Join-Path $editorPath 'Engine\Binaries\Win64\UE4Editor.exe') 'Leaf'

# Do not hash/read installer payload while it is still being assembled.
if ($completionRecorded) {
    $metadataFiles += Fingerprint $editorManifests[0].manifest_path
    $engineVersionPath = Join-Path $editorPath 'Engine\Build\Build.version'
    $engineVersion = Read-SmallJson $engineVersionPath
    if ($null -ne $engineVersion) { $metadataFiles += Fingerprint $engineVersionPath }
    foreach ($projectDirectory in @($editorPath, (Join-Path $editorPath 'MW5Mercs'))) {
        foreach ($project in @(Get-MetadataFiles $projectDirectory '*.uproject')) {
            $projectJson = Read-SmallJson $project.FullName
            if ($null -ne $projectJson) {
                $projectFiles += [pscustomobject]@{
                    path = $project.FullName
                    engine_association = $projectJson.EngineAssociation
                    file_version = $projectJson.FileVersion
                    modules = @($projectJson.Modules | Select-Object Name,Type,LoadingPhase)
                }
                $metadataFiles += Fingerprint $project.FullName
            }
        }
    }
    foreach ($pluginDirectory in @('MW5Mercs\Plugins\VictoryPlugin','MW5Mercs\Plugins\LowEntryJson')) {
        $pluginPath = Join-Path $editorPath $pluginDirectory
        foreach ($descriptor in @(Get-MetadataFiles $pluginPath '*.uplugin')) {
            $pluginJson = Read-SmallJson $descriptor.FullName
            if ($null -ne $pluginJson) {
                $pluginDescriptors += [pscustomobject]@{
                    path = $descriptor.FullName
                    version = $pluginJson.Version
                    version_name = $pluginJson.VersionName
                    modules = @($pluginJson.Modules | Select-Object Name,Type,LoadingPhase)
                }
                $metadataFiles += Fingerprint $descriptor.FullName
            }
        }
    }
}

$retailReceiptPath = Join-Path $retailPath 'MW5Mercs\Binaries\Win64\MechWarrior-Win64-Shipping.target'
$retailReceipt = Read-SmallJson $retailReceiptPath
$driveRoot = [IO.Path]::GetPathRoot($editorPath)
$freeBytes = $null
try {
    $drive = [IO.DriveInfo]::new($driveRoot)
    if ($drive.IsReady) { $freeBytes = $drive.AvailableFreeSpace }
} catch { $inspectionErrors.Add("${driveRoot}: $($_.Exception.Message)") }
$editorRootExists = Test-MetadataPath $editorPath 'Container'
$stagingPresent = Test-MetadataPath (Join-Path $editorPath '.egstore') 'Container'
$versionMetadataUsable = (Test-EngineVersion $engineVersion) -and (Test-EngineVersion $retailReceipt.Version)
$status = 'INSTALLATION_NOT_CONFIRMED'
if ($completionRecorded) { $status = 'INSTALLED_METADATA_REVIEW_REQUIRED' }
if ($completionRecorded -and $versionMetadataUsable -and $projectFiles.Count -gt 0 -and $editorExePresent -and $inspectionErrors.Count -eq 0) {
    $status = 'READY_FOR_VERSION_REVIEW'
}

[pscustomobject]@{
    schema_version = 1
    observed_at = (Get-Date).ToString('o')
    status = $status
    editor_root = $editorPath
    editor_root_exists = $editorRootExists
    staging_directory_present = $stagingPresent
    launcher_registered_entries = $registeredEntries.Count
    manifests = $editorManifests
    expected_editor_executable_present = $editorExePresent
    editor_engine_version = $engineVersion
    projects = $projectFiles
    plugin_descriptors = $pluginDescriptors
    metadata_fingerprints = $metadataFiles
    retail_receipt_engine_version = $retailReceipt.Version
    version_metadata_usable = $versionMetadataUsable
    drive = $driveRoot
    free_bytes = $freeBytes
    errors = @($inspectionErrors)
    limits = @(
        'An active download can create .egstore before registration; its presence is not completion.',
        'Manifest and expected file presence are not full package-integrity or launch validation.',
        'Editor/game BuildIds need not match; matching engine versions alone do not establish compatibility.',
        'Only named metadata locations are inspected. Missing expected paths require bounded discovery, not guessed conclusions.',
        'Free bytes during installation do not reveal remaining allocation or peak staging demand.',
        'No game/editor launch, asset parsing, cloud calls, save access or settings changes are performed.'
    )
} | ConvertTo-Json -Depth 10
