[CmdletBinding()]
param(
  [string]$ConfigPath = (Join-Path $PSScriptRoot '..\apps\server\.env.production')
)

$resolvedConfigPath = Resolve-Path -LiteralPath $ConfigPath -ErrorAction SilentlyContinue
if ($null -eq $resolvedConfigPath) {
  throw "Mini PC environment file not found: $ConfigPath. Copy apps/server/.env.production.example first."
}

Get-Content -LiteralPath $resolvedConfigPath | ForEach-Object {
  $line = $_.Trim()
  if (!$line -or $line.StartsWith('#')) {
    return
  }

  $pair = $line -split '=', 2
  if ($pair.Count -ne 2 -or !$pair[0].Trim()) {
    throw "Invalid environment entry in $resolvedConfigPath: $line"
  }

  Set-Item -Path ("Env:" + $pair[0].Trim()) -Value $pair[1].Trim()
}

$env:NODE_ENV = 'production'
& npm.cmd run start -w @marfia/server
exit $LASTEXITCODE
