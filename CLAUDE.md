# Liquid Type – Hinweise für Claude Code

## Projekt

Statische Browseranwendung: Schrift als 2D-Flüssigkeit mit WebGL2-Rendering. Keine npm-Pakete, kein `npm install`; Node.js 22 oder neuer genügt.

- `npm test` – Physik-, Gleichgewichts- und Buildtests (`node --test`)
- `npm run build` – erzeugt `dist/` und `Liquid-Type-Offline.html` aus `src/`
- `npm run dev` – lokaler Entwicklungsserver auf http://127.0.0.1:5173

Seiten: Hauptseite `src/index.html` mit `src/app.mjs`; Unterseite `src/MS/` (Matthias Sütterlin, flüssige Initialen). Beide nutzen die gemeinsamen Engine-Module `physics.mjs`, `render.mjs`, `glyphs.mjs` und `quality.mjs`. Neue Unterseiten als eigenen Ordner unter `src/` anlegen und in `scripts/build.mjs` in die Ordnerliste aufnehmen.

Die Physik kennt optional `gravityX`/`gravityY` in den Parametern (px/s²), `homing` als Faktor auf die Feder zur Schriftform, `solo` (keine Nachbarkräfte, für Seitenübergänge mit vielen Partikeln), `drag` (zusätzliche Dämpfung in 1/s) sowie `free[i]` je Partikel mit `dripGravity` für freigegebene Tropfen; `nudge` schubst die ganze Flüssigkeit. Der Renderer zeichnet die Tropfengröße je Partikel aus `fluid.dropSize` (sonst einheitlich aus dem Rasterabstand), kann bewegte Tropfen mit `dropShrink` kleiner zeichnen, mit `fine` (`grow`, `amp`) im Flug schlanker und zusammenhängend zeichnen und mit `calm` gegen Ende eines Übergangs beruhigen; die Vorgaben lassen die Hauptseite unverändert. `glyphLattice` in `glyphs.mjs` tastet Schrift auf einem Raster ab, dessen Abstand der gemessenen Strichstärke folgen kann. `src/MS/match.mjs` paart Start- und Zielpunkte eines Übergangs so, dass Nachbarn Nachbarn bleiben. `src/quality.mjs` passt beide Seiten an schwache Geräte an: Startschätzung aus den Gerätemeldungen, danach Regler für Zeichenauflösung (`renderer.maxScale`) und Partikelanteil nach der Bildrate. `?quality=0` erzwingt volle Qualität; Pixelvergleiche der Hauptseite deshalb mit `?quality=0` machen, denn ein Testbrowser mit Softwaredarstellung startet sonst mit weniger Partikeln. `src/MS/coupling.mjs` lässt die Flüssigkeit auf der zupfbaren Linie aufliegen und meldet Last und Aufprall. `src/MS/sensors.mjs` richtet die Bewegungssensoren aus: Achsen und Vorzeichen unterscheiden sich je Gerät und Browser, deshalb lernt die Seite aus der Schwerkraft eines aufrecht gehaltenen Handys, wo unten ist. Die Physikparameter der MS-Seite (`parameters`) und alle Stellgrößen der Effekte (`defaults` oben in `src/MS/ms.mjs`) stehen auf einem von Hannes gewünschten, von Claude abgestimmten Sweet Spot: Viskosität 0,55, Oberflächenspannung 0,7, Anziehung 0,85, Impulsstärke 1,8. Zusammensetzen und die Rückkehr nach dem Platzen laufen über eine ausblendende Einschwingphase (`settleFor`). Das Einstellfeld erscheint nur mit `?tune` oder `?debug` in der Adresse; nur dann werden gespeicherte Werte (localStorage `ms-tune`) geladen. Wenn Hannes Werte nennt, die ihm gefallen, gehören sie als neue Vorgaben in `defaults` beziehungsweise `parameters`. `?debug` zeigt Sensorwerte live und stellt die Simulation unter `window.liquidType` bereit. Der Build stempelt Verweise in `dist/` mit einem Hash aller Quellen (`?v=…`), deshalb ändern sich nach jeder Quelländerung auch Verweise in erzeugten Dateien.

Änderungen immer in `src/` vornehmen. `dist/` und `Liquid-Type-Offline.html` sind eingecheckt und werden ausschließlich vom Build erzeugt: nach jeder Quelländerung `npm run build` ausführen und die erzeugten Dateien im selben Commit mitführen. Die CI bricht ab, wenn sie nicht zum Quellstand passen.

Keine neuen Laufzeitabhängigkeiten einführen. Oberfläche, Dokumentation und Commit-Texte auf Deutsch; Code-Kommentare dürfen Englisch bleiben.

## Fester Arbeitsablauf (von Hannes festgelegt am 02.10.2026)

Nach **jeder** Änderung automatisch und ohne Rückfrage:

1. Arbeitsbranch von `origin/main` anlegen oder darauf neu aufsetzen (`claude/<thema>`). Niemals direkt auf `main` committen.
2. Vor dem Push lokal `npm test` und `npm run build` ausführen. Nur grün pushen.
3. Pull Request gegen `main` öffnen (kein Draft) und sofort mergen (Squash-Merge).
4. Der Merge auf `main` startet den Workflow `.github/workflows/pages.yml`: Tests, Build und Deployment auf GitHub Pages. Den Lauf abwarten und prüfen. Schlägt er fehl, sofort nachbessern: neuer Branch, PR, Merge.
5. Zum Abschluss die Live-URL nennen: https://hannespix.github.io/liquidtype/

Jede Änderung bekommt einen eigenen PR, auch kleine. Erzeugte Dateien gehören in denselben PR wie die Quelländerung.

## Deployment

GitHub Pages wird ausschließlich über GitHub Actions bereitgestellt (Repository-Einstellungen → Pages → Quelle „GitHub Actions“). Der Workflow veröffentlicht den Inhalt von `dist/` und zusätzlich die Offline-Einzeldatei unter `/Liquid-Type-Offline.html`. Pull Requests führen nur Tests und Build aus, kein Deployment.
