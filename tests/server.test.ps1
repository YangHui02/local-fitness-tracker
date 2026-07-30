$ErrorActionPreference = "Stop"
$trackerRoot = Split-Path -Parent $PSScriptRoot
$serverScript = Join-Path $trackerRoot "server.ps1"
$testPort = 8876
$serverProcess = Start-Process powershell.exe -ArgumentList @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", "`"$serverScript`"",
    "-Port", $testPort,
    "-NoBrowser"
) -PassThru -WindowStyle Hidden

try {
    $deadline = (Get-Date).AddSeconds(6)
    $response = $null
    while ((Get-Date) -lt $deadline -and $null -eq $response) {
        try {
            $response = Invoke-WebRequest "http://127.0.0.1:$testPort/" -UseBasicParsing
        } catch {
            Start-Sleep -Milliseconds 150
        }
    }

    if ($null -eq $response) {
        throw "Local server did not start before timeout"
    }
    if ($response.StatusCode -ne 200 -or $response.Content -notmatch 'id="daily-form"') {
        throw "Index smoke test failed"
    }

    $module = Invoke-WebRequest "http://127.0.0.1:$testPort/js/domain.mjs" -UseBasicParsing
    if ($module.StatusCode -ne 200 -or $module.Headers["Content-Type"] -notmatch "javascript") {
        throw "ES module MIME type is incorrect"
    }

    try {
        Invoke-WebRequest "http://127.0.0.1:$testPort/%2e%2e/server.ps1" -UseBasicParsing | Out-Null
        throw "Traversal request should not succeed"
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        if ($status -notin 400, 403, 404) {
            throw
        }
    }

    Write-Host "PASS: index, MIME, and traversal protection are correct"
} finally {
    Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
}
