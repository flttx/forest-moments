$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Push-Location $projectRoot
try {
    foreach ($asset in @('raccoon', 'workshop', 'lookout', 'canoe')) {
        $directory = "assets/lux3d/round-01/$asset"
        $ledger = Join-Path $directory 'ledger.json'
        if (-not (Test-Path -LiteralPath $ledger)) {
            & "$PSScriptRoot/run.ps1" submit "assets/lux3d/round-01/inputs/$asset.png" $directory
            if ($LASTEXITCODE -ne 0) { throw "$asset submission stopped; inspect ledger before any further action." }
        }
        $state = Get-Content -LiteralPath $ledger -Raw | ConvertFrom-Json
        if (-not $state.taskId) { throw "$asset has no confirmed task ID. Reconcile provider history; do not recreate." }
        if ($state.phase -in @('failed', 'cancelled')) { throw "$asset already ended with $($state.phase)." }
        $downloaded = $state.phase -eq 'succeeded' -and $state.files.Count -gt 0
        if ($downloaded) {
            foreach ($file in $state.files) {
                $path = Join-Path $directory $file.filename
                if (-not (Test-Path -LiteralPath $path) -or (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $file.sha256) {
                    $downloaded = $false
                    break
                }
            }
        }
        if ($downloaded) { Write-Output "$asset already downloaded and hash-verified"; continue }
        $complete = $false
        for ($poll = 0; $poll -lt 120; $poll++) {
            & "$PSScriptRoot/run.ps1" status $directory
            if ($LASTEXITCODE -ne 0) { throw "$asset status/download failed; recorded task is preserved." }
            $state = Get-Content -LiteralPath $ledger -Raw | ConvertFrom-Json
            if ($state.phase -eq 'succeeded' -and $state.files.Count -gt 0) { $complete = $true; break }
            Start-Sleep -Seconds 15
        }
        if (-not $complete) { throw "$asset polling deadline reached; resume this same recorded task later." }
    }
} finally {
    Pop-Location
}
