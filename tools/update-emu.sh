#!/bin/bash
# Обновить emu/ свежей прошивкой: origin/main репо m5-health-counter → web/build.sh → emu/.
# Правило: на странице всегда самая актуальная прошивка — запускать перед каждой публикацией.
#   tools/update-emu.sh [путь к m5-health-counter]   (или STASIK_FW=путь; по умолчанию ~/projects/m5-health-counter)
# Рабочую копию прошивки не трогает: собирает во временной копии (git archive),
# вместо настоящего secrets.h подкладывает secrets.example.h.
set -euo pipefail
PAGE="$(cd "$(dirname "$0")/.." && pwd)"
FW="${1:-${STASIK_FW:-$HOME/projects/m5-health-counter}}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

git -C "$FW" fetch -q origin main
REV=$(git -C "$FW" rev-parse --short origin/main)
echo "прошивка origin/main @ $REV: $(git -C "$FW" log -1 --format=%s origin/main | cut -c1-90)"

git -C "$FW" archive origin/main | tar -x -C "$TMP"
mkdir -p "$TMP/.pio"
ln -s "$FW/.pio/libdeps" "$TMP/.pio/libdeps"
cp "$TMP/include/secrets.example.h" "$TMP/include/secrets.h"
# кэш объектников из рабочей копии НЕ берём: он собран с настоящим secrets.h,
# а файлы из git archive старше него — устаревшие .o попали бы в сборку

(cd "$TMP" && bash web/build.sh >/dev/null)

# проверка на секреты: ни одно значение из secrets_ota.ini / secrets.h не должно попасть в сборку
hits=0
while IFS= read -r v; do
  [ -n "$v" ] && grep -qaF -- "$v" "$TMP"/web/dist/* && { echo "СЕКРЕТ В СБОРКЕ: ${v:0:3}…"; hits=1; }
done < <( { sed -n 's/^[^=#;]*=[[:space:]]*//p' "$FW/secrets_ota.ini" 2>/dev/null
            grep -ho '"[^"]\{4,\}"' "$FW/include/secrets.h" 2>/dev/null | tr -d '"'; } | sed 's/[[:space:]]*$//')
[ $hits = 0 ] || { echo "emu/ не обновлён"; exit 1; }

cp "$TMP"/web/dist/{index.html,stasik.js,stasik.wasm} "$PAGE/emu/"
echo "$REV $(git -C "$FW" log -1 --format=%cI origin/main)" > "$PAGE/emu/VERSION"
echo "emu/ обновлён до $REV (секретов нет)"
