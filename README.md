# stasik-page

Страница проекта «Стасик» для портфолио — https://eyeanton.github.io/stasik-page/
(план — `m5-health-counter/docs/portfolio-page.md`). По мотивам play.date, в цветах портфолио (Lighthouse):
сплошной кобальт `#2563e0`, белый текст, одна красная кнопка `#ec2f1f`, Montserrat.

- `index.html` — страница: разделы «Стасик. / Железо. / Скорость. / Плавность.» слева, справа липкая 3D-модель,
  которая поворачивается под раздел (`data-pose`); ниже «Приложения.» (скриншоты) и «Пульт.».
- `stasik3d.js` — 3D-модель M5Stack Basic v2.7 (three.js) по официальному чертежу (54 × 54 × 17 мм, экран 2" 320×240,
  кнопки A/B/C). В экране — живая прошивка: эмулятор из `emu/` в скрытом iframe, его canvas идёт текстурой;
  клики по 3D-кнопкам и ← ↓ → (когда модель в фокусе) уходят в `Module._web_button`. Позы — `setPose()`,
  выгрузка в .glb — `exportGLB()`.
- `emu/` — веб-сборка прошивки, `emu/VERSION` — коммит, из которого собрана.
- `assets/apps/` — скриншоты приложений, снятые из эмулятора.

## Обновление (перед каждой публикацией)
Правило: на странице всегда самая свежая прошивка.

```
tools/update-emu.sh     # origin/main m5-health-counter → web/build.sh → emu/ (+ проверка на секреты)
tools/update-shots.sh   # пересъёмка assets/apps из нового emu/ (сценарии нажатий — tools/capture-apps.html)
```

Локально: `python3 -m http.server 8765` → http://localhost:8765/
