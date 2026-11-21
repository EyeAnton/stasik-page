#!/bin/bash
# Пересъёмка скриншотов приложений (assets/apps/*.png) из эмулятора в emu/ — после tools/update-emu.sh.
# Сценарии нажатий — в tools/capture-apps.html (меняется меню прошивки → поправить там).
set -euo pipefail
PAGE="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
PORT=8799
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"   # другой браузер — CHROME=/путь
[ -x "$CHROME" ] || { echo "нет Chrome: $CHROME (задайте CHROME=/путь)"; exit 1; }
python3 "$PAGE/tools/capture_server.py" "$PAGE" "$TMP/shots" $PORT &
SRV=$!
"$CHROME" --headless=new --use-angle=swiftshader \
  --enable-unsafe-swiftshader --user-data-dir="$TMP/chrome" "http://127.0.0.1:$PORT/tools/capture-apps.html" >/dev/null 2>&1 &
CH=$!
trap 'kill $CH $SRV 2>/dev/null; rm -rf "$TMP"' EXIT
for i in $(seq 240); do
  [ -f "$TMP/shots/done.txt" ] || [ -f "$TMP/shots/error.txt" ] && break
  sleep 1
done
[ -f "$TMP/shots/done.txt" ] || { echo "съёмка не удалась: $(cat "$TMP/shots/error.txt" 2>/dev/null || echo таймаут)"; exit 1; }
cp "$TMP"/shots/*.png "$PAGE/assets/apps/"
ls "$PAGE/assets/apps"
