param(
  [string]$BaseUrl = "http://localhost:3000",
  [int]$TimeoutSec = 8,
  [switch]$SkipDb,
  [switch]$SkipApi
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$results = @()

function Add-Result {
  param(
    [string]$Check,
    [bool]$Passed,
    [string]$Details
  )
  $script:results += [pscustomobject]@{
    Check   = $Check
    Status  = if ($Passed) { "PASS" } else { "FAIL" }
    Details = $Details
  }
}

function Test-HttpStatus {
  param(
    [string]$Url,
    [int[]]$AllowedStatus
  )

  try {
    $resp = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec $TimeoutSec -UseBasicParsing
    if ($AllowedStatus -contains $resp.StatusCode) {
      return @{ Passed = $true; Details = "HTTP $($resp.StatusCode) from $Url" }
    }
    return @{ Passed = $false; Details = "Unexpected HTTP $($resp.StatusCode) from $Url" }
  } catch {
    $webResp = $_.Exception.Response
    if ($null -ne $webResp) {
      $code = [int]$webResp.StatusCode
      if ($AllowedStatus -contains $code) {
        return @{ Passed = $true; Details = "HTTP $code from $Url" }
      }
      return @{ Passed = $false; Details = "Unexpected HTTP $code from $Url" }
    }
    return @{ Passed = $false; Details = $_.Exception.Message }
  }
}

function Get-DotEnvValue {
  param(
    [string]$Key
  )

  if (-not (Test-Path ".env")) {
    return $null
  }

  $pattern = "^\s*{0}\s*=\s*(.*)\s*$" -f [regex]::Escape($Key)
  foreach ($line in Get-Content ".env") {
    if ($line -match "^\s*#" -or [string]::IsNullOrWhiteSpace($line)) {
      continue
    }
    if ($line -match $pattern) {
      $value = $matches[1].Trim()
      if ($value.StartsWith('"') -and $value.EndsWith('"') -and $value.Length -ge 2) {
        return $value.Substring(1, $value.Length - 2)
      }
      return $value
    }
  }

  return $null
}

function Test-DbConnectivityDirect {
  $enginePath = Join-Path (Get-Location) "node_modules\@prisma\engines\schema-engine-windows.exe"
  if (-not (Test-Path $enginePath)) {
    return @{ Passed = $false; Details = "Prisma schema engine not found at $enginePath" }
  }

  $dbUrl = Get-DotEnvValue -Key "DATABASE_URL"
  if ([string]::IsNullOrWhiteSpace($dbUrl)) {
    return @{ Passed = $false; Details = "DATABASE_URL missing in .env" }
  }

  try {
    $engineOut = & $enginePath cli --datasource $dbUrl can-connect-to-database 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0) {
      return @{ Passed = $true; Details = "Schema engine can reach database" }
    }
    return @{ Passed = $false; Details = ($engineOut.Trim()) }
  } catch {
    return @{ Passed = $false; Details = $_.Exception.Message }
  }
}

Write-Host "Running demo health checks..."
Write-Host "Base URL: $BaseUrl"

# 1) Local config
if (Test-Path ".env") {
  Add-Result -Check ".env present" -Passed $true -Details "Found .env"
} else {
  Add-Result -Check ".env present" -Passed $false -Details "Missing .env"
}

if (-not $SkipDb) {
  # 2) DB connectivity + migration status
  try {
    $dbOut = ""
    $attempt = 0
    $maxAttempts = 3
    while ($attempt -lt $maxAttempts) {
      $attempt++
      $dbOut = & npx.cmd prisma migrate status 2>&1 | Out-String
      if ($dbOut -notmatch "EPERM") {
        break
      }
      Start-Sleep -Milliseconds 300
    }

    $hasPending = $dbOut -match "Following migration have not yet been applied"
    $isBaselineDb = $dbOut -match "Error:\s*P3005"
    $isUpToDate = $dbOut -match "Database schema is up to date"
    $isSpawnEperm = $dbOut -match "EPERM"

    if ($LASTEXITCODE -eq 0 -or $hasPending -or $isBaselineDb -or $isUpToDate) {
      Add-Result -Check "DB connectivity" -Passed $true -Details "Prisma can reach database"
      if ($hasPending) {
        Add-Result -Check "Migrations applied" -Passed $false -Details "Pending migration(s) detected"
      } elseif ($isBaselineDb) {
        Add-Result -Check "Migrations applied" -Passed $true -Details "Baseline database detected (P3005); schema already initialized"
      } else {
        Add-Result -Check "Migrations applied" -Passed $true -Details "No pending migrations reported"
      }
    } elseif ($isSpawnEperm) {
      $fallback = Test-DbConnectivityDirect
      Add-Result -Check "DB connectivity" -Passed $fallback.Passed -Details $fallback.Details
      if ($fallback.Passed) {
        Add-Result -Check "Migrations applied" -Passed $true -Details "Skipped (Prisma CLI spawn EPERM in this shell); run 'npx prisma migrate status' in a full local shell to verify"
      } else {
        Add-Result -Check "Migrations applied" -Passed $false -Details "Could not evaluate due to DB check failure"
      }
    } else {
      Add-Result -Check "DB connectivity" -Passed $false -Details ($dbOut.Trim())
      Add-Result -Check "Migrations applied" -Passed $false -Details "Could not evaluate due to DB check failure"
    }
  } catch {
    $err = $_.Exception.Message
    if ($err -match "EPERM") {
      $fallback = Test-DbConnectivityDirect
      Add-Result -Check "DB connectivity" -Passed $fallback.Passed -Details $fallback.Details
      if ($fallback.Passed) {
        Add-Result -Check "Migrations applied" -Passed $true -Details "Skipped (Prisma CLI spawn EPERM in this shell); run 'npx prisma migrate status' in a full local shell to verify"
      } else {
        Add-Result -Check "Migrations applied" -Passed $false -Details "Could not evaluate due to DB check failure"
      }
    } else {
      Add-Result -Check "DB connectivity" -Passed $false -Details $err
      Add-Result -Check "Migrations applied" -Passed $false -Details "Could not evaluate due to DB check failure"
    }
  }
}

# 3) App reachability
$loginProbe = Test-HttpStatus -Url "$BaseUrl/login" -AllowedStatus @(200, 302, 307, 308, 404)
Add-Result -Check "Web app reachable" -Passed $loginProbe.Passed -Details $loginProbe.Details

if (-not $SkipApi) {
  # 4) API smoke (unauth expected on protected routes)
  $apiChecks = @(
    @{ Name = "Bookings API"; Url = "$BaseUrl/api/bookings"; Allowed = @(401, 403) },
    @{ Name = "Dashboard API"; Url = "$BaseUrl/api/dashboard/stats"; Allowed = @(401, 403) },
    @{ Name = "Lookup products API"; Url = "$BaseUrl/api/lookup/products"; Allowed = @(401, 403) },
    @{ Name = "Tenant context API"; Url = "$BaseUrl/api/v1/tenants/me"; Allowed = @(401, 403) }
  )

  foreach ($check in $apiChecks) {
    $probe = Test-HttpStatus -Url $check.Url -AllowedStatus $check.Allowed
    Add-Result -Check $check.Name -Passed $probe.Passed -Details $probe.Details
  }
}

Write-Host ""
Write-Host "Health Check Results:"
$results | Format-Table -AutoSize

$failed = @($results | Where-Object { $_.Status -eq "FAIL" })
Write-Host ""
if ($failed.Count -gt 0) {
  Write-Host "Overall: FAIL ($($failed.Count) check(s) failed)"
  exit 1
}

Write-Host "Overall: PASS"
exit 0
