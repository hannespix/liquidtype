# Architektur und aktueller Stand

Die zuletzt ausgelieferte Offline-Datei ist die Grundlage dieses Quellstands. Die frühere gehostete Erstversion ist nicht die Grundlage des Exports.

## Datenfluss

1. Canvas2D rastert den Text in eine Materialmaske. Eine zweite Auflösung erhält die Kantendetails auf hochauflösenden Displays.
2. Jedes belegte Rasterfeld erhält ein Partikel mit Zielposition. Die Physik nutzt räumliche Nachbarschaftssuche, Druck, Kohäsion, Viskosität und Rückstellkräfte.
3. Referenzkräfte werden abgezogen, damit die Schriftform auch bei maximaler Anziehung ein stabiles Gleichgewicht bleibt.
4. Jeder Partikel trägt lokale Materialinformationen. Glatte, sich überlappende Gewichte werden in einer WebGL-Textur aufsummiert und normalisiert.
5. Tatsächliche Auslenkung und Geschwindigkeit bestimmen die lokale Verformung zur freien Flüssigkeitsoberfläche. Es gibt keine SVG-Schriftüberlagerung, keine zeitgesteuerte Ruhebild-Überblendung und keine rechteckigen Schnittkanten der Partikel.

Wenn `EXT_color_buffer_float` verfügbar ist, verwendet die Summentextur RGBA16F; andernfalls RGBA8. Die Schrift wird ausschließlich über denselben Partikel-Renderpfad ausgegeben. Die Materialmaske wird nicht als separate Schriftebene angezeigt.

## Prüfstand

- Automatisierte Tests prüfen endliche/beschränkte Zustände, Rückkehr zur Schrift, reziproke Reaktion, leere Eingabe im Physikkern, Reset und stabiles Gleichgewicht bei maximalen Reglern.
- Die Shader wurden in einem realen EGL/OpenGL-ES-3-Kontext kompiliert und gerendert. Ruhe, beginnende und stärkere Verformung wurden visuell geprüft, einschließlich nicht ganzzahliger Partikelabstände.
- Ein Test mit 1.925 Glyph-Partikeln und allen Reglern auf 100 % ergab nach starkem Impuls und anschließendem Einschwingen eine maximale Abweichung von rund 0,00025 Pixeln von der Zielposition.
- Die vollständige Oberfläche, Touchbedienung und optionale WebMCP-Anbindung wurden nicht in einem echten Browser automatisiert getestet. Die Grafiktests ersetzen keinen gerätespezifischen Browser-Test.
- `original-design.md` dokumentiert den Ausgangsentwurf. Bei Abweichungen beschreiben diese Datei und der aktuelle Quellcode den ausgelieferten Stand.

Optional unter Linux mit Mesa/EGL: `python3 tests/check-shaders.py` kompiliert und verlinkt die Shader aus dem aktuellen Quellcode. Dieser Test ist nicht Teil von `npm test`.
