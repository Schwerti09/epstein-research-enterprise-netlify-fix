#!/bin/bash
set -e

echo "🚀 Enterprise Setup (Template)"
echo "=============================="

if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "✅ .env erstellt. Bitte Werte eintragen (NEON_DATABASE_URL etc.)"
fi

echo "🐳 Docker Compose build & up..."
docker compose up -d --build

echo "✅ Fertig."
echo "Frontend: http://localhost:8888"
echo "API:      http://localhost:3001/health"
echo "AI:       http://localhost:8000/docs"
