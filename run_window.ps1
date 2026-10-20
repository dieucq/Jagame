# run_window.ps1 - chay Jagame tren Windows (cung chuc nang run_mac.sh): cong Node (Realtime/: Socket.IO + proxy)
# truoc PHP built-in server. Nguoi dung chi bam dup run_window.bat (goi file nay voi -ExecutionPolicy Bypass).
#   JAGAME_BIND=0.0.0.0   mo cho may khac trong mang nha (set JAGAME_BIND=0.0.0.0 truoc khi chay)
#   JAGAME_PORT=9000      cong goc khac (ban thi lui +1/+2)
#   JAGAME_NO_BROWSER=1   khong tu mo trinh duyet      JAGAME_NO_FETCH=1  khong tu tai PHP/Node
#   -FetchOnly            chi tai runtime (PHP + Node) roi thoat
#   -Check                chi kiem goi co du PHP + Node + cloudflared KEM SAN (VC++ DLL tuy chon) (tren Windows: chay thu tung cai) roi thoat
#                         0 = du, 2 = thieu. Khong tai gi. release.py chay tren goi vua giai nen (pwsh) - ngoai Windows chi kiem tep.
# Goi jagame-windows tu 0.5.1 KEM SAN runtime\node\node.exe + runtime\php\ (giai nen la chay). Chi goi cu / goi thieu runtime moi
# tu tai: Invoke-WebRequest -> curl.exe -> WebClient, giai nen .NET -> tar.exe; moi buoc + ly do loi ghi vao database\setup.log.
# Trinh duyet / cloudflared -> PORT (Node gateway) -> 127.0.0.1:PHP_PORT (php -S, chi nghe loopback).
# File nay CHI chua ky tu ASCII (PowerShell 5.1 doc file khong BOM theo bang ma ANSI).
param([switch]$FetchOnly, [switch]$Check)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
# TLS 1.2 (+1.3 neu .NET co): PowerShell 5.1 mac dinh TLS 1.0 -> nodejs.org / windows.php.net tu choi
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]12288 }
catch { try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {} }

$NodeVer = '24.21.0'          # >= 22.13 (node:sqlite khong can co)
$PhpSeries = '8.3'            # PHP Windows NTS x64 (windows.php.net), phien ban cu the lay tu releases.json
$ScriptDir = $PSScriptRoot

