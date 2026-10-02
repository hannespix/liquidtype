# Liquid Type – Hinweise für Claude Code

## Projekt

Statische Browseranwendung: Schrift als 2D-Flüssigkeit mit WebGL2-Rendering. Keine npm-Pakete, kein `npm install`; Node.js 22 oder neuer genügt.

- `npm test` – Physik-, Gleichgewichts- und Buildtests (`node --test`)
- `npm run build` – erzeugt `dist/` und `Liquid-Type-Offline.html` aus `src/`
- `npm run dev` – lokaler Entwicklungsserver auf http://127.0.0.1:5173

Seiten: Hauptseite `src/index.html` mit `src/app.mjs`; Unterseite `src/MS/` (Matthias Sütterlin, flüssige Initialen). Beide nutzen die gemeinsamen Engine-Module `physics.mjs`, `render.mjs` und `glyphs.mjs`. Neue Unterseiten als eigenen Ordner unter `src/` anlegen und in `scripts/build.mjs` in die Ordnerliste aufnehmen.

Die Physik kennt optional `gravityX`/`gravityY` in den Parametern (px/s²) sowie `free[i]` je Partikel mit `dripGravity` für freigegebene Tropfen; `nudge` schubst die ganze Flüssigkeit. `src/MS/coupling.mjs` lässt die Flüssigkeit auf der zupfbaren Linie aufliegen und meldet Last und Aufprall. Die Physikparameter der MS-Seite stehen auf Wunsch von Hannes bei Impulsstärke, Anziehung und Viskosität am Maximum der Hauptseiten-Regler; nur das Zusammensetzen beim Laden läuft kurz dünnflüssig. Alle Stellgrößen der MS-Effekte (auch die Sensor-Verstärkungen) stehen im Objekt `defaults` oben in `src/MS/ms.mjs` und sind zur Laufzeit über das Einstellfeld (Hamburger unten links) verstellbar; der Browser merkt sie sich unter dem localStorage-Schlüssel `ms-tune`. Wenn Hannes Werte nennt, die ihm gefallen, gehören sie als neue Vorgaben in `defaults` beziehungsweise `parameters`. `?debug` zeigt Sensorwerte live und stellt die Simulation unter `window.liquidType` bereit. Der Build stempelt Verweise in `dist/` mit einem Hash aller Quellen (`?v=…`), deshalb ändern sich nach jeder Quelländerung auch Verweise in erzeugten Dateien.

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
