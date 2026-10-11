param([string]$PostgresBin = 'C:\Program Files\PostgreSQL\18\bin')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
& (Join-Path $PostgresBin 'pg_ctl.exe') -D (Join-Path $projectRoot '.postgres\data') -m fast stop
