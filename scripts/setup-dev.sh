#!/bin/bash

# Development setup script for EVE Trading Assistant

echo "🚀 Setting up EVE Trading Assistant development environment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Prerequisites check passed"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your configuration before starting services"
fi

# Build shared utilities
echo "🔧 Building shared utilities..."
npm run build:shared

echo "✅ Development environment setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your configuration"
echo "2. Start services with: npm run docker:up"
echo "3. Or start in development mode: npm run dev"
echo ""
echo "Available commands:"
echo "  npm run dev          - Start all services in development mode"
echo "  npm run docker:up    - Start with Docker Compose"
echo "  npm run test         - Run tests"
echo "  npm run lint         - Run linting"
echo "  npm run build        - Build all services"