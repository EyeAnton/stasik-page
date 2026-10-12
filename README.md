# stasik-page

Страница проекта «Стасик» для портфолио https://eyeanton.github.io/ (план — `m5-health-counter/docs/portfolio-page.md`).

- `index.html` + `stasik3d.js` — 3D-модель M5Stack Basic v2.7 (three.js) по официальному чертежу
  (54 × 54 × 17 мм, экран 2" 320×240, кнопки A/B/C). В экране — живая прошивка: эмулятор из `emu/`
  грузится в скрытый iframe, его canvas идёт текстурой; клики по 3D-кнопкам и ← ↓ → уходят в `Module._web_button`.
- «Скачать .glb» — выгрузка модели с текущим кадром экрана.
- `emu/` — копия `m5-health-counter/web/dist` (`web/build.sh`). Перед публикацией проверять сборку на значения из `secrets_ota.ini`.

Локально: `python3 -m http.server 8765` → http://localhost:8765/
