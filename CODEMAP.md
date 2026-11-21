# CODEMAP — stasik-page

Статичный сайт без сборки: GitHub Pages раздаёт файлы как есть (ветка `model`).

## Модули

| Файл | Что делает |
|---|---|
| `index.html` | Вся страница: стили (токены Lighthouse в `:root`), разделы с `data-pose`, сетка скриншотов, inline-модуль: `mount()`, IntersectionObserver → `setPose()`, кнопка «Скачать .glb», подпись версии прошивки из `emu/VERSION`. three.js подключается importmap'ом с jsDelivr (`three@0.170.0`). |
| `stasik3d.js` | ES-модуль. `buildStasik(texture)` — геометрия корпуса по чертежу (мм); `mount({canvas, emuFrame, onReady})` — сцена, камера, OrbitControls, позы, ввод (клики по 3D-кнопкам, ← ↓ →/A S D/пробел), цикл кадров; возвращает `{ setPose(name), exportGLB() }`. `packGLB()` — сборка GLB из glTF-JSON. |
| `emu/` | **Сгенерировано** `tools/update-emu.sh` из `m5-health-counter/web/build.sh` (Emscripten). Руками не править. `index.html` рисует кадры в `<canvas id="screen">`, `stasik.js` + `stasik.wasm` — прошивка, экспорт `Module._web_button(i, down)`. `VERSION` — «<rev> <ISO-дата>». |
| `assets/apps/*.png` | Скриншоты приложений 320×240, **сгенерированы** `tools/update-shots.sh`. |
| `tools/update-emu.sh` | origin/main прошивки → временная копия (git archive, `secrets.example.h`) → сборка → проверка на секреты → `emu/`. |
| `tools/update-shots.sh` | headless Chrome открывает `tools/capture-apps.html`, тот гоняет эмулятор по сценариям нажатий и POST'ит кадры в `tools/capture_server.py` → `assets/apps/`. |
| `tools/capture_server.py` | Статика + приём снимков (`POST /save?name=`), только 127.0.0.1. `/slow?ms=` — задержка ответа для ручных скриншотов страницы. |
| `tools/check.py` | Проверка перед публикацией: ссылки, комплект `emu/`, сценарии ↔ скриншоты, синтаксис `stasik3d.js`, отсутствие личных путей и ключей. |

## Потоки данных

```
m5-health-counter (origin/main)
   └─ tools/update-emu.sh ──► emu/{index.html,stasik.js,stasik.wasm,VERSION}
                                   │
                                   ├─ tools/update-shots.sh ──► assets/apps/*.png
                                   ▼
index.html ── <iframe id="emu" src="emu/index.html"> (скрыт за экраном)
   │                    │ canvas#screen
   │                    ▼
   └─ stasik3d.js: CanvasTexture(canvas#screen) ─► экран 3D-модели (обновляется каждый кадр)
        ▲ клики по 3D-кнопкам / клавиши ──► emu.Module._web_button(i, 0|1)
        ▲ раздел в центре экрана (IntersectionObserver) ──► setPose(data-pose)
        └─ «Скачать .glb» ──► exportGLB(): снимок экрана в свой canvas → GLTFExporter (JSON) → packGLB
```

Эмулятор и страница — один origin, поэтому `contentDocument`/`contentWindow` iframe доступны. Состояние
прошивки эмулятор хранит в `localStorage` с префиксом `stasik:`.
