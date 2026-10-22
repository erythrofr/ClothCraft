# Packages an already-built Windows x64 ClothCraft preview into a portable ZIP.
# No installer, elevation, signing, registry edits, or network access required.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Destination,
    [string]$BinariesDirectory = '',
    [string]$Revision = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
if (-not $BinariesDirectory) { $BinariesDirectory = Join-Path $repo 'target/release' }
$binDir = [System.IO.Path]::GetFullPath($BinariesDirectory)
$stage = [System.IO.Path]::GetFullPath($Destination)
$zip = "$stage.zip"
$zipHash = "$zip.sha256"

# Never overwrite an existing installation or an earlier package artifact.
foreach ($path in @($stage, $zip, $zipHash)) {
    if (Test-Path -LiteralPath $path) { throw "Refusing to overwrite existing path: $path" }
}
foreach ($binary in @('cloth-fit.exe', 'marvelous-cloth.exe', 'cloth-template.exe')) {
    if (-not (Test-Path -LiteralPath (Join-Path $binDir $binary) -PathType Leaf)) {
        throw "Missing Windows release binary: $binary in $binDir. Run cargo build --locked --release --features desktop first."
    }
}
foreach ($path in @('assets/makehuman', 'examples/templates', 'LICENSE', 'README.md', 'docs/install.md')) {
    if (-not (Test-Path -LiteralPath (Join-Path $repo $path))) { throw "Required package input missing: $path" }
}

$null = New-Item -ItemType Directory -Path $stage -Force
foreach ($binary in @('cloth-fit.exe', 'marvelous-cloth.exe', 'cloth-template.exe')) {
    Copy-Item -LiteralPath (Join-Path $binDir $binary) -Destination (Join-Path $stage $binary)
}
$null = New-Item -ItemType Directory -Path (Join-Path $stage 'assets') -Force
$null = New-Item -ItemType Directory -Path (Join-Path $stage 'examples') -Force
$null = New-Item -ItemType Directory -Path (Join-Path $stage 'docs') -Force
Copy-Item -LiteralPath (Join-Path $repo 'assets/makehuman') -Destination (Join-Path $stage 'assets') -Recurse
Copy-Item -LiteralPath (Join-Path $repo 'examples/templates') -Destination (Join-Path $stage 'examples') -Recurse
Copy-Item -LiteralPath (Join-Path $repo 'docs/install.md') -Destination (Join-Path $stage 'docs/install.md')
Copy-Item -LiteralPath (Join-Path $repo 'LICENSE') -Destination $stage
Copy-Item -LiteralPath (Join-Path $repo 'README.md') -Destination $stage

$utf8 = New-Object System.Text.UTF8Encoding($false)
$start = @'
@echo off
cd /d "%~dp0"
"%~dp0cloth-fit.exe" --steps 0 --view --output "%~dp0output\session"
if errorlevel 1 pause
'@
[System.IO.File]::WriteAllText((Join-Path $stage 'Start ClothCraft.cmd'), $start.Replace("`n", "`r`n"), $utf8)

if (-not $Revision) {
    $Revision = (& git -C $repo rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Could not identify source commit' }
}
$version = '0.1.0-preview'
$rustVersion = (& rustc --version)
if ($LASTEXITCODE -ne 0) { throw 'rustc is needed to record the build environment' }
$cargoVersion = (& cargo --version)
if ($LASTEXITCODE -ne 0) { throw 'cargo is needed to record the build environment' }
$info = @(
    'ClothCraft Windows x64 portable preview',
    "Version: $version",
    "Source revision: $Revision",
    "Packaged UTC: $([DateTimeOffset]::UtcNow.ToString('o'))",
    "System: $([System.Environment]::OSVersion.VersionString)",
    "Architecture: $env:PROCESSOR_ARCHITECTURE",
    "Rust: $rustVersion",
    "Cargo: $cargoVersion",
    'License: ClothCraft MIT; bundled MakeHuman files carry their own LICENSE.ASSETS.md',
    'This development bundle is unsigned and has no native GUI/GPU certification.'
) -join "`n"
[System.IO.File]::WriteAllText((Join-Path $stage 'BUILD-INFO.txt'), $info + "`n", $utf8)

# Manifest covers every bundled payload, including provenance, license and build metadata.
$records = foreach ($file in (Get-ChildItem -LiteralPath $stage -Recurse -File | Sort-Object FullName)) {
    $relative = $file.FullName.Substring($stage.Length + 1).Replace('\', '/')
    $digest = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    "$digest  $relative"
}
[System.IO.File]::WriteAllText((Join-Path $stage 'SHA256SUMS.txt'), (($records -join "`n") + "`n"), $utf8)

# Use a flat archive root so the assets are adjacent to the binaries after extraction.
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -CompressionLevel Optimal
$archiveDigest = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
[System.IO.File]::WriteAllText($zipHash, "$archiveDigest  $([System.IO.Path]::GetFileName($zip))`n", $utf8)
Write-Host "Portable staging directory: $stage"
Write-Host "Archive: $zip"
Write-Host "Archive SHA256: $archiveDigest"
