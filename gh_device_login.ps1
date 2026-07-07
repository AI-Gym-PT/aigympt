# Dang nhap GitHub bang device-flow: mo trinh duyet san (ma da dien), user chi bam Authorize
$ErrorActionPreference = 'Stop'
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
$gh = (Get-Command gh -ErrorAction SilentlyContinue).Source
if (-not $gh) { $gh = "C:\Program Files\GitHub CLI\gh.exe" }

$clientId = '178c6fc778ccc68e1d6a'   # GitHub CLI OAuth app (cong khai)
$scope = 'repo read:org workflow'

try {
  $dc = Invoke-RestMethod -Method Post -Uri 'https://github.com/login/device/code' `
    -Headers @{Accept='application/json'} `
    -Body @{client_id=$clientId; scope=$scope}
} catch { Write-Host "LOGIN_FAIL: khong lay duoc ma thiet bi"; exit 1 }

$uri = $dc.verification_uri_complete
if ([string]::IsNullOrEmpty($uri)) { $uri = $dc.verification_uri }
if ([string]::IsNullOrEmpty($uri)) { $uri = 'https://github.com/login/device' }
Write-Host ""
Write-Host "=================================================="
Write-Host "  MA CUA BAN:  $($dc.user_code)"
Write-Host "  1. Trinh duyet mo trang GitHub"
Write-Host "  2. Go ma tren vao o, bam Continue"
Write-Host "  3. Bam nut xanh 'Authorize'"
Write-Host "=================================================="
# copy ma vao clipboard cho de dan
try { Set-Clipboard -Value $dc.user_code } catch {}
Start-Process $uri

$deadline = (Get-Date).AddSeconds([Math]::Min($dc.expires_in, 300))
$interval = [Math]::Max([int]$dc.interval, 5)
$token = $null
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Seconds $interval
  try {
    $r = Invoke-RestMethod -Method Post -Uri 'https://github.com/login/oauth/access_token' `
      -Headers @{Accept='application/json'} `
      -Body @{client_id=$clientId; device_code=$dc.device_code; grant_type='urn:ietf:params:oauth:grant-type:device_code'}
  } catch { continue }
  if ($r.access_token) { $token = $r.access_token; break }
  if ($r.error -eq 'slow_down') { $interval += 5 }
  elseif ($r.error -and $r.error -ne 'authorization_pending') { Write-Host "LOGIN_FAIL: $($r.error)"; exit 1 }
}

if (-not $token) { Write-Host "LOGIN_FAIL: het gio cho (chua bam Authorize)"; exit 1 }

$token | & $gh auth login --hostname github.com --git-protocol https --with-token
if ($LASTEXITCODE -eq 0) {
  $u = & $gh api user --jq .login 2>$null
  Write-Host "LOGIN_OK:$u"
} else {
  Write-Host "LOGIN_FAIL: gh khong nhan token"
  exit 1
}