$script:SetupLog = ''
function Log($m) {
    # Nhat ky cai dat (database\setup.log) - khach gui lai file nay khi bao loi. Khong bao gio lam hong luong chinh.
    if (-not $script:SetupLog) { return }
    try { [IO.File]::AppendAllText($script:SetupLog, ((Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + '  ' + $m + "`r`n"), [Text.Encoding]::UTF8) } catch {}
}
function Say($m) { Write-Host $m; Log $m }
function Fail($m, $code) {
    Write-Host ''
    Write-Host "[LOI] $m"
    Log "[LOI] $m"
    if ($script:SetupLog) { Write-Host "      Nhat ky chi tiet: $script:SetupLog (gui file nay cho nguoi ho tro)." }
    if ($code -eq $null) { $code = 2 }
    exit $code
}

# ---- Bo cuc: RELEASE (phang, router.php cung cap) hay DEV (Web\ + Tools\ tach) ----
if (Test-Path -LiteralPath (Join-Path $ScriptDir 'router.php')) {
    $Layout = 'release'
    $WebRoot = $ScriptDir
    $RtDir = Join-Path $ScriptDir 'Realtime'
    $RuntimeDir = Join-Path $ScriptDir 'runtime'
    $CfToolDir = Join-Path $ScriptDir 'cloudflared'
    $LegacyPhpDir = Join-Path $ScriptDir 'php'
    $LegacyPhpRel = 'php'
    $PhpRel = 'runtime\php'
} else {
    $Layout = 'dev'
    $RootDir = Split-Path -Parent $ScriptDir
    $WebRoot = Join-Path $RootDir 'Web'
    $RtDir = Join-Path $RootDir 'Realtime'
    $RuntimeDir = Join-Path $RootDir 'Tools\runtime\windows-x64'
    $CfToolDir = Join-Path $RootDir 'Tools\cloudflared'
    $LegacyPhpDir = Join-Path $RootDir 'Tools\php'
    $LegacyPhpRel = '..\Tools\php'
    $PhpRel = '..\Tools\runtime\windows-x64\php'
}
$CfConfDir = Join-Path $WebRoot 'cloudflared'
$DbDir = Join-Path $WebRoot 'database'
$FullPkgHint = 'Tai goi day du (da kem san PHP + Node, khong can Internet lan dau) o https://jagame.vn/#tai-ve, giai nen ra thu muc moi roi chay lai.'
if (-not $env:JAGAME_CHILD) {
    try {
        New-Item -ItemType Directory -Force -Path $DbDir -ErrorAction Stop | Out-Null
        $script:SetupLog = Join-Path $DbDir 'setup.log'
        if ((Test-Path -LiteralPath $script:SetupLog) -and ((Get-Item -LiteralPath $script:SetupLog).Length -gt 1MB)) { Remove-Item -LiteralPath $script:SetupLog -Force }
        Log ('==== run_window.ps1  ' + $ScriptDir)
        Log ('Windows ' + [Environment]::OSVersion.Version + '  64bit=' + [Environment]::Is64BitOperatingSystem + '  PowerShell ' + $PSVersionTable.PSVersion + '  .NET CLR ' + [Environment]::Version)
    } catch {}
}

# ---- Tai runtime (PHP + Node) - CHI khi goi thieu runtime (goi cu) ----
function Err-Text($e) {
    # Ly do that cua loi (thong bao cua Invoke-WebRequest / Expand-Archive / .NET), 1 dong
    $m = ''
    try { $m = [string]$e.Exception.Message } catch {}
    try { if ($e.Exception.InnerException) { $m += ' | ' + [string]$e.Exception.InnerException.Message } } catch {}
    if (-not $m) { $m = [string]$e }
    return ($m -replace '\s+', ' ').Trim()
}
$script:CurlExe = ''
if ($env:SystemRoot) {
    $cx = Join-Path $env:SystemRoot 'System32\curl.exe'   # co san tu Windows 10 1803
    if (Test-Path -LiteralPath $cx) { $script:CurlExe = $cx }
}
function Get-File($urls, $out) {
    if ((Test-Path -LiteralPath $out) -and ((Get-Item -LiteralPath $out).Length -gt 0)) { return $true }
    $part = "$out.part"
    foreach ($u in $urls) {
        # 3 cach, moi cach thu 2 lan: Invoke-WebRequest (proxy he thong) -> curl.exe (TLS rieng cua Windows) -> WebClient
        foreach ($how in @('iwr', 'curl', 'webclient')) {
            if ($how -eq 'curl' -and -not $script:CurlExe) { continue }
            for ($i = 1; $i -le 2; $i++) {
                Remove-Item -LiteralPath $part -Force -ErrorAction SilentlyContinue
                $why = ''
                try {
                    if ($how -eq 'iwr') {
                        Invoke-WebRequest -UseBasicParsing -Uri $u -OutFile $part -TimeoutSec 600 -ErrorAction Stop
                    } elseif ($how -eq 'curl') {
                        # curl.exe nhan tham so theo bang ma ANSI: duong dan co chu co dau (C:\Users\Nguyen...) -> chay TRONG thu muc dich,
                        # ten tep tuong doi (ASCII)
                        Push-Location -LiteralPath (Split-Path -Parent $part)
                        try { $o = (& $script:CurlExe -fsSL --retry 2 --connect-timeout 20 -o (Split-Path -Leaf $part) $u 2>&1 | Out-String).Trim() }
                        finally { Pop-Location }
                        if ($LASTEXITCODE -ne 0) { throw "curl.exe ma $LASTEXITCODE $o" }
                    } else {
                        $wc = New-Object Net.WebClient
                        try { $wc.DownloadFile($u, $part) } finally { $wc.Dispose() }
                    }
                    if ((Test-Path -LiteralPath $part) -and ((Get-Item -LiteralPath $part).Length -gt 0)) {
                        Move-Item -LiteralPath $part -Destination $out -Force -ErrorAction Stop
                        Log "  tai xong ($how): $u"
                        return $true
                    }
                    $why = 'tep tai ve rong'
                } catch { $why = Err-Text $_ }
                Say "  [!] Tai loi ($how, lan $i): $u"
                Say "      Ly do: $why"
                Start-Sleep -Seconds 2
            }
        }
        Say "  [!] Khong tai duoc $u, thu nguon khac..."
    }
    Remove-Item -LiteralPath $part -Force -ErrorAction SilentlyContinue
    return $false
}
function Get-Sha($file) { return (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLower() }
# Giai nen chi cac muc can (zip Node ~100 MB gom npm...): $pick nhan ten muc trong zip (dau /), tra duong dan dich (rong = bo qua).
# Cach 1 .NET ZipFile; loi (thieu assembly, duong dan dai, file bi khoa...) -> cach 2 tar.exe (Windows 10 1803+) ra thu muc tam roi chep.
function Expand-Picked($zip, $dest, $pick) {
    try {
        Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction Stop
        $z = [IO.Compression.ZipFile]::OpenRead($zip)
        try {
            foreach ($e in $z.Entries) {
                if ($e.FullName.EndsWith('/')) { continue }
                $rel = & $pick $e.FullName
                if (-not $rel) { continue }
                $t = Join-Path $dest $rel
                New-Item -ItemType Directory -Force -Path (Split-Path -Parent $t) | Out-Null
                [IO.Compression.ZipFileExtensions]::ExtractToFile($e, $t, $true)
            }
        } finally { $z.Dispose() }
        return $true
    } catch {
        Say ('  [!] Giai nen (.NET) loi: ' + (Err-Text $_))
    }
    $tar = ''
    if ($env:SystemRoot) { $tar = Join-Path $env:SystemRoot 'System32\tar.exe' }
    if ($env:JAGAME_TEST_TAR) { $tar = $env:JAGAME_TEST_TAR }   # chi de thu tren may khong phai Windows
    if (-not $tar -or -not (Test-Path -LiteralPath $tar)) { Say '  [!] Khong co tar.exe de thu cach khac.'; return $false }
    # tar.exe (bsdtar) cung nhan tham so ANSI -> chay trong thu muc chua zip, moi tham so la ten tuong doi ASCII
    $zdir = Split-Path -Parent $zip
    $tname = 'x-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)
    $tmp = Join-Path $zdir $tname
    try {
        New-Item -ItemType Directory -Force -Path $tmp | Out-Null
        Push-Location -LiteralPath $zdir
        try { $o = (& $tar -xf (Split-Path -Leaf $zip) -C $tname 2>&1 | Out-String).Trim() } finally { Pop-Location }
        if ($LASTEXITCODE -ne 0) { Say "  [!] tar.exe loi (ma $LASTEXITCODE): $o"; return $false }
        $base = (Resolve-Path -LiteralPath $tmp).ProviderPath.TrimEnd('\') + '\'
        foreach ($f in (Get-ChildItem -LiteralPath $tmp -Recurse -File -Force)) {
            $rel = & $pick ($f.FullName.Substring($base.Length) -replace '\\', '/')
            if (-not $rel) { continue }
            $t = Join-Path $dest $rel
            New-Item -ItemType Directory -Force -Path (Split-Path -Parent $t) | Out-Null
            Copy-Item -LiteralPath $f.FullName -Destination $t -Force -ErrorAction Stop
        }
        Log '  giai nen bang tar.exe: xong'
        return $true
    } catch {
        Say ('  [!] Giai nen (tar.exe) loi: ' + (Err-Text $_))
        return $false
    } finally { Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue }
}
function Install-Node {
    $cache = Join-Path $RuntimeDir '.cache'
    New-Item -ItemType Directory -Force -Path $cache | Out-Null
    $name = "node-v$NodeVer-win-x64.zip"
    $zip = Join-Path $cache $name
    $sums = Join-Path $cache "node-v$NodeVer-SHASUMS256.txt"
    if (-not (Get-File @("https://nodejs.org/dist/v$NodeVer/SHASUMS256.txt") $sums)) { return $false }
    if (-not (Get-File @("https://nodejs.org/dist/v$NodeVer/$name") $zip)) { return $false }
    $want = ''
    foreach ($line in (Get-Content -LiteralPath $sums)) {
        $p = $line -split '\s+'
        if ($p.Length -ge 2 -and $p[1] -eq $name) { $want = $p[0].ToLower() }
    }
    $got = Get-Sha $zip
    if (-not $want -or $want -ne $got) {
        Remove-Item -LiteralPath $zip -Force -ErrorAction SilentlyContinue
        Say "  [LOI] SHA-256 cua $name khong khop (can $want, nhan $got) - tep tai ve bi hong/bi thay (proxy, mang). Chay lai de tai lai."
        return $false
    }
    $nodeDir = Join-Path $RuntimeDir 'node'
    if (Test-Path -LiteralPath $nodeDir) { Remove-Item -LiteralPath $nodeDir -Recurse -Force -ErrorAction SilentlyContinue }
    $ok = Expand-Picked $zip $nodeDir {
        param($n)
        $r = ($n -split '/', 2)[1]
        if ($r -eq 'node.exe' -or $r -eq 'LICENSE') { return $r }
        return ''
    }
    Remove-Item -LiteralPath $zip -Force -ErrorAction SilentlyContinue
    if (-not $ok) { return $false }
    Start-Sleep -Milliseconds 500
    if (-not (Test-Path -LiteralPath (Join-Path $nodeDir 'node.exe'))) {
        Say '  [LOI] Da giai nen node.exe nhung tep bien mat - thuong do chuong trinh diet virus xoa/cach ly. Them thu muc jagame vao danh sach loai tru roi chay lai.'
        return $false
    }
    Say "  node v$NodeVer (sha256 ok)"
    return $true
}
$PhpExts = @('curl', 'exif', 'fileinfo', 'gd', 'mbstring', 'openssl', 'pdo_sqlite', 'sqlite3', 'zip')
function Install-Php {
    $cache = Join-Path $RuntimeDir '.cache'
    New-Item -ItemType Directory -Force -Path $cache | Out-Null
    $base = 'https://windows.php.net/downloads/releases'
    $path = ''; $sha = ''
    $relFile = Join-Path $cache 'php-releases.json'
    Remove-Item -LiteralPath $relFile -Force -ErrorAction SilentlyContinue
    if (-not (Get-File @("$base/releases.json") $relFile)) { Say '  [LOI] Khong tai duoc danh sach ban PHP (windows.php.net).'; return $false }
    try {
        $rel = [IO.File]::ReadAllText($relFile) | ConvertFrom-Json
        $s = $rel.$PhpSeries
        $b = $s.'nts-vs16-x64'
        if (-not $b) { $b = $s.'nts-vs17-x64' }
        $path = $b.zip.path; $sha = $b.zip.sha256.ToLower()
    } catch { Say ('  [LOI] Doc releases.json loi: ' + (Err-Text $_)) }
    if (-not $path) { Say '  [LOI] Khong doc duoc danh sach ban PHP tu windows.php.net.'; return $false }
    $zip = Join-Path $cache $path
    if (-not (Get-File @("$base/$path", "$base/archives/$path") $zip)) { return $false }
    if ($sha -ne (Get-Sha $zip)) {
        Remove-Item -LiteralPath $zip -Force -ErrorAction SilentlyContinue
        Say "  [LOI] SHA-256 cua $path khong khop (chay lai de tai lai)."
        return $false
    }
    $phpDir = Join-Path $RuntimeDir 'php'
    if (Test-Path -LiteralPath $phpDir) { Remove-Item -LiteralPath $phpDir -Recurse -Force -ErrorAction SilentlyContinue }
    $exts = $PhpExts
    $ok = Expand-Picked $zip $phpDir {
        param($n)
        if ($n -notmatch '/') {
            if ($n -match '^(icu[a-z]+[0-9]*|php8phpdbg|libenchant2|libpq|libsodium|glib-2|gmodule-2|gobject-2)\.dll$') { return '' }
            if ($n -match '\.dll$' -or $n -eq 'php.exe' -or $n -eq 'license.txt') { return $n }
            return ''
        }
        if ($n -match '^ext/php_([a-z0-9_]+)\.dll$' -and ($exts -contains $Matches[1])) { return $n }
        return ''
    }
    Remove-Item -LiteralPath $zip -Force -ErrorAction SilentlyContinue
    if (-not $ok) { return $false }
    # Goi cacert.pem (curl/openssl can de goi HTTPS toi api.jagame.vn) - kiem sha256 theo curl.se
    $ssl = Join-Path $phpDir 'extras\ssl'
    New-Item -ItemType Directory -Force -Path $ssl | Out-Null
    $ca = Join-Path $ssl 'cacert.pem'
    $caSha = ''
    $caShaFile = Join-Path $cache 'cacert.pem.sha256'
    if (Get-File @('https://curl.se/ca/cacert.pem.sha256') $caShaFile) {
        try { $caSha = ([IO.File]::ReadAllText($caShaFile) -split '\s+')[0].ToLower() } catch {}
    }
    if ((Get-File @('https://curl.se/ca/cacert.pem') $ca) -and $caSha -and ($caSha -ne (Get-Sha $ca))) {
        Remove-Item -LiteralPath $ca -Force
        Say '  [!] cacert.pem sai SHA-256 - da bo (HTTPS tu PHP co the loi).'
    }
    # php.ini cung noi dung Tools/php/php.ini (ext bat san, gioi han tai len 64M, tieng Viet, mui gio)
    $ini = @('extension_dir = "ext"')
    foreach ($x in $PhpExts) { $ini += "extension=$x" }
    $ini += @('date.timezone = Asia/Ho_Chi_Minh', 'upload_max_filesize = 64M', 'post_max_size = 70M', 'memory_limit = 768M',
              'max_file_uploads = 50', 'max_input_vars = 5000', 'max_execution_time = 300', 'expose_php = Off',
              'display_errors = Off', 'log_errors = On')
    Set-Content -LiteralPath (Join-Path $phpDir 'php.ini') -Value $ini -Encoding Ascii
    if (-not (Test-Path -LiteralPath (Join-Path $phpDir 'php.exe'))) {
        Say '  [LOI] Da giai nen php.exe nhung tep bien mat - thuong do chuong trinh diet virus xoa/cach ly.'
        return $false
    }
    Say "  php (NTS x64, $path)"
    return $true
}

# ---- Tim runtime ----
function Find-Php {
    $c = @((Join-Path $RuntimeDir 'php\php.exe'), (Join-Path $LegacyPhpDir 'php.exe'))
    foreach ($p in $c) { if (Test-Path -LiteralPath $p) { return $p } }
    return ''
}
$script:NodeWhy = ''
function Test-Node($exe) {
    if (-not $exe -or -not (Test-Path -LiteralPath $exe)) { return $false }
    $o = ''
    try {
        $o = (& $exe -e 'const [a,b]=process.versions.node.split(".").map(Number); console.log(process.version); process.exit(a>22||(a===22&&b>=13)?0:1)' 2>&1 | Out-String).Trim()
        if ($LASTEXITCODE -eq 0) { Log "  node: $exe $o"; return $true }
        $script:NodeWhy = "$exe chay ra ma $LASTEXITCODE`: $o"
    } catch { $script:NodeWhy = "$exe khong chay duoc: " + (Err-Text $_) }
    Log "  [!] $script:NodeWhy"
    return $false
}
function Find-Node {
    $b = Join-Path $RuntimeDir 'node\node.exe'
    if (Test-Node $b) { return $b }
    $s = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($s -and (Test-Node $s.Source)) { return $s.Source }
    return ''
}

if (-not [Environment]::Is64BitOperatingSystem) { Fail 'Jagame can Windows 64-bit (PHP + Node chi co ban 64-bit).' }
if ([Environment]::OSVersion.Version.Major -lt 10) { Fail 'Jagame can Windows 10 hoac 11 (Node.js 24 khong chay tren Windows 7/8.1).' }
# May ARM (Surface Pro X, Snapdragon...): goi Windows la x64. Windows 11 ARM chay x64 qua gia lap (cham hon, van dung duoc);
# Windows 10 ARM chi gia lap x86 32-bit -> khong chay duoc.
$CpuArch = [string]$env:PROCESSOR_ARCHITEW6432
if (-not $CpuArch) { $CpuArch = [string]$env:PROCESSOR_ARCHITECTURE }
if ($CpuArch -eq 'ARM64') {
    if ([Environment]::OSVersion.Version.Build -lt 22000) {
        Fail "Goi nay danh cho Windows may Intel/AMD (x64), may ban la Windows 10 tren chip ARM - Windows 10 ARM khong chay duoc chuong trinh x64.`n      Nang cap len Windows 11 (chay duoc goi x64 qua gia lap) hoac dung may Intel/AMD / Mac / Linux: https://jagame.vn/#tai-ve"
    }
    Say '  [!] May chip ARM (Windows 11): goi x64 chay qua gia lap cua Windows - hoat dong binh thuong nhung cham hon.'
}

# File tai bang trinh duyet bi danh dau "tu Internet" (SmartScreen hoi/chan exe): go dau 1 lan cho runtime + cloudflared
# TRUOC khi chay thu node.exe/php.exe kem goi.
foreach ($d in @($RuntimeDir, $LegacyPhpDir, $CfToolDir)) {
    $mark = Join-Path $d '.unblocked'
    if ((Test-Path -LiteralPath $d) -and -not (Test-Path -LiteralPath $mark)) {
        Get-ChildItem -LiteralPath $d -Recurse -File -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue
        try { Set-Content -LiteralPath $mark -Value 'ok' -Encoding Ascii } catch {}
    }
}

function Test-Vc {
    $sys = Join-Path $env:SystemRoot 'System32'
    if (-not [Environment]::Is64BitProcess) { $sys = Join-Path $env:SystemRoot 'Sysnative' }
    $phpDirReal = Split-Path -Parent $PhpExe
    foreach ($f in @('vcruntime140.dll', 'vcruntime140_1.dll')) {
        if (-not ((Test-Path -LiteralPath (Join-Path $phpDirReal $f)) -or (Test-Path -LiteralPath (Join-Path $sys $f)))) { return $false }
    }
    # Co DLL chua du: ban VC++ 2015 cu lam PHP tu choi chay ("not compatible") -> chay thu php -n -v
    $out = (& $PhpExe -n -v 2>&1 | Out-String)
    if ($LASTEXITCODE -ne 0 -or $out -match 'not compatible' -or $out -notmatch '^PHP ') {
        Say '  [CANH BAO] PHP chua chay duoc voi bo thu vien Visual C++ hien co tren may:'
        Say $out
        return $false
    }
    return $true
}

if ($Check) {
    $onWin = ([Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT)
    # vcruntime140*.dll KHONG bat buoc trong goi (mac dinh khong kem): thieu thi lan chay dau tu cai VC++ Redistributable cua Microsoft
    $need = @('node\node.exe', 'php\php.exe', 'php\php.ini', 'php\php8.dll', 'php\extras\ssl\cacert.pem')
    foreach ($x in $PhpExts) { $need += "php\ext\php_$x.dll" }
    $miss = @()
    foreach ($n in $need) { if (-not (Test-Path -LiteralPath (Join-Path $RuntimeDir $n))) { $miss += "runtime\$n" } }
    $cf = Join-Path $CfToolDir 'cloudflared.exe'
    if (-not (Test-Path -LiteralPath $cf)) { $miss += 'cloudflared\cloudflared.exe' }
    $vcNote = 'kem goi'
    if (-not (Test-Path -LiteralPath (Join-Path $RuntimeDir 'php\vcruntime140.dll'))) { $vcNote = 'khong kem goi - lan chay dau tu cai vc_redist cua Microsoft neu may thieu' }
    Say "  VC++ Runtime: $vcNote"
    if ($onWin -and $miss.Count -eq 0) {
        $ne = Join-Path $RuntimeDir 'node\node.exe'
        if (-not (Test-Node $ne)) { $miss += "node.exe khong chay ($script:NodeWhy)" }
        $pe = Join-Path $RuntimeDir 'php\php.exe'
        $PhpExe = $pe
        if (-not (Test-Vc)) {
            Say '  VC++ Runtime: may nay chua co - lan chay that se tu tai + cai vc_redist cua Microsoft (php.exe chua chay thu duoc).'
        } else {
            Push-Location -LiteralPath $WebRoot
            try { $m = (& $pe -c "$PhpRel\php.ini" -m 2>&1 | Out-String) } finally { Pop-Location }
            foreach ($x in @('sqlite3', 'gd', 'curl', 'mbstring', 'openssl', 'zip')) { if ($m -notmatch "(?m)^$x\s*$") { $miss += "php thieu $x" } }
        }
        $cv = (& $cf --version 2>&1 | Out-String).Trim()
        if ($LASTEXITCODE -ne 0) { $miss += "cloudflared.exe khong chay ($cv)" } else { Say "  cloudflared: $cv" }
    }
    if ($miss.Count -gt 0) { Say ('[THIEU] ' + ($miss -join ', ')); exit 2 }
    if ($onWin) { Say 'DU: PHP + Node + cloudflared kem goi chay duoc tren may nay.' }
    else { Say 'DU (chi kiem tep co mat - khong phai Windows nen chua chay thu node.exe/php.exe/cloudflared.exe).' }
    exit 0
}

# Goi co kem runtime (update.json liet ke runtime/node/node.exe) ma tep mat -> diet virus xoa / giai nen thieu, KHONG phai "chua tai"
$PkgHasRt = $false
try { $PkgHasRt = ([IO.File]::ReadAllText((Join-Path $WebRoot 'update.json')) -match '"runtime/node/node\.exe"') } catch {}
$PhpExe = Find-Php
$NodeExe = Find-Node
if ($PkgHasRt -and (-not $PhpExe -or -not $NodeExe)) {
    Say '  [!] Goi nay KEM SAN PHP + Node nhung khong thay/khong chay duoc tep trong runtime\.'
    if ($script:NodeWhy) { Say "      $script:NodeWhy" }
    Say '      Thuong do: giai nen chua het (mo thang trong file .zip), hoac chuong trinh diet virus xoa/chan tep.'
}
if (($FetchOnly -or ((-not $PhpExe -or -not $NodeExe) -and -not $env:JAGAME_NO_FETCH))) {
    Say '  Goi chua co san PHP/Node: dang tu tai (~70 MB, chi 1 lan, can Internet)...'
    New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
    if ($FetchOnly -or -not $PhpExe) { if (-not (Install-Php)) { Say '  [!] Chua tai duoc PHP.' } }
    if ($FetchOnly -or -not $NodeExe) { if (-not (Install-Node)) { Say '  [!] Chua tai duoc Node.' } }
    Remove-Item -LiteralPath (Join-Path $RuntimeDir '.cache') -Recurse -Force -ErrorAction SilentlyContinue
    $PhpExe = Find-Php
    $NodeExe = Find-Node
    if ($FetchOnly) { if ($PhpExe -and $NodeExe) { exit 0 } else { exit 2 } }
}
if (-not $PhpExe) {
    $s = Get-Command php.exe -ErrorAction SilentlyContinue
    if ($s) { $PhpExe = $s.Source }
}
if (-not $PhpExe) { Fail "Khong tim thay php.exe (va tu tai khong thanh cong - ly do o tren).`n      $FullPkgHint" }
if (-not $NodeExe) {
    $m = 'Khong tim thay Node.js (>= 22.13)'
    if ($script:NodeWhy) { $m += ".`n      Chi tiet: $script:NodeWhy" }
    if ($env:JAGAME_NO_FETCH) { $m += "`n      (JAGAME_NO_FETCH dang bat nen khong tu tai.)" } else { $m += "`n      Tu tai cung khong thanh cong - ly do o tren." }
    Fail "$m`n      $FullPkgHint"
}
Log "  php: $PhpExe"
if (-not (Test-Path -LiteralPath (Join-Path $RtDir 'server.js'))) { Fail 'Thieu thu muc Realtime\ (cong realtime).' }
if (-not (Test-Path -LiteralPath (Join-Path $RtDir 'node_modules\socket.io\package.json'))) {
    $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if ($Layout -eq 'dev' -and $npm) {
        Say '  Cai thu vien cho Realtime\ (lan dau)...'
        Push-Location $RtDir
        & $npm.Source install --omit=dev --no-audit --no-fund
        Pop-Location
    }
    if (-not (Test-Path -LiteralPath (Join-Path $RtDir 'node_modules\socket.io\package.json'))) { Fail 'Thieu Realtime\node_modules (tai lai goi day du).' }
}


# ---- Visual C++ Runtime: php.exe (vs16/vs17) can VCRUNTIME140.dll + VCRUNTIME140_1.dll ban x64 ----
# Goi Windows mac dinh KHONG kem vcruntime140*.dll (chua xac nhan giay phep phan phoi lai cua Visual Studio): may chua co
# Microsoft Visual C++ Redistributable thi tai BAN CHINH THUC cua Microsoft (aka.ms -> download.visualstudio.microsoft.com), kiem chu ky
# Authenticode cua Microsoft roi moi chay. Phan lon may Windows 10/11 da co san (nhieu ung dung cai kem) -> buoc nay bi bo qua.
if (-not (Test-Vc)) {
    $vcUrl = 'https://aka.ms/vs/17/release/vc_redist.x64.exe'
    $vcFile = Join-Path $env:TEMP 'jagame_vc_redist.x64.exe'
    Say ''
    Say '========================================'
    Say '  May chua co (hoac co ban cu) bo thu vien Microsoft Visual C++ Redistributable - PHP can no.'
    Say '  Dang tai ban CHINH THUC tu Microsoft (~25 MB, chi 1 lan) va cai.'
    Say '  Windows se hoi "Do you want to allow this app to make changes" - hay bam Yes.'
    Say '========================================'
    Remove-Item -LiteralPath $vcFile -Force -ErrorAction SilentlyContinue
    $vcOk = Get-File @($vcUrl) $vcFile
    if ($vcOk) {
        $sig = $null
        try { $sig = Get-AuthenticodeSignature -LiteralPath $vcFile } catch {}
        if (-not $sig -or $sig.Status -ne 'Valid' -or ([string]$sig.SignerCertificate.Subject) -notmatch 'O=Microsoft Corporation') {
            $st = ''; if ($sig) { $st = [string]$sig.Status }
            Say "  [LOI] Tep vc_redist tai ve KHONG mang chu ky hop le cua Microsoft ($st) - khong chay. (Mang/proxy thay tep?)"
            Remove-Item -LiteralPath $vcFile -Force -ErrorAction SilentlyContinue
            $vcOk = $false
        }
    }
    if ($vcOk) {
        Say '  Dang cai Microsoft Visual C++ Redistributable...'
        $vcRc = -1
        try { $vp = Start-Process -FilePath $vcFile -ArgumentList '/install /passive /norestart' -Wait -PassThru; $vcRc = $vp.ExitCode }
        catch { Say ('  [!] Khong chay duoc trinh cai: ' + (Err-Text $_)) }
        Log "  vc_redist ma thoat: $vcRc"
        if ($vcRc -eq 1223 -or $vcRc -eq 1602) { Say '  [!] Ban da bam No / huy cai dat.' }
        elseif ($vcRc -eq 3010) { Say '  Da cai xong (Windows co the can khoi dong lai).' }
        Remove-Item -LiteralPath $vcFile -Force -ErrorAction SilentlyContinue
    }
    if (-not (Test-Vc)) {
        Fail "Chua cai duoc Microsoft Visual C++ Redistributable (PHP can).`n      Tai tay ban chinh thuc cua Microsoft va cai: $vcUrl`n      (trang huong dan: https://learn.microsoft.com/cpp/windows/latest-supported-vc-redist)`n      Cai xong roi bam dup run_window.bat lan nua."
    }
}

# php.ini cua goi: LUON truyen -c bang duong dan TUONG DOI tu web root (moi lenh php chay voi thu muc hien tai = web root).
# PHP tu tim php.ini canh php.exe qua ten tep ANSI: thu muc co chu co dau (C:\Users\Nguyen Van A\...) -> khong thay php.ini
# -> khong nap sqlite3/gd/curl. Tham so ASCII tuong doi thi chac chan dung.
function Get-WebRel($abs) {
    $w = (Resolve-Path -LiteralPath $WebRoot).ProviderPath.TrimEnd('\')
    $up = Split-Path -Parent $w
    if ($abs.StartsWith($w + '\', [StringComparison]::OrdinalIgnoreCase)) { return $abs.Substring($w.Length + 1) }
    if ($up -and $abs.StartsWith($up.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) { return '..\' + $abs.Substring($up.TrimEnd('\').Length + 1) }
    return $abs
}
$PhpExe = (Resolve-Path -LiteralPath $PhpExe).ProviderPath
$PhpDirRel = Get-WebRel (Split-Path -Parent $PhpExe)
$PhpBase = @()
if (Test-Path -LiteralPath (Join-Path (Split-Path -Parent $PhpExe) 'php.ini')) { $PhpBase = @('-c', "$PhpDirRel\php.ini") }
function Invoke-Php {
    Push-Location -LiteralPath $WebRoot
    try { return (& $PhpExe @PhpBase @args 2>$null) } finally { Pop-Location }
}

# Tien ich bat buoc: sqlite3 (du lieu), gd (anh), curl (link xxxx.jagame.vn), mbstring (chu tieng Viet).
$mods = (Invoke-Php -m) | ForEach-Object { ([string]$_).Trim().ToLower() }
$missing = @()
foreach ($x in @('sqlite3', 'gd', 'curl', 'mbstring')) { if ($mods -notcontains $x) { $missing += "php-$x" } }
if ($missing.Count -gt 0) { Fail ("PHP ($PhpExe) thieu tien ich: " + ($missing -join ' ') + "`n      $FullPkgHint") }

# ---- Giam sat + Cap nhat 1 nut (RB-03, Web\application\libraries\Selfupdate.php) ----
# Lan chay nay la CHA: chay chinh file nay o che do CON (JAGAME_CHILD=1, phan duoi: PHP + Node). Con thoat ma 75 (Node nhan
# database\.restart) = khoi dong lai: doi ma ban moi dang cho (php update\apply.php apply - ban apply cua BAN CU), chay lai con,
# go /health?update=<nonce> toi da 90 s; khong dat -> tra ma cu (rollback) + chay lai. PowerShell doc het file luc bat dau nen thay
# run_window.ps1 tren dia khong anh huong cha; con moi lan doc ban moi. run_window.bat / keepalive_win.bat (cmd doc tung dong theo
# vi tri byte) KHONG BAO GIO bi thay khi dang chay. php.exe nhan duong dan TUONG DOI tu web root (tham so co chu co dau khong chac).
if (-not $env:JAGAME_CHILD) {
    $script:UpdRc = 3
    function Upd($cmd, $extra) {
        $script:UpdRc = 3
        if (-not (Test-Path -LiteralPath (Join-Path (Join-Path $WebRoot 'update') 'apply.php'))) { return '' }
        $a = $PhpBase + @('update/apply.php', $cmd, '.')
        if ($extra) { $a += $extra }
        Push-Location -LiteralPath $WebRoot
        try { $out = (& $PhpExe @a 2>$null | Out-String).Trim(); $script:UpdRc = $LASTEXITCODE } finally { Pop-Location }
        return $out
    }
    function Stop-Child($p) {
        # Em: Node thay database\.restart -> thoat -> con tu don PHP/Node/tunnel; qua 15 s thi giet ca cay tien trinh.
        try { [IO.File]::WriteAllText((Join-Path $DbDir '.restart'), '{"why":"stop"}') } catch {}
        if (-not $p.WaitForExit(15000)) { & taskkill.exe /PID $p.Id /T /F 2>&1 | Out-Null; [void]$p.WaitForExit(5000) }
        Remove-Item -LiteralPath (Join-Path $DbDir '.restart') -Force -ErrorAction SilentlyContinue
    }
    $psExe = (Get-Process -Id $PID).Path
    if (-not $psExe) { $psExe = 'powershell.exe' }
    while ($true) {
        Upd 'apply' | Out-Null
        $env:JAGAME_CHILD = '1'; $env:JAGAME_SUPERVISOR = '1'
        $child = Start-Process -FilePath $psExe -ArgumentList ('-NoProfile -ExecutionPolicy Bypass -File "' + $PSCommandPath + '"') -NoNewWindow -PassThru
        $null = $child.Handle   # giu handle de doc duoc ExitCode sau khi con thoat
        Remove-Item Env:JAGAME_CHILD -ErrorAction SilentlyContinue
        if ((Upd 'phase') -eq 'verifying') {
            Say '  Dang chay thu ban moi (toi da 90 giay)...'
            $ok = $false
            $why = 'timeout'   # ly do quay ve: ma thay chu (update_apply.php dich ra cau cho chu nha)
            for ($i = 0; $i -lt 90; $i++) {
                Start-Sleep -Seconds 1
                if ($child.HasExited) { $why = "exit:$($child.ExitCode)"; break }   # ban moi dung ngay: quay ve luon
                Upd 'check' | Out-Null
                if ($script:UpdRc -eq 0) { $ok = $true; break }
            }
            if (-not $ok) {
                Say "[!] Ban moi chua chay duoc ($why) - dang quay ve ban cu (du lieu giu nguyen)..."
                if (-not $child.HasExited) { Stop-Child $child }
                Upd 'rollback' $why | Out-Null
                $env:JAGAME_NO_BROWSER = '1'
                continue
            }
            Say '  Da cap nhat xong.'
        }
        $child.WaitForExit()
        $supRc = $child.ExitCode
        if ($supRc -ne 75) { exit $supRc }
        $env:JAGAME_NO_BROWSER = '1'
        Say '  Dang khoi dong lai hoi quan...'
    }
}

New-Item -ItemType Directory -Force -Path $CfConfDir, (Join-Path $DbDir 'sessions'), (Join-Path $WebRoot 'uploads\photos') | Out-Null
$WebReal = (Resolve-Path -LiteralPath $WebRoot).Path
$RtReal = (Resolve-Path -LiteralPath $RtDir).Path

# ---- Don tien trinh mo coi CUA DUNG THU MUC NAY (lan chay truoc bi tat dot ngot: cua so dong, kill) ----
function Test-ParentAlive($ppid) {
    if (-not $ppid) { return $false }
    return [bool](Get-Process -Id $ppid -ErrorAction SilentlyContinue)
}
function Stop-Orphans {
    $n = 0
    foreach ($pr in (Get-CimInstance Win32_Process -Filter "Name='php.exe' OR Name='node.exe'" -ErrorAction SilentlyContinue)) {
        $cl = $pr.CommandLine
        if (-not $cl) { continue }
        $mine = $false
        if ($pr.Name -eq 'node.exe' -and $cl.IndexOf((Join-Path $RtReal 'server.js'), [StringComparison]::OrdinalIgnoreCase) -ge 0) { $mine = $true }
        if ($pr.Name -eq 'php.exe' -and $cl -match 'router\.php' -and $pr.ExecutablePath -and
            ([string]::Equals($pr.ExecutablePath, $PhpExe, [StringComparison]::OrdinalIgnoreCase) -or
             [string]::Equals($pr.ExecutablePath, (Join-Path (Split-Path -Parent $PhpExe) 'php.exe'), [StringComparison]::OrdinalIgnoreCase))) { $mine = $true }
        if ($mine -and -not (Test-ParentAlive $pr.ParentProcessId)) {
            Stop-Process -Id $pr.ProcessId -Force -ErrorAction SilentlyContinue
            $n++
        }
    }
    return $n
}
$stale = Stop-Orphans
if ($stale -gt 0) { Say "[!] Don $stale tien trinh cu cua Jagame con giu cong (lan chay truoc bi tat dot ngot)."; Start-Sleep -Milliseconds 800 }

# ---- Chon cong: 6969 ban thi lui 6970/6971; PHP noi bo = cong + 1000..+1010 (chi 127.0.0.1) ----
function Get-Listeners {
    try { return @([Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() | ForEach-Object { $_.Port }) }
    catch { return @() }
}
$busy = Get-Listeners
$base = 6969
if ($env:JAGAME_PORT -match '^\d+$') { $base = [int]$env:JAGAME_PORT }
$Port = 0
foreach ($c in @($base, ($base + 1), ($base + 2))) {
    if ($busy -contains $c) { Say "[!] Cong $c dang ban (co the Jagame dang chay o cua so khac), thu cong khac..."; continue }
    $Port = $c; break
}
if ($Port -eq 0) { Fail "Ca 3 cong $base, $($base + 1), $($base + 2) deu ban. Dong bot cua so Jagame cu roi mo lai." 1 }
$PhpPort = 0
for ($c = $Port + 1000; $c -le $Port + 1010; $c++) { if ($busy -notcontains $c) { $PhpPort = $c; break } }
if ($PhpPort -eq 0) { Fail "Khong con cong trong cho PHP ($($Port + 1000)-$($Port + 1010))." 1 }
# .app_port = cong CONG KHAI (gateway): cloudflared/Tunnelrunner tro vao day.
[IO.File]::WriteAllText((Join-Path $DbDir '.app_port'), "$Port")
Remove-Item -LiteralPath (Join-Path $DbDir '.public_url') -Force -ErrorAction SilentlyContinue
# R3-07: dau .ensure_at cu con moi -> nhip /health dau bi bo qua, link chet them ~1 phut.
Remove-Item -LiteralPath (Join-Path $CfConfDir '.ensure_at') -Force -ErrorAction SilentlyContinue

# ---- cloudflared.exe (web tu bat tunnel; day chi bao dam co chuong trinh) ----
$CfBin = Join-Path $CfToolDir 'cloudflared.exe'
if (-not (Test-Path -LiteralPath $CfBin) -and -not (Get-Command cloudflared.exe -ErrorAction SilentlyContinue)) {
    Say '  Dang tai cloudflared.exe (lan dau)...'
    New-Item -ItemType Directory -Force -Path $CfToolDir | Out-Null
    if (-not (Get-File @('https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe') $CfBin)) {
        Say '  [!] Khong tai duoc cloudflared - trang chi mo duoc trong may/mang nha.'
    }
}

$Bind = 'localhost'
if ($env:JAGAME_BIND) { $Bind = $env:JAGAME_BIND }
Say '========================================'
Say '  Jagame'
Say "  May nay : http://localhost:$Port      (quan tri: /admin) - trinh duyet se tu mo"
if ($Bind -eq '0.0.0.0') { Say "  Mang nha: http://<dia-chi-IP-may-nay>:$Port" }
Say '  Internet: link rieng xxxx.jagame.vn tu tao sau khi cai dat xong'
Say '  Dong cua so nay (hoac Ctrl+C) de dung'
Say '========================================'

# ---- Nhat ky: day du o database\server.log (PHP) va database\realtime.log (Node), cat khi > 5 MB ----
$LogPhp = Join-Path $DbDir 'server.log'
$LogPhpOut = Join-Path $DbDir 'server.out.log'
$LogRt = Join-Path $DbDir 'realtime.log'
$LogRtErr = Join-Path $DbDir 'realtime.err.log'
foreach ($l in @($LogPhp, $LogPhpOut, $LogRt, $LogRtErr)) { try { Set-Content -LiteralPath $l -Value '' -Encoding Ascii } catch {} }

function Q($s) { return '"' + $s + '"' }
function Stop-Tunnel {
    foreach ($pr in (Get-CimInstance Win32_Process -Filter "Name='cloudflared.exe'" -ErrorAction SilentlyContinue)) {
        if ($pr.CommandLine -and $pr.CommandLine.IndexOf((Join-Path $CfConfDir 'jagame-tunnel.yml'), [StringComparison]::OrdinalIgnoreCase) -ge 0) {
            Stop-Process -Id $pr.ProcessId -Force -ErrorAction SilentlyContinue
        }
    }
    & taskkill.exe /F /T /FI 'WINDOWTITLE eq Jagame Tunnel*' 2>&1 | Out-Null
}

# ---- Chay PHP + Node (cung cua so; dong cua so la ca hai chet) ----
# PHP chi nghe 127.0.0.1 - moi truy cap tu ngoai di qua gateway (gateway dat X-Jagame-Client-IP = IP that).
# Windows khong ho tro nhieu worker cho php -S nen PHP_CLI_SERVER_WORKERS khong dat.
Remove-Item Env:PHP_CLI_SERVER_WORKERS -ErrorAction SilentlyContinue
$phpArgs = $PhpBase + @('-d', 'upload_max_filesize=64M', '-d', 'post_max_size=70M', '-d', 'memory_limit=768M', '-d', 'max_file_uploads=50',
             '-d', 'max_execution_time=300', '-d', 'max_input_vars=5000', '-d', 'date.timezone=Asia/Ho_Chi_Minh',
             '-d', 'expose_php=Off', '-d', 'display_errors=0', '-d', 'log_errors=1')
# cacert: duong dan TUONG DOI tu web root khi php nam trong goi (php.exe khong nhan chac tham so co chu co dau)
$caRel = ''
if (Test-Path -LiteralPath (Join-Path (Split-Path -Parent $PhpExe) 'extras\ssl\cacert.pem')) { $caRel = "$PhpDirRel\extras\ssl\cacert.pem" }
elseif (Test-Path -LiteralPath (Join-Path $RuntimeDir 'php\extras\ssl\cacert.pem')) { $caRel = "$PhpRel\extras\ssl\cacert.pem" }
elseif (Test-Path -LiteralPath (Join-Path $LegacyPhpDir 'extras\ssl\cacert.pem')) { $caRel = "$LegacyPhpRel\extras\ssl\cacert.pem" }
if ($caRel) { $phpArgs += @('-d', "curl.cainfo=$caRel", '-d', "openssl.cafile=$caRel") }
$phpArgs += @('-S', "127.0.0.1:$PhpPort", 'router.php')
$phpArgStr = ($phpArgs | ForEach-Object { if ($_ -match '[\s]') { Q $_ } else { $_ } }) -join ' '

$PhpProc = $null; $NodeProc = $null; $http = $null; $rc = 0
try {
    $PhpProc = Start-Process -FilePath $PhpExe -ArgumentList $phpArgStr -WorkingDirectory $WebReal -NoNewWindow -PassThru `
        -RedirectStandardError $LogPhp -RedirectStandardOutput $LogPhpOut
    $env:JAGAME_PORT = "$Port"; $env:JAGAME_BIND = $Bind; $env:JAGAME_PHP_PORT = "$PhpPort"; $env:JAGAME_WEB_ROOT = $WebReal
    $NodeProc = Start-Process -FilePath $NodeExe -ArgumentList (Q (Join-Path $RtReal 'server.js')) -WorkingDirectory $RtReal -NoNewWindow -PassThru `
        -RedirectStandardOutput $LogRt -RedirectStandardError $LogRtErr
    $null = $NodeProc.Handle; $null = $PhpProc.Handle   # giu handle de doc duoc ExitCode (ma 75 = khoi dong lai)

    Add-Type -AssemblyName System.Net.Http
    $http = New-Object System.Net.Http.HttpClient
    $http.Timeout = [TimeSpan]::FromSeconds(60)
    $ready = $false; $beatTask = $null; $nextBeat = [DateTime]::MinValue; $lastLink = ''; $started = Get-Date
    $tunFile = Join-Path $CfConfDir 'tunnel.json'
    $tunLog = Join-Path $CfConfDir 'tunnel.log'
    # Giu may thuc khi hoi quan chay (may ngu = link chet ca dem - HOME-SERVER-RELIABILITY #8); tat bang JAGAME_NO_CAFFEINATE=1.
    # SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED): man hinh van tat duoc; tu het khi script thoat.
    $keepAwake = $false
    if (-not $env:JAGAME_NO_CAFFEINATE) {
        try {
            Add-Type -Namespace Jagame -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);' -ErrorAction Stop
            [void][Jagame.Power]::SetThreadExecutionState([uint32]2147483649)
            $keepAwake = $true
        } catch {}
    }

    while ($true) {
        if ($PhpProc.HasExited) { Say "[!] PHP dung bat thuong (ma $($PhpProc.ExitCode)) - xem database\server.log."; $rc = 1; break }
        if ($NodeProc.HasExited) {
            # 75 = Node khoi dong lai theo yeu cau (Cap nhat 1 nut / database\.restart): cha (giam sat o tren) doi ma neu co roi chay lai.
            if ($NodeProc.ExitCode -eq 75 -and $env:JAGAME_SUPERVISOR) { Say '  Dang khoi dong lai...'; $rc = 75; break }
            Say "[!] Cong realtime (Node) dung bat thuong (ma $($NodeProc.ExitCode)) - xem database\realtime.log."; $rc = 1; break
        }
        if (-not $ready) {
            # Cho trang san sang qua gateway (503/502 khi PHP chua len chua tinh la san sang)
            try {
                $r = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 2
                if ($r.StatusCode -eq 200) { $ready = $true }
            } catch {}
            if ($ready -and -not $env:JAGAME_NO_BROWSER) { try { Start-Process "http://localhost:$Port/" } catch {} }
            if (-not $ready -and ((Get-Date) - $started).TotalSeconds -gt 60 -and -not $beatTask) { $ready = $true }
        } else {
            # Nhip go: /health?beat=1 moi phut -> web tu xin link / bat lai tunnel (khong chan vong giam sat)
            if ($beatTask -and $beatTask.IsCompleted) {
                $beatTask = $null
                $nextBeat = (Get-Date).AddSeconds(60)
                $h = ''
                try {
                    $j = Get-Content -LiteralPath $tunFile -Raw -ErrorAction Stop | ConvertFrom-Json
                    if ($j.mode -eq 'token' -and $j.hostname) { $h = [string]$j.hostname }
                } catch {}
                if (-not $h -and (Test-Path -LiteralPath $tunLog)) {
                    $m = [regex]::Matches([string](Get-Content -LiteralPath $tunLog -Raw -ErrorAction SilentlyContinue), 'https://(?!api\.)([a-z0-9-]+\.trycloudflare\.com)')
                    if ($m.Count -gt 0) { $h = $m[$m.Count - 1].Groups[1].Value }
                }
                if ($h -and $h -ne $lastLink) {
                    $lastLink = $h
                    Say ''
                    Say "  >>> Link cho ban be/nguoi than: https://$h   (ma QR: Quan tri -> Tong quan)"
                }
            } elseif (-not $beatTask -and (Get-Date) -ge $nextBeat) {
                $beatTask = $http.GetAsync("http://127.0.0.1:$Port/health?beat=1")
            }
        }
        Start-Sleep -Seconds 1
    }
} finally {
    # Don dep khi thoat: Node + PHP + tunnel do web bat (nhan ra qua file cau hinh rieng)
    if ($keepAwake) { try { [void][Jagame.Power]::SetThreadExecutionState([uint32]2147483648) } catch {} }
    if ($http) { $http.Dispose() }
    foreach ($p in @($NodeProc, $PhpProc)) {
        if ($p -and -not $p.HasExited) { try { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue } catch {} }
    }
    Stop-Orphans | Out-Null
    Stop-Tunnel
    Remove-Item -LiteralPath (Join-Path $CfConfDir 'web_tunnel.pid'), (Join-Path $DbDir '.public_url') -Force -ErrorAction SilentlyContinue
    Say ''
    Say 'Da dung.'
}
if ($rc -eq 0) { $rc = 1 }
exit $rc
