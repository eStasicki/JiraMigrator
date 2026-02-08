#!/bin/bash
cd "$(dirname "$0")"

# 1. Clean up any orphaned processes
pkill -f "vite dev" > /dev/null 2>&1 || true

# 2. Start the local server in the background
pnpm run dev > /dev/null 2>&1 &
SERVER_PID=$!

# 3. Wait for the server to be ready
echo "Uruchamianie serwera... proszę czekać."
for i in {1..30}; do
  if curl -s http://localhost:5173 > /dev/null; then
    break
  fi
  sleep 1
done

# 4. Open the application in blocking mode
# This keeps the terminal waiting until the window is closed
if [ -d "/Applications/Google Chrome.app" ]; then
  echo "Otwieranie okna aplikacji (Chrome App Mode)..."
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --app=http://localhost:5173
else
  echo "Nie znaleziono Chrome. Otwieranie w domyślnej przeglądarce..."
  # -W waits for the app to quit (supported by most browsers on Mac)
  open -W http://localhost:5173
fi

# 5. When the user closes the window, kill the background server
echo "Zamykanie aplikacji..."
kill $SERVER_PID > /dev/null 2>&1 || true
pkill -f "vite dev" > /dev/null 2>&1 || true

# 6. Exit the terminal window
exit
