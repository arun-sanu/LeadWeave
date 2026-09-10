Write-Host "🚀 Installing LeadWeave WhatsApp API Gateway..." -ForegroundColor Green

# 1. Install Node & Git via Winget if missing
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "🟢 Installing Node.js LTS..." -ForegroundColor Yellow
    winget install OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "📦 Installing Git..." -ForegroundColor Yellow
    winget install Git.Git --silent --accept-source-agreements --accept-package-agreements
}

# Update PATH env in current session
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# 2. Check/Clone repository
if (-not (Test-Path "package.json")) {
    Write-Host "📥 Cloning LeadWeave repository..." -ForegroundColor Yellow
    git clone https://github.com/arun-sanu/LeadWeave.git leadweave
    Set-Location leadweave
}

# 3. Install & Build
Write-Host "⚡ Installing app dependencies & building..." -ForegroundColor Yellow
npm install
npm run build:all

# 4. Optional / Automated HTTPS & Caddy Setup
$TargetUrl = "http://localhost:2785"
if (Test-Path "Caddyfile") {
    if (-not (Get-Command caddy -ErrorAction SilentlyContinue)) {
        Write-Host "🔒 Installing Caddy for local HTTPS..." -ForegroundColor Yellow
        winget install CaddyServer.Caddy --silent --accept-source-agreements --accept-package-agreements
    }
    $TargetUrl = "https://leadweave.local"
}

# 5. Create Desktop Shortcut
Write-Host "🖥️ Creating Desktop icon..." -ForegroundColor Yellow
node scripts/create-shortcut.js $TargetUrl

Write-Host "🎉 LeadWeave setup complete! Starting server..." -ForegroundColor Green
Write-Host "🌐 Dashboard will be available at: $TargetUrl" -ForegroundColor Cyan
npm start
