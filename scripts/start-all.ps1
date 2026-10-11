param([switch]$NoBrowser, [switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$browserJob = $null

try {
    Write-Host "`nLICET Book Bank - starting your application`n" -ForegroundColor Cyan
    if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) { throw 'Node.js is missing. Install Node.js 22.12 or newer, then try again.' }
    if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw 'npm is missing. Reinstall Node.js with npm enabled.' }
    $envFile = Join-Path $projectRoot '.env'
    if (-not (Test-Path -LiteralPath $envFile)) { throw 'The .env file is missing. Follow the fresh installation steps in README.md first.' }
    $originLine = Get-Content -LiteralPath $envFile | Where-Object { $_ -match '^\s*APP_ORIGIN\s*=' } | Select-Object -First 1
    if (-not $originLine) { throw 'Set APP_ORIGIN in .env, for example http://127.0.0.1:3000.' }
    $origin = ($originLine -replace '^\s*APP_ORIGIN\s*=\s*', '').Trim().Trim('"').Trim("'").TrimEnd('/')
    $uri = [Uri]$origin
    if ($uri.Scheme -ne 'http' -or $uri.Host -notin @('127.0.0.1', 'localhost') -or $uri.AbsolutePath -ne '/' -or $uri.Query -or $uri.Fragment -or $uri.UserInfo) { throw 'This local launcher needs APP_ORIGIN to be http://127.0.0.1:PORT or http://localhost:PORT.' }
    $dataPath = Join-Path $projectRoot '.postgres\data'
    if (-not (Test-Path -LiteralPath (Join-Path $dataPath 'PG_VERSION'))) { throw 'The project-local database is missing. Follow README.md to configure PostgreSQL first.' }
    $pgVersion = (Get-Content -LiteralPath (Join-Path $dataPath 'PG_VERSION') -Raw).Trim()
    $postgresBin = if ($env:POSTGRES_BIN) { $env:POSTGRES_BIN } else { Join-Path $env:ProgramFiles "PostgreSQL\$pgVersion\bin" }
    if (-not (Test-Path -LiteralPath (Join-Path $postgresBin 'pg_ctl.exe'))) { throw "PostgreSQL $pgVersion was not found. Set POSTGRES_BIN to the directory containing pg_ctl.exe." }
    if ($CheckOnly) {
        Write-Host "Prerequisites OK. Project: $projectRoot"
        Write-Host "Application URL: $origin"
        exit 0
    }
    if (-not (Test-Path -LiteralPath 'node_modules\next\dist\bin\next')) {
        Write-Host 'Installing application dependencies...'
        & npm.cmd ci
        if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed. Check your internet connection and retry.' }
    }
    Write-Host 'Starting PostgreSQL (an already-running database is reused)...'
    & (Join-Path $PSScriptRoot 'start-db.ps1') -PostgresBin $postgresBin

    $listener = Get-NetTCPConnection -State Listen -LocalPort $uri.Port -ErrorAction SilentlyContinue
    if ($listener) {
        $response = $null
        try { $response = Invoke-WebRequest -UseBasicParsing -Uri "$origin/login" -TimeoutSec 15 } catch { }
        if ($response -and $response.StatusCode -eq 200 -and $response.Content -match '<title>Folio \| LICET Book Bank</title>') {
            Write-Host "Book Bank is already running at $origin" -ForegroundColor Green
            if (-not $NoBrowser) { Start-Process $origin }
            exit 0
        }
        $candidate = $uri.Port + 1
        while ($candidate -lt $uri.Port + 21 -and $candidate -le 65535 -and (Get-NetTCPConnection -State Listen -LocalPort $candidate -ErrorAction SilentlyContinue)) {
            $candidateOrigin = "http://$($uri.Host):$candidate"
            $response = $null
            try { $response = Invoke-WebRequest -UseBasicParsing -Uri "$candidateOrigin/login" -TimeoutSec 5 } catch { }
            if ($response -and $response.StatusCode -eq 200 -and $response.Content -match '<title>Folio \| LICET Book Bank</title>') {
                Write-Host "Book Bank is already running at $candidateOrigin" -ForegroundColor Green
                if (-not $NoBrowser) { Start-Process $candidateOrigin }
                exit 0
            }
            $candidate++
        }
        if ($candidate -ge $uri.Port + 21 -or $candidate -gt 65535) { throw 'No free nearby port was found. Close an unused development server and retry.' }
        $origin = "http://$($uri.Host):$candidate"
        $uri = [Uri]$origin
        Write-Host "The configured port is busy. Using $origin for this launch."
    }
    # Override only this process and its children, keeping .env unchanged.
    $env:APP_ORIGIN = $origin
    if (-not (Test-Path -LiteralPath 'node_modules\.prisma\client\index.js')) {
        & npm.cmd run db:generate
        if ($LASTEXITCODE -ne 0) { throw 'Prisma client generation failed.' }
    }
    Write-Host 'Applying pending database migrations...'
    & npm.cmd run db:migrate
    if ($LASTEXITCODE -ne 0) { throw 'Database migration failed. Check the PostgreSQL configuration in .env.' }
    if (-not $NoBrowser) {
        $browserJob = Start-Job -ArgumentList $origin -ScriptBlock {
            param($url)
            $deadline = (Get-Date).AddSeconds(90)
            while ((Get-Date) -lt $deadline) {
                try {
                    $response = Invoke-WebRequest -UseBasicParsing -Uri "$url/login" -TimeoutSec 5
                    if ($response.StatusCode -eq 200 -and $response.Content -match '<title>Folio \| LICET Book Bank</title>') {
                        Start-Process $url
                        return
                    }
                } catch { }
                Start-Sleep -Seconds 1
            }
        }
    }
    Write-Host "`nOpening $origin when ready. Keep this window open while using the application." -ForegroundColor Green
    Write-Host 'Press Ctrl+C to stop the web server. PostgreSQL remains available for your next launch.'
    & npm.cmd run dev -- --port $uri.Port
    if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne 130 -and $LASTEXITCODE -ne -1073741510) { throw 'The web server stopped unexpectedly. Review its output above.' }
} catch {
    Write-Host "`n$($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    if ($browserJob) { Stop-Job $browserJob -ErrorAction SilentlyContinue; Remove-Job $browserJob -Force -ErrorAction SilentlyContinue }
}
