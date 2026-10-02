# Architektur und aktueller Stand

Die zuletzt ausgelieferte Offline-Datei ist die Grundlage dieses Quellstands. Die frühere gehostete Erstversion ist nicht die Grundlage des Exports.

## Datenfluss

1. Canvas2D rastert den Text in eine Materialmaske. Eine zweite Auflösung erhält die Kantendetails auf hochauflösenden Displays.
2. Jedes belegte Rasterfeld erhält ein Partikel mit Zielposition. Die Physik nutzt räumliche Nachbarschaftssuche, Druck, Kohäsion, Viskosität und Rückstellkräfte.
3. Referenzkräfte werden abgezogen, damit die Schriftform auch bei maximaler Anziehung ein stabiles Gleichgewicht bleibt.
4. Jeder Partikel trägt lokale Materialinformationen. Glatte, sich überlappende Gewichte werden in einer WebGL-Textur aufsummiert und normalisiert.
5. Tatsächliche Auslenkung und Geschwindigkeit bestimmen die lokale Verformung zur freien Flüssigkeitsoberfläche. Es gibt keine SVG-Schriftüberlagerung, keine zeitgesteuerte Ruhebild-Überblendung und keine rechteckigen Schnittkanten der Partikel.

## Gemeinsame Engine und Unterseiten

`glyphs.mjs` tastet beliebig gezeichnete Schrift ab: Eine Zeichenfunktion malt die Glyphen einmal in ein 1×-Raster für die Partikel und einmal hochaufgelöst als Materialtextur. Die Hauptseite zentriert damit ihren Text, die MS-Seite zeichnet M und S exakt in die Flächen ihrer unsichtbaren Schaltflächen. `FluidRenderer` nimmt optional Papier- und Tintenfarbe entgegen; ohne Angabe gelten die Farben der Hauptseite. Nach dem Auslagern wurde die Hauptseite im Browser pixelgenau mit dem vorherigen Stand verglichen.

Die MS-Seite legt die Leinwand über den ganzen Startbereich, damit Spritzer nicht an einer Buchstabenbox abgeschnitten werden. Ein kurzer Tipp öffnet „Über mich“, ein Ziehen über acht Pixel verformt nur die Flüssigkeit. Nach fünf Sekunden Ruhe bewegt eine unsichtbare Hand die Oberfläche sanft, außer bei reduzierter Bewegung.

Die zupfbare Linie der Startseite läuft im selben Takt wie die Flüssigkeit. Nach jedem Physikschritt hält `coupling.mjs` alle Partikel oberhalb der Bézierkurve, gibt ihnen die Geschwindigkeit der Linie mit und zählt, wie viele aufliegen. Diese Last wirkt im nächsten Bild als Beschleunigung auf die Feder der Linie, sodass Tropfen sie durchbiegen und die zurückschwingende Linie von der Schrift gebremst wird. Die Kurveninversion und die Grenze sind in `tests/coupling.test.mjs` geprüft.

Bewegungssensoren wirken nur über Änderungen: Die lineare Beschleunigung wird pro Ereignis in einen Geschwindigkeitsschub integriert (`nudge`, leicht über die Glyphe variiert, damit es schwappt statt zu schieben), die Änderung der Schwerkraftrichtung ergibt einen weiteren Schub, und eine schwache Kraft zur aktuellen Neigung klingt innerhalb von zwei Sekunden ab. Eine ruhig gehaltene Schräglage erzeugt deshalb keinen dauerhaften Fluss. Alles wird nach Bildschirmausrichtung gedreht und pro Ereignis begrenzt; bleiben Sensordaten aus, fällt die Restkraft auf null.

Wenn `EXT_color_buffer_float` verfügbar ist, verwendet die Summentextur RGBA16F; andernfalls RGBA8. Die Schrift wird ausschließlich über denselben Partikel-Renderpfad ausgegeben. Die Materialmaske wird nicht als separate Schriftebene angezeigt.

## Prüfstand

- Automatisierte Tests prüfen endliche/beschränkte Zustände, Rückkehr zur Schrift, reziproke Reaktion, leere Eingabe im Physikkern, Reset und stabiles Gleichgewicht bei maximalen Reglern.
- Die Shader wurden in einem realen EGL/OpenGL-ES-3-Kontext kompiliert und gerendert. Ruhe, beginnende und stärkere Verformung wurden visuell geprüft, einschließlich nicht ganzzahliger Partikelabstände.
- Ein Test mit 1.925 Glyph-Partikeln und allen Reglern auf 100 % ergab nach starkem Impuls und anschließendem Einschwingen eine maximale Abweichung von rund 0,00025 Pixeln von der Zielposition.
- Die vollständige Oberfläche, Touchbedienung und optionale WebMCP-Anbindung wurden nicht in einem echten Browser automatisiert getestet. Die Grafiktests ersetzen keinen gerätespezifischen Browser-Test.
- `original-design.md` dokumentiert den Ausgangsentwurf. Bei Abweichungen beschreiben diese Datei und der aktuelle Quellcode den ausgelieferten Stand.

Optional unter Linux mit Mesa/EGL: `python3 tests/check-shaders.py` kompiliert und verlinkt die Shader aus dem aktuellen Quellcode. Dieser Test ist nicht Teil von `npm test`.
