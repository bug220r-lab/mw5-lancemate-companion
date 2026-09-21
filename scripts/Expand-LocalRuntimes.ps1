$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$modelRoot = Join-Path $projectRoot 'companion/local/models'
$runtimeRoot = Join-Path $projectRoot 'companion/local/runtimes'
$lock = Get-Content -LiteralPath (Join-Path $projectRoot 'companion/models.lock.json') -Raw | ConvertFrom-Json
$items = @()
foreach ($artifact in $lock.artifacts | Where-Object { $_.id -in @('llama-cpu','whisper-cpu') }) {
  $zipPath = Join-Path $modelRoot $artifact.name
  if ((Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $artifact.sha256) { throw 'ARCHIVE_HASH_MISMATCH' }
  $destination = [IO.Path]::GetFullPath((Join-Path $runtimeRoot ($artifact.id + '-' + $artifact.version)))
  if (-not $destination.StartsWith($runtimeRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'UNSAFE_DESTINATION' }
  $archive = [IO.Compression.ZipFile]::OpenRead($zipPath)
  try {
    $total = ($archive.Entries | Measure-Object -Property Length -Sum).Sum
    if ($total -gt 1GB -or $archive.Entries.Count -gt 512) { throw 'ARCHIVE_LIMIT' }
    foreach ($entry in $archive.Entries) {
      $target = [IO.Path]::GetFullPath((Join-Path $destination $entry.FullName))
      if (-not $target.StartsWith($destination + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'UNSAFE_ARCHIVE_ENTRY' }
      if ([string]::IsNullOrEmpty($entry.Name)) { [void][IO.Directory]::CreateDirectory($target); continue }
      [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target))
      if (Test-Path -LiteralPath $target) { throw ('EXISTING_RUNTIME_REQUIRES_REVIEW: ' + $target) }
      [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $false)
      $items += [ordered]@{ artifact=$artifact.id; path=$target.Substring($projectRoot.Length+1); bytes=$entry.Length; sha256=(Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() }
    }
  } finally { $archive.Dispose() }
}
[ordered]@{ schemaVersion=1; recordedAt=[DateTime]::UtcNow.ToString('o'); execution='NOT_PERFORMED'; files=$items } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $runtimeRoot 'runtime-files.json') -Encoding utf8
Write-Output ('Verified archive extraction: ' + $items.Count + ' files. No executable launched.')
