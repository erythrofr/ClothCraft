# Packages an already-built Windows x64 ClothCraft preview into a portable ZIP.
# No installer, elevation, signing, registry edits, or network access required.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Destination,
    [string]$BinariesDirectory = '',
    [string]$Revision = '',
    [switch]$Verify,
    [switch]$UiSmoke
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ($UiSmoke -and -not $Verify) {
    throw '-UiSmoke requires -Verify so it runs from a freshly extracted package.'
}
$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
if (-not $BinariesDirectory) { $BinariesDirectory = Join-Path $repo 'target/release' }
$binDir = [System.IO.Path]::GetFullPath($BinariesDirectory)
$stage = [System.IO.Path]::GetFullPath($Destination).TrimEnd([char[]]'\/')
$zip = "$stage.zip"
$zipHash = "$zip.sha256"
$verifyRoot = "$stage.verify"

# A destination inside a recursively copied source would copy itself forever.
foreach ($source in @('assets/makehuman', 'examples/templates')) {
    $sourceRoot = [System.IO.Path]::GetFullPath((Join-Path $repo $source))
    if ($stage.Equals($sourceRoot, [StringComparison]::OrdinalIgnoreCase) -or
        $stage.StartsWith($sourceRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Destination must not be inside a packaged source: $sourceRoot"
    }
}

# Never overwrite an existing installation or an earlier package artifact.
foreach ($path in @($stage, $zip, $zipHash)) {
    if (Test-Path -LiteralPath $path) { throw "Refusing to overwrite existing path: $path" }
}
if ($Verify -and (Test-Path -LiteralPath $verifyRoot)) {
    throw "Refusing to overwrite verification directory: $verifyRoot"
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
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($stage, $zip)
$archiveDigest = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
[System.IO.File]::WriteAllText($zipHash, "$archiveDigest  $([System.IO.Path]::GetFileName($zip))`n", $utf8)

function Invoke-PackagedClothFit {
    param(
        [Parameter(Mandatory = $true)][string]$Label,
        [Parameter(Mandatory = $true)][string[]]$EditorArguments,
        [int]$TimeoutSeconds = 180
    )
    $exe = Join-Path $verifyRoot 'cloth-fit.exe'
    $stdout = Join-Path $verifyRoot "$Label.out.log"
    $stderr = Join-Path $verifyRoot "$Label.err.log"
    $quotedArguments = ($EditorArguments | ForEach-Object {
        if ($_ -match '\s') { '"' + $_ + '"' } else { $_ }
    }) -join ' '
    $process = Start-Process -FilePath $exe -ArgumentList $quotedArguments `
        -WorkingDirectory $verifyRoot -PassThru -NoNewWindow `
        -RedirectStandardOutput $stdout -RedirectStandardError $stderr
    if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
        $process.Kill()
        $process.WaitForExit()
        throw "$Label timed out after $TimeoutSeconds seconds; see $stdout and $stderr"
    }
    if ($process.ExitCode -ne 0) {
        throw "$Label failed with exit code $($process.ExitCode); see $stdout and $stderr"
    }
}

if ($Verify) {
    $expected = (Get-Content -LiteralPath $zipHash -Raw).Substring(0, 64)
    if ((Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) {
        throw 'Archive checksum mismatch'
    }
    [System.IO.Compression.ZipFile]::ExtractToDirectory($zip, $verifyRoot)
    $seen = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    foreach ($line in Get-Content -LiteralPath (Join-Path $verifyRoot 'SHA256SUMS.txt')) {
        if ($line -notmatch '^([0-9a-f]{64})  (.+)$') { throw "Invalid manifest record: $line" }
        $expectedHash = $Matches[1]
        $relative = $Matches[2]
        $payload = [IO.Path]::GetFullPath((Join-Path $verifyRoot $relative))
        if (-not $payload.StartsWith($verifyRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
            throw "Manifest path escapes package: $relative"
        }
        if (-not $seen.Add($relative)) { throw "Duplicate manifest path: $relative" }
        if ((Get-FileHash -LiteralPath $payload -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedHash) {
            throw "Payload checksum mismatch: $relative"
        }
    }
    $payloadCount = @(Get-ChildItem -LiteralPath $verifyRoot -File -Recurse |
        Where-Object { $_.FullName -ne (Join-Path $verifyRoot 'SHA256SUMS.txt') }).Count
    if ($payloadCount -ne $seen.Count) { throw 'Manifest does not cover exactly the package payload' }
    Push-Location -LiteralPath $verifyRoot
    try {
        $exe = Join-Path $verifyRoot 'cloth-template.exe'
        & $exe validate 'examples/templates/two-panel.json'
        if ($LASTEXITCODE -ne 0) { throw 'Extracted binary failed to validate the bundled template' }
        & $exe example 'Verification Pattern.json'
        if ($LASTEXITCODE -ne 0) { throw 'Extracted binary failed to write a new template' }
        & $exe validate 'Verification Pattern.json'
        if ($LASTEXITCODE -ne 0) { throw 'Extracted binary failed to reopen its template' }
    } finally {
        Pop-Location
    }
    Write-Host "Verified $($seen.Count) payload hashes and extracted CPU example write/reopen."

    if ($UiSmoke) {
        # This is an explicit, opt-in native-window check. It is not part of the
        # ordinary CPU test suite and does not certify a particular GPU or driver.
        $env:WGPU_BACKEND = 'dx12'
        Push-Location -LiteralPath $verifyRoot
        try {
            # The CLI writes the output document before any editor starts. These
            # files prove a CLI write/load plus a native launch/capture; they are
            # not evidence of native Save or Export.
            $seedOutput = Join-Path $verifyRoot 'ui-project-seed'
            Invoke-PackagedClothFit -Label 'ui-project-seed' `
                -EditorArguments @('--steps', '0', '--threads', '2', '--output', $seedOutput)
            $seedProject = Join-Path $seedOutput 'fitting-project.json'
            if (-not (Test-Path -LiteralPath $seedProject -PathType Leaf)) {
                throw "CLI project seed did not write fitting-project.json in $seedOutput"
            }

            $launchOutput = Join-Path $verifyRoot 'ui-smoke'
            Invoke-PackagedClothFit -Label 'ui-smoke' `
                -EditorArguments @('--steps', '0', '--threads', '2', '--project', $seedProject, '--ui-smoke', '--output', $launchOutput)
            foreach ($required in @('ui.png', 'fitting-project.json')) {
                if (-not (Test-Path -LiteralPath (Join-Path $launchOutput $required) -PathType Leaf)) {
                    throw "Editor launch/capture smoke did not produce $required in $launchOutput"
                }
            }
            Write-Host 'CLI project seed/load and native editor window launch/capture passed.'
            Write-Host 'Native Save/Export/edit is not exercised; adapter/driver certification is separate.'
        } finally {
            Pop-Location
        }
    }
}
Write-Host "Portable staging directory: $stage"
Write-Host "Archive: $zip"
Write-Host "Archive SHA256: $archiveDigest"
