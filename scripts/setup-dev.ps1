# Development setup script for EVE Trading Assistant (PowerShell)

Write-Host "🚀 Setting up EVE Trading Assistant development environment..." -ForegroundColor Green

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    $versionNumber = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    if ($versionNumber -lt 18) {
        Write-Host "❌ Node.js version 18+ is required. Current version: $nodeVersion" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Node.js version check passed: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed. Please install Node.js 18+ first." -ForegroundColor Red
    exit 1
}

# Check if Docker is installed
try {
    docker --version | Out-Null
    Write-Host "✅ Docker is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not installed. Please install Docker first." -ForegroundColor Red
    exit 1
}

# Check if Docker Compose is installed
try {
    docker-compose --version | Out-Null
    Write-Host "✅ Docker Compose is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker Compose is not installed. Please install Docker Compose first." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Prerequisites check passed" -ForegroundColor Green

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm install

# Copy environment file if it doesn't exist
if (-not (Test-Path ".env")) {
    Write-Host "📝 Creating .env file from template..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "⚠️  Please edit .env file with your configuration before starting services" -ForegroundColor Yellow
}

# Build shared utilities
Write-Host "🔧 Building shared utilities..." -ForegroundColor Yellow
npm run build:shared

Write-Host "✅ Development environment setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Edit .env file with your configuration"
Write-Host "2. Start services with: npm run docker:up"
Write-Host "3. Or start in development mode: npm run dev"
Write-Host ""
Write-Host "Available commands:" -ForegroundColor Cyan
Write-Host "  npm run dev          - Start all services in development mode"
Write-Host "  npm run docker:up    - Start with Docker Compose"
Write-Host "  npm run test         - Run tests"
Write-Host "  npm run lint         - Run linting"
Write-Host "  npm run build        - Build all services"