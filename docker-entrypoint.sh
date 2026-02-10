#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy 2>/dev/null || npx prisma db push --accept-data-loss

echo "Seeding database..."
npx tsx prisma/seed.ts 2>/dev/null || echo "Seed skipped or already applied"

echo "Starting application..."
exec "$@"
