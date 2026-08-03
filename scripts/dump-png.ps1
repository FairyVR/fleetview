# Dumps every calibration screenshot to a raw RGBA file that scripts/check-calibration.ts can
# read (Node has no PNG decoder). Layout: uint32 width, uint32 height, then width*height*4 bytes.
Add-Type -AssemblyName System.Drawing
$dir = Join-Path $PSScriptRoot '..\src\renderer\src\assets\board-calibration'
Get-ChildItem (Join-Path $dir '*.png') | ForEach-Object {
  $bmp = New-Object System.Drawing.Bitmap($_.FullName)
  $w = $bmp.Width; $h = $bmp.Height
  $rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
  $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly,
                        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $bytes = New-Object byte[] ($data.Stride * $h)
  [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
  $bmp.UnlockBits($data)
  $bmp.Dispose()

  # Written as GDI+ hands it over — BGRA. check-calibration.ts swaps to RGBA; doing it here
  # costs ~45s per image, because PowerShell walks 8M bytes one at a time.
  $out = [System.IO.Path]::ChangeExtension($_.FullName, '.raw')
  $fs = [System.IO.File]::Create($out)
  $fs.Write([BitConverter]::GetBytes([uint32]$w), 0, 4)
  $fs.Write([BitConverter]::GetBytes([uint32]$h), 0, 4)
  $fs.Write($bytes, 0, $bytes.Length)
  $fs.Close()
  Write-Host "$($_.Name) -> $([System.IO.Path]::GetFileName($out))  ${w}x${h}"
}
