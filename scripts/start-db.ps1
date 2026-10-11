param([string]$PostgresBin = 'C:\Program Files\PostgreSQL\18\bin')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$dataPath = Join-Path $projectRoot '.postgres\data'
if (-not (Test-Path -LiteralPath $dataPath)) { throw 'No project-local database exists. Follow README.md to configure PostgreSQL.' }
& (Join-Path $PostgresBin 'pg_ctl.exe') -D $dataPath status
if ($LASTEXITCODE -ne 0) {
  & (Join-Path $PostgresBin 'pg_ctl.exe') -D $dataPath -l (Join-Path $projectRoot '.postgres\server.log') -o '-p 55432 -h 127.0.0.1' start
  if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL could not start. Check .postgres/server.log for details.' }
}
