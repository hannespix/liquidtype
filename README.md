# Liquid Type

Interaktive schwarze Flüssigkeitsschrift mit editierbarem Text, Maus-/Touch-Interaktion, Scrollimpulsen und vier Physikreglern. Stand: 02.10.2026, letzte überarbeitete Offline-Version mit glatt überlappenden Partikeln.

## Direkt ausprobieren

`Liquid-Type-Offline.html` im Browser öffnen. Alles ist eingebettet; kein Internet, Server oder Download von Bibliotheken nötig. Die Animation benötigt WebGL2. Die verwendeten Systemschriften können je nach Gerät unterschiedlich aussehen.

## Entwickeln

Voraussetzung: Node.js 22 oder neuer. Keine npm-Pakete und kein `npm install` erforderlich.

```sh
npm run dev
```

Anschließend `http://127.0.0.1:5173` öffnen, die MS-Seite liegt unter `http://127.0.0.1:5173/MS/`. Dateien in `src/` bearbeiten und den Browser neu laden. Der Entwicklungsserver bindet ausschließlich an den eigenen Rechner.

```sh
npm test
npm run build
```

Der Build erzeugt die modularen Website-Dateien in `dist/` und die vollständige Einzeldatei `Liquid-Type-Offline.html`. Änderungen bitte in `src/` vornehmen; Änderungen an den erzeugten Dateien werden beim nächsten Build überschrieben.

## Struktur

- `src/index.html` – Oberfläche und Bedienelemente
- `src/style.css` – responsives Layout
- `src/app.mjs` – Eingaben, Animation und optionale WebMCP-Anbindung der Hauptseite
- `src/glyphs.mjs` – gemeinsame Abtastung von Schrift in Partikel und Materialtextur
- `src/physics.mjs` – Partikelphysik und Gleichgewicht an der Schriftform
- `src/render.mjs` – WebGL2-Oberflächenrekonstruktion mit einstellbaren Farben
- `src/MS/` – Unterseite für Matthias Sütterlin mit flüssigen Initialen M und S
- `src/404.html` – Fehlerseite, leitet `/ms/` in beliebiger Schreibweise auf `/MS/` um
- `scripts/` – Build und lokaler Entwicklungsserver ohne Abhängigkeiten
- `tests/` – Physik-, Gleichgewichts- und Buildprüfungen
- `docs/` – Architektur, Prüfstand und ursprünglicher Entwurf
- `dist/` – fertige modulare Website für statisches Hosting
- `Liquid-Type-Offline.html` – fertige Offline-Einzeldatei

## Repository und Veröffentlichung

- Quellcode: https://github.com/hannespix/liquidtype
- Live-Version (GitHub Pages): https://hannespix.github.io/liquidtype/ – dort liegt auch die Offline-Datei unter `/Liquid-Type-Offline.html`.
- MS-Seite: https://hannespix.github.io/liquidtype/MS/

Jede Änderung geht über einen Pull Request nach `main`. Ein Merge auf `main` startet den GitHub-Actions-Workflow `.github/workflows/pages.yml`, der Tests und Build ausführt und `dist/` samt Offline-Datei auf GitHub Pages veröffentlicht. Pull Requests werden nur getestet und gebaut. Die Arbeitsregeln für die Weiterentwicklung stehen in `CLAUDE.md`.

Eine Lizenz wurde nicht stellvertretend festgelegt; vor einer breiteren Veröffentlichung bei Bedarf eine eigene LICENSE ergänzen.

## MS-Seite

Unter `/MS/` liegt eine Studie der Website von Matthias Sütterlin (Innenarchitektur und Raumdesign). Aufbau, Navigation und Inhalte folgen dem Original unter https://matthiassuetterlin.github.io/matthiassuetterlin-website/. Die großen Initialen M und S laufen auf der Liquid-Type-Engine: Ziehen verformt die Flüssigkeit, Antippen öffnet „Über mich“. Die Seite ist eigenständig geschrieben und importiert nur die gemeinsamen Engine-Module aus dem Hauptverzeichnis.

- Die Seite ist auf `noindex` gesetzt und verweist per `canonical` auf das Original, damit Suchmaschinen keine Dublette führen.
- Die Schrift Playfair Display (Bold, lateinischer Zeichensatz) liegt selbst gehostet in `src/MS/fonts/` mit ihrer Lizenz (SIL Open Font License 1.1). Es werden keine externen Dienste geladen.
- Bereiche sind per Adresse erreichbar, zum Beispiel `/MS/#projects`; Browser-Zurück funktioniert.
- Ohne WebGL2 erscheinen die Initialen als normale Schrift.

## Technische Grenzen

Künstlerische 2D-Flüssigkeit mit Rückstellkraft zur Schriftform, keine wissenschaftlich validierte Wassersimulation. Partikelzahl und Renderauflösung sind für Mobilgeräte begrenzt. Eine WebGL2-fähige Grafikumgebung wird benötigt. Die optionalen WebMCP-Funktionen sind nicht für den Betrieb erforderlich.
