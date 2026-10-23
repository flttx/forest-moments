if (-not $env:AHOLO_API_KEY) {
    $env:AHOLO_API_KEY = [Environment]::GetEnvironmentVariable('AHOLO_API_KEY', 'User')
}
if (-not $env:AHOLO_API_KEY) {
    $env:AHOLO_API_KEY = [Environment]::GetEnvironmentVariable('AHOLO_API_KEY', 'Machine')
}
if (-not $env:AHOLO_API_KEY) { throw 'AHOLO_API_KEY is not configured.' }
& node (Join-Path $PSScriptRoot 'aholo.mjs') @args
exit $LASTEXITCODE
