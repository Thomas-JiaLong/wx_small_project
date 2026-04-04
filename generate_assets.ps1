$ErrorActionPreference = 'SilentlyContinue'
$baseDir = "E:\codeProject\wx_small_project\used_books\miniprogram"
$outFile = "E:\codeProject\wx_small_project\cloud_assets.json"
$images = @('logo.png','startBg.jpg','kefu.jpg','isbn.jpg','poster.jpg','code.png','success.png','blank.png','suc.png','avator.png')
$out = @{}

foreach ($img in $images) {
    $f = Join-Path $baseDir "images\$img"
    if (Test-Path $f) {
        $bytes = [IO.File]::ReadAllBytes($f)
        $b64 = [Convert]::ToBase64String($bytes)
        $mime = switch -Regex ($img) {
            '\.png$' { 'image/png' }
            '\.jpg$' { 'image/jpeg' }
            '\.jpeg$' { 'image/jpeg' }
            Default { 'image/png' }
        }
        $key = $img -replace '\.(png|jpg|jpeg)$',''
        $out[$key] = @{
            filename = $img
            mime = $mime
            size = $bytes.Length
            base64 = $b64
        }
        Write-Host "$img -> $([math]::Round($bytes.Length/1KB,1)) KB (base64: $([math]::Round($b64.Length/1KB,1)) KB)"
    } else {
        Write-Host "MISSING: $img"
    }
}

$json = $out | ConvertTo-Json -Depth 10
[IO.File]::WriteAllText($outFile, $json, [Text.Encoding]::UTF8)
Write-Host ""
Write-Host "Done! Total images: $($out.Count)"
Write-Host "Output: $outFile"
Write-Host "Total base64 size: $([math]::Round(($json.Length)/1KB,1)) KB"
