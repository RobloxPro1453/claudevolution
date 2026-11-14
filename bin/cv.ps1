# claudevolution CLI launcher (PowerShell). Uses Node if installed, otherwise Deno.
$script = Join-Path $PSScriptRoot "cv.js"
if (Get-Command node -ErrorAction SilentlyContinue) { & node $script @args; exit $LASTEXITCODE }
if (Get-Command deno -ErrorAction SilentlyContinue) { & deno run -A --quiet $script @args; exit $LASTEXITCODE }
Write-Host "claudevolution: Node ya da Deno bulunamadi. Birini kurun ve yeniden deneyin."
exit 127
