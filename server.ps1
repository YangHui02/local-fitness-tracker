param(
    [ValidateRange(1024, 65535)]
    [int]$Port = 8765,
    [string]$Root = $PSScriptRoot,
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$resolvedRoot = [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $Root).Path)
$rootPrefix = $resolvedRoot.TrimEnd(
    [System.IO.Path]::DirectorySeparatorChar,
    [System.IO.Path]::AltDirectorySeparatorChar
) + [System.IO.Path]::DirectorySeparatorChar
$url = "http://127.0.0.1:$Port/"
$listener = New-Object System.Net.Sockets.TcpListener(
    [System.Net.IPAddress]::Loopback,
    $Port
)
$headerEncoding = [System.Text.Encoding]::ASCII

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".mjs"  = "text/javascript; charset=utf-8"
    ".js"   = "text/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
    ".png"  = "image/png"
}

function Write-HttpResponse {
    param(
        [System.IO.Stream]$Stream,
        [int]$StatusCode,
        [string]$Reason,
        [string]$ContentType,
        [byte[]]$Body,
        [bool]$IncludeBody = $true
    )
    $headers = @(
        "HTTP/1.1 $StatusCode $Reason",
        "Content-Type: $ContentType",
        "Content-Length: $($Body.Length)",
        "Cache-Control: no-cache",
        "X-Content-Type-Options: nosniff",
        "Connection: close",
        "",
        ""
    ) -join "`r`n"
    $headerBytes = $headerEncoding.GetBytes($headers)
    $Stream.Write($headerBytes, 0, $headerBytes.Length)
    if ($IncludeBody -and $Body.Length -gt 0) {
        $Stream.Write($Body, 0, $Body.Length)
    }
}

function Text-Bytes {
    param([string]$Text)
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    return $utf8.GetBytes($Text)
}

try {
    $listener.Start()
    Write-Host ""
    Write-Host "Local Fitness Tracker is running:" -ForegroundColor Cyan
    Write-Host $url -ForegroundColor White
    Write-Host "Keep this window open. Press Ctrl+C to stop." -ForegroundColor DarkGray
    Write-Host ""

    if (-not $NoBrowser) {
        Start-Process $url
    }

    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $stream = $client.GetStream()
            $reader = New-Object System.IO.StreamReader(
                $stream,
                $headerEncoding,
                $false,
                1024,
                $true
            )
            $requestLine = $reader.ReadLine()
            while ($null -ne ($headerLine = $reader.ReadLine()) -and $headerLine -ne "") {
                # Consume headers; this server does not accept request bodies.
            }

            if ([string]::IsNullOrWhiteSpace($requestLine)) {
                Write-HttpResponse $stream 400 "Bad Request" "text/plain; charset=utf-8" (Text-Bytes "Bad Request")
                continue
            }

            $parts = $requestLine.Split(" ")
            if ($parts.Length -lt 3 -or $parts[0] -notin "GET", "HEAD") {
                Write-HttpResponse $stream 405 "Method Not Allowed" "text/plain; charset=utf-8" (Text-Bytes "Method Not Allowed")
                continue
            }

            try {
                $rawPath = $parts[1].Split("?")[0]
                $decodedPath = [System.Uri]::UnescapeDataString($rawPath)
                $relativePath = $decodedPath.Replace(
                    "/",
                    [System.IO.Path]::DirectorySeparatorChar
                ).TrimStart([System.IO.Path]::DirectorySeparatorChar)
                if ([string]::IsNullOrWhiteSpace($relativePath)) {
                    $relativePath = "index.html"
                }
                $candidate = [System.IO.Path]::GetFullPath(
                    (Join-Path $resolvedRoot $relativePath)
                )
            } catch {
                Write-HttpResponse $stream 400 "Bad Request" "text/plain; charset=utf-8" (Text-Bytes "Bad Request")
                continue
            }

            $insideRoot = $candidate.StartsWith(
                $rootPrefix,
                [System.StringComparison]::OrdinalIgnoreCase
            )
            if (-not $insideRoot) {
                Write-HttpResponse $stream 403 "Forbidden" "text/plain; charset=utf-8" (Text-Bytes "Forbidden")
                continue
            }
            if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
                Write-HttpResponse $stream 404 "Not Found" "text/plain; charset=utf-8" (Text-Bytes "Not Found")
                continue
            }

            $extension = [System.IO.Path]::GetExtension($candidate).ToLowerInvariant()
            $contentType = if ($mimeTypes.ContainsKey($extension)) {
                $mimeTypes[$extension]
            } else {
                "application/octet-stream"
            }
            $body = [System.IO.File]::ReadAllBytes($candidate)
            Write-HttpResponse $stream 200 "OK" $contentType $body ($parts[0] -eq "GET")
        } catch {
            if ($null -ne $stream -and $stream.CanWrite) {
                Write-HttpResponse $stream 500 "Internal Server Error" "text/plain; charset=utf-8" (Text-Bytes "Internal Server Error")
            }
        } finally {
            if ($null -ne $reader) { $reader.Dispose() }
            if ($null -ne $stream) { $stream.Dispose() }
            $client.Close()
        }
    }
} finally {
    $listener.Stop()
}
