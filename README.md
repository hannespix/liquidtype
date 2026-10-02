# Liquid Type

Interaktive schwarze Flüssigkeitsschrift mit editierbarem Text, Maus-/Touch-Interaktion, Scrollimpulsen und vier Physikreglern. Stand: 02.10.2026, letzte überarbeitete Offline-Version mit glatt überlappenden Partikeln.

## Direkt ausprobieren

`Liquid-Type-Offline.html` im Browser öffnen. Alles ist eingebettet; kein Internet, Server oder Download von Bibliotheken nötig. Die Animation benötigt WebGL2. Die verwendeten Systemschriften können je nach Gerät unterschiedlich aussehen.

## Entwickeln

Voraussetzung: Node.js 22 oder neuer. Keine npm-Pakete und kein `npm install` erforderlich.

```sh
npm run dev
```

Anschließend `http://127.0.0.1:5173` öffnen. Dateien in `src/` bearbeiten und den Browser neu laden. Der Entwicklungsserver bindet ausschließlich an den eigenen Rechner.

```sh
npm test
npm run build
```

Der Build erzeugt die modularen Website-Dateien in `dist/` und die vollständige Einzeldatei `Liquid-Type-Offline.html`. Änderungen bitte in `src/` vornehmen; Änderungen an den erzeugten Dateien werden beim nächsten Build überschrieben.

## Struktur

- `src/index.html` – Oberfläche und Bedienelemente
- `src/style.css` – responsives Layout
- `src/app.mjs` – Textabtastung, Eingaben, Animation und optionale WebMCP-Anbindung
- `src/physics.mjs` – Partikelphysik und Gleichgewicht an der Schriftform
- `src/render.mjs` – WebGL2-Oberflächenrekonstruktion
- `scripts/` – Build und lokaler Entwicklungsserver ohne Abhängigkeiten
- `tests/` – Physik-, Gleichgewichts- und Buildprüfungen
- `docs/` – Architektur, Prüfstand und ursprünglicher Entwurf
- `dist/` – fertige modulare Website für statisches Hosting
- `Liquid-Type-Offline.html` – fertige Offline-Einzeldatei

## Auf GitHub weiterentwickeln

Leeres Repository auf GitHub erstellen. Im entpackten Projektordner:

```sh
git init
git add .
git commit -m "Initial import: Liquid Type"
git branch -M main
git remote add origin https://github.com/DEIN-NAME/DEIN-REPOSITORY.git
git push -u origin main
```

Das ZIP enthält den vollständigen aktuellen Quellstand einschließlich fertiger Ausgaben, aber keine `.git`-Historie, Zugangsdaten oder Bindung an die ursprünglich gehostete Website. Es ist ein unabhängiges Projekt. Eine Lizenz wurde nicht stellvertretend festgelegt; vor einer Veröffentlichung bei Bedarf eine eigene LICENSE ergänzen.

## Technische Grenzen

Künstlerische 2D-Flüssigkeit mit Rückstellkraft zur Schriftform, keine wissenschaftlich validierte Wassersimulation. Partikelzahl und Renderauflösung sind für Mobilgeräte begrenzt. Eine WebGL2-fähige Grafikumgebung wird benötigt. Die optionalen WebMCP-Funktionen sind nicht für den Betrieb erforderlich.
