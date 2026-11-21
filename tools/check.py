"""Проверка страницы перед публикацией (без зависимостей, без сети): python3 tools/check.py

1. все локальные ссылки index.html (src/href) и скриншоты assets/apps существуют;
2. сборка эмулятора на месте: emu/index.html, stasik.js, stasik.wasm и emu/VERSION вида «<rev> <ISO-дата>»;
3. сценарии tools/capture-apps.html совпадают с картинками, на которые ссылается index.html;
4. в репо нет личных путей, адресов домашней сети и похожих на ключи строк (в том числе внутри stasik.wasm).
Код возврата 0 — всё в порядке, 1 — есть ошибки (список в выводе).
"""
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
errors = []


def read(rel, mode="r"):
    with open(os.path.join(ROOT, rel), mode, **({} if "b" in mode else {"encoding": "utf-8"})) as f:
        return f.read()


# 1. локальные ссылки
html = read("index.html")
refs = set(re.findall(r'(?:src|href)="([^"#:?]+)"', html))
for ref in sorted(refs):
    if not os.path.exists(os.path.join(ROOT, ref)):
        errors.append(f"index.html ссылается на несуществующий {ref}")
for ref in re.findall(r"fetch\('([^':]+)'\)", html):
    if not os.path.exists(os.path.join(ROOT, ref)):
        errors.append(f"index.html: fetch несуществующего {ref}")

# 2. эмулятор
for f in ("emu/index.html", "emu/stasik.js", "emu/stasik.wasm", "emu/VERSION"):
    p = os.path.join(ROOT, f)
    if not os.path.isfile(p) or os.path.getsize(p) == 0:
        errors.append(f"нет или пустой {f}")
if os.path.isfile(os.path.join(ROOT, "emu/VERSION")):
    v = read("emu/VERSION").strip()
    if not re.fullmatch(r"[0-9a-f]{7,40} \d{4}-\d\d-\d\dT[\d:]+([+-]\d\d:\d\d|Z)", v):
        errors.append(f"emu/VERSION неожиданного вида: {v!r}")
if "_web_button" not in read("emu/stasik.js", "rb").decode("utf-8", "replace"):
    errors.append("emu/stasik.js не экспортирует _web_button — кнопки модели не будут работать")

# 3. сценарии съёмки ↔ скриншоты
shots = set(re.findall(r"assets/apps/([\w-]+)\.png", html))
jobs = set(re.findall(r"\['([\w-]+)',", read("tools/capture-apps.html")))
for s in sorted(shots - jobs):
    errors.append(f"assets/apps/{s}.png на странице, но нет сценария в tools/capture-apps.html")

# 3a. синтаксис stasik3d.js (если есть node; без него шаг пропускается)
try:
    r = subprocess.run(["node", "--experimental-default-type=module", "--check", os.path.join(ROOT, "stasik3d.js")],
                       capture_output=True, text=True)
    if r.returncode:
        errors.append("stasik3d.js: синтаксическая ошибка\n" + r.stderr.strip()[:400])
except OSError:
    print("node не найден — проверка синтаксиса stasik3d.js пропущена")

# 4. секреты и личные пути
SUSPECT = re.compile(rb"/Users/[\w.-]+|/home/[\w.-]+|C:\\\\Users|192\.168\.\d+\.\d+|100\.\d+\.\d+\.\d+"
                     rb"|sk-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{30,}|ghp_[A-Za-z0-9]{30,}|\d{8,10}:AA[\w-]{30,}")
try:
    tracked = subprocess.run(["git", "-C", ROOT, "ls-files"], capture_output=True, text=True, check=True).stdout.split()
except (OSError, subprocess.CalledProcessError):
    tracked = [os.path.relpath(os.path.join(d, f), ROOT) for d, _, fs in os.walk(ROOT)
               if "/." not in d[len(ROOT):] for f in fs]
for rel in tracked:
    if rel.endswith(".png") or rel == "tools/check.py":
        continue
    for m in SUSPECT.finditer(read(rel, "rb")):
        errors.append(f"{rel}: подозрительная строка {m.group().decode('latin-1')[:12]}…")

if errors:
    print("ОШИБКИ:")
    for e in errors:
        print(" -", e)
    sys.exit(1)
print(f"ok: {len(refs)} ссылок, {len(shots)} скриншотов, {len(tracked)} файлов без секретов")
