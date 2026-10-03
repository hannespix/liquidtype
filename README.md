# Liquid Type

Interaktive schwarze Flüssigkeitsschrift mit editierbarem Text, Maus-/Touch-Interaktion, Scrollimpulsen, vier Physikreglern und den Effekten der MS-Seite. Stand: 02.10.2026, letzte überarbeitete Offline-Version mit glatt überlappenden Partikeln.

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
- `src/app.mjs` – Eingaben, Animation, Effekte und optionale WebMCP-Anbindung der Hauptseite
- `src/glyphs.mjs` – gemeinsame Abtastung von Schrift in Partikel und Materialtextur
- `src/physics.mjs` – Partikelphysik und Gleichgewicht an der Schriftform
- `src/render.mjs` – WebGL2-Oberflächenrekonstruktion mit einstellbaren Farben
- `src/quality.mjs` – automatische Qualitätsstufen für schwache und ältere Geräte
- `src/effects.mjs` – gemeinsame Effekte: Zusammensetzen, Platzen, Tropfen, Einschwingen, unsichtbare Hand
- `src/cursor.mjs` – flüssiger Mauszeiger, der mit der Schrift verschmilzt
- `src/sensors.mjs` – Bewegungssensoren: Ausrichtung je Gerät und was die Flüssigkeit davon spürt
- `src/MS/` – Unterseite für Matthias Sütterlin mit flüssigen Initialen M und S
- `src/404.html` – Fehlerseite, leitet `/ms/` in beliebiger Schreibweise auf `/MS/` um
- `scripts/` – Build und lokaler Entwicklungsserver ohne Abhängigkeiten
- `tests/` – Physik-, Gleichgewichts- und Buildprüfungen
- `docs/` – Architektur, Prüfstand und ursprünglicher Entwurf
- `dist/` – fertige modulare Website für statisches Hosting
- `Liquid-Type-Offline.html` – fertige Offline-Einzeldatei

## Effekte auf der Hauptseite

Der Generator hat dieselben Effekte wie die MS-Seite, mit deren abgestimmten Werten. Unter den Physikreglern lässt sich jeder einzeln ein- und ausschalten („03 / Die Effekte“):

- **Tropfen am Zeiger** – über der Bühne zieht der Zeiger einen flüssigen Tropfen hinter sich her, der nahe der Schrift mit ihr verschmilzt. Er ersetzt dann den gezeichneten DRAG-Ring.
- **Magnet** – eine Maus über der Schrift zieht die Flüssigkeit zu sich (nur mit Maus sichtbar).
- **Halten lässt platzen** – gedrückt halten sammelt die Flüssigkeit am Zeiger und lässt sie platzen; sie findet von selbst wieder zusammen.
- **Tropfen fallen** – alle paar ruhigen Sekunden löst sich ein Tropfen vom unteren Rand und wird zurückgezogen.
- **Unsichtbare Hand** – nach einigen Sekunden Ruhe bewegt sie die Oberfläche sanft.
- **Zusammensetzen** – beim Laden und beim Zurücksetzen bildet sich die Schrift aus verstreuten Tropfen.
- **Bewegungssensor** – am Smartphone schwappt die Schrift beim Schütteln und schnellen Kippen. Android liefert die Daten sofort, iOS fragt beim Einschalten nach Erlaubnis.

Bei reduzierter Bewegung (Systemeinstellung) ruht die Animation wie bisher. Die WebMCP-Anbindung kann die Effekte ebenfalls schalten; den Bewegungssensor nur aus, weil iOS zum Einschalten ein Antippen verlangt.

## Schwache und ältere Geräte

Beide Seiten passen sich der Leistung des Geräts an. Sie schätzen beim Start, was das Gerät kann, und beobachten danach die Bildrate. Bleibt sie niedrig, sinkt zuerst die Zeichenauflösung oder die Zahl der Partikel, je nachdem, ob der Grafikchip oder der Prozessor bremst. Auf schnellen Geräten bleibt alles in voller Qualität. Mit `?quality=0` an der Adresse gilt immer volle Qualität, mit `?quality=3` die niedrigste.

## Repository und Veröffentlichung

- Quellcode: https://github.com/hannespix/liquidtype
- Live-Version (GitHub Pages): https://hannespix.github.io/liquidtype/ – dort liegt auch die Offline-Datei unter `/Liquid-Type-Offline.html`.
- MS-Seite: https://hannespix.github.io/liquidtype/MS/

