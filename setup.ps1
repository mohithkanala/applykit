# ApplyKit setup for Windows PowerShell: dependencies + gstack. Safe to re-run.
# Run:  powershell -ExecutionPolicy Bypass -File .\setup.ps1
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

foreach ($tool in "git", "node", "python") {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        Write-Host "Missing $tool. Install it first (git-scm.com, nodejs.org, python.org), then re-run."
        exit 1
    }
}

Write-Host "1/3 Node packages"
npm install --silent

Write-Host "2/3 Python packages"
python -m pip install --quiet python-docx docx2pdf pypdf

Write-Host "3/3 gstack"
$gstack = Join-Path $HOME ".claude\skills\gstack"
if (-not (Test-Path $gstack)) {
    git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git $gstack
}
$bash = Get-Command bash -ErrorAction SilentlyContinue
$bun = Get-Command bun -ErrorAction SilentlyContinue
if ($bash -and $bun) {
    & bash -c "cd ~/.claude/skills/gstack && ./setup"
} else {
    Write-Host "gstack needs Git Bash and Bun (https://bun.sh) to finish. Install them, then in Git Bash run: cd ~/.claude/skills/gstack && ./setup"
}

Write-Host ""
Write-Host "Done. Next: run 'claude' in this folder and say hello. It will ask for your base resume."
