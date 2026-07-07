#!/bin/bash
echo "Starting job-hunt services..."

# Start FastAPI scraper
cd scraper
source venv/bin/activate
uvicorn main:app --reload --port 8000 &
SCRAPER_PID=$!
cd ..

# Start Next.js web app
cd web
npm run dev &
NEXT_PID=$!
cd ..

# Handle graceful shutdown
trap "kill $SCRAPER_PID $NEXT_PID" EXIT
wait
