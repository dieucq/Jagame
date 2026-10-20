# cap-nhat-tu-ban-cu.ps1 - cap nhat Jagame tren Windows (cung chuc nang cap-nhat-tu-ban-cu.sh): chep DU LIEU tu thu muc jagame CU
# sang thu muc jagame MOI (thu muc chua file nay) roi chay ban moi. Thu muc cu KHONG bi xoa hay sua.
# Nguoi dung bam dup cap-nhat-tu-ban-cu.bat (goi file nay voi -ExecutionPolicy Bypass).
#   -Old <thu muc cu>  khong hoi      -Yes  tu dong dong y      -NoRun  chep xong khong chay ban moi
# Du lieu = database\ uploads\ games\ cloudflared\ (+ runtime\ neu ban moi chua co -> khoi tai lai PHP + Node).
# File nay CHI chua ky tu ASCII (PowerShell 5.1 doc file khong BOM theo bang ma ANSI).
param([string]$Old = '', [switch]$Yes, [switch]$NoRun)

$ErrorActionPreference = 'Continue'
$New = (Resolve-Path -LiteralPath $PSScriptRoot).ProviderPath.TrimEnd('\')
$DataDirs = @('database', 'uploads', 'games', 'cloudflared')

function Say($m) { Write-Host $m }
function Fail($m) {
    Write-Host ''
    Write-Host "[LOI] $m"
    Write-Host 'Chua thay doi gi o thu muc cu.'
    exit 1
}
function Ask-Yes($q) {
    if ($Yes) { return $true }
    $a = Read-Host "$q [c/K]"
    return ($a -match '^(c|co|y|yes)$')
}
function Count-Files($d) {
    if (-not (Test-Path -LiteralPath $d)) { return 0 }
    return @(Get-ChildItem -LiteralPath $d -Recurse -File -Force -ErrorAction SilentlyContinue).Count
}

Say '=============================================='
Say '  Jagame - cap nhat tu ban cu (giu nguyen du lieu)'
Say "  Ban MOI: $New"
Say '=============================================='
if (-not (Test-Path -LiteralPath (Join-Path $New 'router.php'))) { Fail 'File nay phai nam trong thu muc jagame MOI vua giai nen (canh run_window.bat).' }

# ---- 1. Thu muc cu ----
while ($true) {
    if (-not $Old) {
        Say ''
        Say 'Keo thu muc jagame CU (ban dang dung) vao cua so nay roi nhan Enter'
        Say '(hoac go duong dan, vi du C:\Users\Ten\Downloads\jagame):'
        $Old = Read-Host '>'
    }
    $Old = $Old.Trim().Trim('"').Trim("'").TrimEnd('\')
    if ($Old -and (Test-Path -LiteralPath (Join-Path $Old 'router.php')) -and (Test-Path -LiteralPath (Join-Path $Old 'database'))) {
        $Old = (Resolve-Path -LiteralPath $Old).ProviderPath.TrimEnd('\')
        break
    }
    Say "  Khong phai thu muc jagame (khong thay router.php + database\ trong: $Old)."
    if ($PSBoundParameters.ContainsKey('Old')) { Fail 'Duong dan thu muc cu khong dung.' }
    $Old = ''
}
if ([string]::Equals($Old, $New, [StringComparison]::OrdinalIgnoreCase)) { Fail 'Day chinh la thu muc MOI. Hay keo thu muc jagame CU (ban dang chua du lieu) vao.' }
if (($New + '\').StartsWith($Old + '\', [StringComparison]::OrdinalIgnoreCase)) { Fail 'Thu muc moi dang nam BEN TRONG thu muc cu - hay giai nen ban moi ra cho khac.' }
if (($Old + '\').StartsWith($New + '\', [StringComparison]::OrdinalIgnoreCase)) { Fail 'Thu muc cu nam ben trong thu muc moi - chon dung thu muc jagame cu.' }
if (-not (Test-Path -LiteralPath (Join-Path $Old 'database\jagame.db'))) { Fail 'Thu muc cu khong co du lieu (database\jagame.db) - co the chon nham thu muc.' }
Say ''
Say "  Ban cu : $Old"
Say "  Ban moi: $New"
$HasNewDb = Test-Path -LiteralPath (Join-Path $New 'database\jagame.db')
if ($HasNewDb) {
    Say ''
    Say '  [!] Ban MOI da co du lieu rieng (da chay thu truoc do).'
    if (-not (Ask-Yes '  Thay bang du lieu cua ban cu? (du lieu ban moi duoc cat vao thu muc _du-lieu-ban-moi-<gio>)')) { Fail 'Da huy theo yeu cau.' }
}

# ---- 2. Dung hoi quan dang chay (node.exe Realtime\server.js + php.exe router.php + cloudflared cua dung thu muc) ----
function Get-JagameProcs($dir) {
    $out = @()
    foreach ($pr in (Get-CimInstance Win32_Process -Filter "Name='php.exe' OR Name='node.exe' OR Name='cloudflared.exe' OR Name='powershell.exe'" -ErrorAction SilentlyContinue)) {
        $cl = $pr.CommandLine
        if (-not $cl) { continue }
        $hit = $false
        if ($pr.Name -eq 'node.exe' -and $cl.IndexOf((Join-Path $dir 'Realtime\server.js'), [StringComparison]::OrdinalIgnoreCase) -ge 0) { $hit = $true }
        if ($pr.Name -eq 'php.exe' -and $cl -match 'router\.php' -and $pr.ExecutablePath -and $pr.ExecutablePath.StartsWith($dir + '\', [StringComparison]::OrdinalIgnoreCase)) { $hit = $true }
        if ($pr.Name -eq 'cloudflared.exe' -and $cl.IndexOf((Join-Path $dir 'cloudflared\jagame-tunnel.yml'), [StringComparison]::OrdinalIgnoreCase) -ge 0) { $hit = $true }
        if ($pr.Name -eq 'powershell.exe' -and $cl.IndexOf((Join-Path $dir 'run_window.ps1'), [StringComparison]::OrdinalIgnoreCase) -ge 0) { $hit = $true }
        if ($hit -and $pr.ProcessId -ne $PID) { $out += $pr }
    }
    return $out
}
function Stop-Dir($dir) {
    $ps = @(Get-JagameProcs $dir)
    if ($ps.Count -eq 0) { return $true }
    Say "  Dang dung hoi quan o $dir ..."
    # keepalive_win.bat (cmd.exe) se bat lai -> dung no truoc
    foreach ($k in (Get-CimInstance Win32_Process -Filter "Name='cmd.exe'" -ErrorAction SilentlyContinue)) {
        if ($k.CommandLine -and $k.CommandLine.IndexOf((Join-Path $dir 'keepalive_win.bat'), [StringComparison]::OrdinalIgnoreCase) -ge 0) {
            Stop-Process -Id $k.ProcessId -Force -ErrorAction SilentlyContinue
        }
    }
    foreach ($p in $ps) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Milliseconds 500
        if (@(Get-JagameProcs $dir).Count -eq 0) { Say '  Da dung.'; return $true }
    }
    return $false
}
Say ''
Say '1/3  Dung hoi quan dang chay (neu co)'
if (-not (Stop-Dir $Old)) { Fail 'Khong dung duoc hoi quan cu. Dong cua so den dang chay Jagame roi chay lai file nay.' }
if (-not (Stop-Dir $New)) { Fail 'Khong dung duoc ban moi dang chay. Dong cua so den cua no roi chay lai file nay.' }

# ---- 3. Chep du lieu (robocopy giu thuoc tinh + gio sua; /E ca thu muc rong) ----
Say ''
Say '2/3  Chep du lieu sang ban moi'
$Side = Join-Path $New ('_du-lieu-ban-moi-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
foreach ($d in $DataDirs) {
    $src = Join-Path $Old $d
    $dst = Join-Path $New $d
    if (-not (Test-Path -LiteralPath $src)) { continue }
    if ($HasNewDb -and (Test-Path -LiteralPath $dst)) {
        $real = @(Get-ChildItem -LiteralPath $dst -Recurse -File -Force -ErrorAction SilentlyContinue | Where-Object { $_.Name -notin @('.gitkeep', 'index.html', '.htaccess') })
        if ($real.Count -gt 0) {
            New-Item -ItemType Directory -Force -Path $Side | Out-Null
            Move-Item -LiteralPath $dst -Destination (Join-Path $Side $d) -ErrorAction Stop
        }
    }
    New-Item -ItemType Directory -Force -Path $dst | Out-Null
    Write-Host ("  {0,-12} {1,6} tep ... " -f ($d + '\'), (Count-Files $src)) -NoNewline
    & robocopy $src $dst /E /COPY:DAT /DCOPY:T /R:2 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { Write-Host 'LOI'; Fail "Chep $d\ loi (o day hoac khong co quyen?). Thu muc cu van nguyen." }
    Write-Host 'xong'
}
$oldRt = Join-Path $Old 'runtime'
$newRt = Join-Path $New 'runtime'
if ((Test-Path -LiteralPath $oldRt) -and -not (Test-Path -LiteralPath (Join-Path $newRt 'node'))) {
    Write-Host ('  {0,-12} {1,6} ... ' -f 'runtime\', 'PHP+Node') -NoNewline
    & robocopy $oldRt $newRt /E /COPY:DAT /DCOPY:T /R:2 /W:1 /XD .cache /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { Write-Host 'bo qua (ban moi tu tai lai)' } else { Write-Host 'xong' }
}

# ---- 4. Kiem ----
Say ''
Say '3/3  Kiem tra'
$bad = $false
foreach ($d in $DataDirs) {
    $src = Join-Path $Old $d
    if (-not (Test-Path -LiteralPath $src)) { continue }
    $a = Count-Files $src
    $b = Count-Files (Join-Path $New $d)
    if ($b -lt $a) { Say "  [!] $d\: ban cu $a tep, ban moi chi co $b"; $bad = $true } else { Say "  $d\: $b tep - khop" }
}
$h1 = (Get-FileHash -LiteralPath (Join-Path $Old 'database\jagame.db') -Algorithm SHA256).Hash
$h2 = (Get-FileHash -LiteralPath (Join-Path $New 'database\jagame.db') -Algorithm SHA256).Hash
if ($h1 -ne $h2) { Say '  [!] database\jagame.db khac ban cu'; $bad = $true } else { Say '  Co so du lieu: khop tung byte voi ban cu' }
if (Test-Path -LiteralPath $Side) { Say "  Du lieu cu cua ban moi da cat o: $Side" }
if ($bad) {
    Say ''
    Say "[LOI] Chep chua tron ven. DUNG xoa thu muc cu; ban cu van chay duoc nhu truoc ($Old\run_window.bat)."
    exit 1
}
Say ''
Say 'Xong! Du lieu da sang ban moi. Thu muc cu van de nguyen o:'
Say "  $Old"
Say 'Dung ban moi vai hom thay on roi hay xoa thu muc cu (tu nay luon chay tu thu muc MOI).'
if ($NoRun) { exit 0 }
Say ''
Say 'Dang chay ban moi...'
& (Join-Path $New 'run_window.bat')
exit $LASTEXITCODE