Jede Änderung geht über einen Pull Request nach `main`. Ein Merge auf `main` startet den GitHub-Actions-Workflow `.github/workflows/pages.yml`, der Tests und Build ausführt und `dist/` samt Offline-Datei auf GitHub Pages veröffentlicht. Pull Requests werden nur getestet und gebaut. Die Arbeitsregeln für die Weiterentwicklung stehen in `CLAUDE.md`.

Eine Lizenz wurde nicht stellvertretend festgelegt; vor einer breiteren Veröffentlichung bei Bedarf eine eigene LICENSE ergänzen.

## MS-Seite

Unter `/MS/` liegt eine Studie der Website von Matthias Sütterlin (Innenarchitektur und Raumdesign). Aufbau, Navigation und Inhalte folgen dem Original unter https://matthiassuetterlin.github.io/matthiassuetterlin-website/. Die großen Initialen M und S laufen auf der Liquid-Type-Engine: Ziehen verformt die Flüssigkeit, Antippen öffnet „Über mich“. Die Seite ist eigenständig geschrieben und importiert nur die gemeinsamen Engine-Module aus dem Hauptverzeichnis.

- Die Seite ist auf `noindex` gesetzt und verweist per `canonical` auf das Original, damit Suchmaschinen keine Dublette führen. Einen sichtbaren Hinweis auf Liquid Type oder das Original gibt es nicht.
- Die Schrift Playfair Display (Bold, lateinischer Zeichensatz) liegt selbst gehostet in `src/MS/fonts/` mit ihrer Lizenz (SIL Open Font License 1.1). Es werden keine externen Dienste geladen.
- Die Seite erklärt sich nicht selbst: Es gibt weder einen Einführungsdialog noch Bedienhinweise, Besucher finden durch Ausprobieren heraus, was geht. Nur wenn Bewegungsdaten nicht verfügbar sind, erscheint unter der Linie eine kurze Meldung.
- Bereiche sind per Adresse erreichbar, zum Beispiel `/MS/#projects`; Browser-Zurück funktioniert. Escape führt eine Ebene zurück.
- Mit der Tastatur zeigt ein feiner Strich unter M oder S, welcher Buchstabe den Fokus hat. Kehrt die Seite selbst zur Startseite zurück, etwa nach Escape, landet der Fokus ohne Markierung auf dem M; der Strich erscheint mit dem nächsten Tastendruck.
- Die zupfbare Linie unter der Tagline ist eine echte Grenze für die Flüssigkeit: Nach oben gezogen hebt sie die Buchstabenböden an, nach dem Loslassen schwingt sie durch die Schrift. Flüssigkeit, die nach unten gezogen wird, sammelt sich auf der Linie und drückt sie durch.
- Am Smartphone reagieren die Buchstaben auf Beschleunigungen: Schütteln und schnelles Kippen schwappen durch die Flüssigkeit, eine ruhig gehaltene Schräglage bewirkt nichts Bleibendes. Android liefert Daten sofort, iOS erst nach einem Tipp auf „Bewegung einschalten“. Der Knopf meldet nach kurzer Zeit, wenn der Browser keine Bewegungsdaten liefert. Weil Geräte und Browser ihre Sensorachsen unterschiedlich melden (iOS mit umgekehrten Vorzeichen, manche Geräte um 90 Grad gedreht), lernt die Seite die Ausrichtung aus der Schwerkraft, sobald das Handy aufrecht gehalten wird. Danach fließt die Flüssigkeit auf jedem Gerät zur tiefer gehaltenen Seite. Mit `?debug` an der Adresse erscheint eine Anzeige der Sensorwerte samt erkannter Ausrichtung.
- Der Build stempelt alle lokalen Skript- und Stylesheet-Verweise in `dist/` mit einer Versionskennung, damit ein Browser nach einem Deploy keine alten Module aus dem Cache mit einer neuen Seite mischt.
- Beim Seitenwechsel bekommt jede Schrift ihr eigenes Tropfenraster, abgeleitet aus ihrer gemessenen Strichstärke: dünne und kleine Schrift fliegt als feine, fette und große Schrift als kräftigere Flüssigkeit. Im Flug behält die Flüssigkeit das Schriftgewicht, statt zu fetten Balken aufzuquellen, und benachbarte Tropfen fliegen zusammen, sodass sie als zusammenhängende Flüssigkeit statt als Staub erscheinen. Gegen Ende des Flugs zieht die Flüssigkeit kräftiger ins Ziel und geht pünktlich in die scharfe Schrift über. Die Initialen selbst bleiben in voller Größe.
- Die feine Linie unter Untertitel und Überschriften springt beim Seitenwechsel nicht, sondern gleitet weich an ihre neue Stelle und biegt sich dabei leicht, als würde sie durch die Flüssigkeit gezogen. Am Ziel übernimmt die Linie der neuen Seite ihren Schwung.
- Beim Laden setzen sich die Initialen aus verstreuten Tropfen zusammen. Bei jedem Seitenwechsel fließt die Flüssigkeit vom alten in den neuen Text: von den Initialen in einen Bereich, zwischen Bereichen, in die Projektseiten und zurück zu M und S. Überschrift, Fließtext, Fakten und Links werden Wort für Wort an ihrer Stelle gebildet, auch umbrochen.
- Der ganze Text hängt an unsichtbaren Saiten über die Seite: Kreuzt der Zeiger eine Saite, folgt sie ihm, reißt sich los und schwingt nach, und jeder Buchstabe in der Nähe schwingt mit. Scrollen zupft die Saiten im Bild, ein Tipp neben dem Text zupft die nächste. Gezeichnet wird davon nichts. Auf der Startseite schwingt die Tagline frei; auf den Unterseiten, wo gelesen wird, kräuselt sich der Text nur leicht und ist sofort wieder ruhig, eine ruhende Maus lässt die Saite los, und Links und Schaltflächen bewegen sich nicht, damit sie gut zu treffen sind.
- Die Physik steht auf einem abgestimmten Sweet Spot: schwer und zusammenhängend, aber lebendig, mit Wellen, Tropfen und Platzen, die binnen weniger Sekunden ausschwingen. Mit `?tune` an der Adresse erscheint unten links ein Einstellfeld mit Reglern für alle Effekte (Physik, Zusammensetzen, Halten und Platzen, Tropfen, Magnet, Cursor, Linie, Ruhebewegung, Sensoren, Übergang, Textgitter, Textgitter Unterseiten, Darstellung), am Smartphone als Bottom-Sheet. Dort gesetzte Werte gelten nur in diesem Modus; „Zurücksetzen“ stellt die Vorgaben her, „Kopieren“ legt sie als JSON in die Zwischenablage.
- Text lässt sich auf der Seite nirgends markieren, damit beim Ziehen an der Flüssigkeit keine Auswahl im Hintergrund entsteht.
- Gedrückt halten sammelt die Flüssigkeit am Finger und lässt sie dann platzen; sie findet von selbst wieder zusammen.
- Alle paar ruhigen Sekunden löst sich ein Tropfen vom unteren Rand, fällt auf die Linie und lässt sie nachschwingen.
- Wo der Mauszeiger über den flüssigen Buchstaben steht, zieht er die Flüssigkeit wie ein Magnet zu sich, über M und S und dazwischen, wo eine Tropfenkette zwischen beiden entsteht.
- Wie im Original zieht der Mauszeiger einen flüssigen Tropfen hinter sich her: eine kurze Kette von Tropfen an Federn, als feine Kontur gezeichnet, die beim Bewegen anschwillt und in Ruhe langsam schrumpft. Nahe an M und S verschmilzt der Tropfen mit der Flüssigkeit, wo immer sie gerade ist, auch gezogen, geplatzt oder tropfend. Seine Kontur zieht sich zurück, während ein gleich großer Tropfen in der Flüssigkeit wächst und über einen Hals mit ihr zusammenfließt. Entfernt sich der Zeiger, fließt er wieder heraus. Am Smartphone folgt der Tropfen dem Finger und verschwindet beim Loslassen; bei reduzierter Bewegung entfällt er.
- Dunkler Modus nach Systemeinstellung: helle Flüssigkeit auf Schwarz.
- Ohne WebGL2 erscheinen die Initialen als normale Schrift.

## Technische Grenzen

Künstlerische 2D-Flüssigkeit mit Rückstellkraft zur Schriftform, keine wissenschaftlich validierte Wassersimulation. Partikelzahl und Renderauflösung sind für Mobilgeräte begrenzt. Eine WebGL2-fähige Grafikumgebung wird benötigt. Die optionalen WebMCP-Funktionen sind nicht für den Betrieb erforderlich.
