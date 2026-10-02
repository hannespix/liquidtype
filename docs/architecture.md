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

Bewegte Tropfen dürfen kleiner gezeichnet werden als ruhende (`dropShrink` im Renderer, auf der Hauptseite 1): Ein Tropfen in voller Größe deckt mehr als seinen Rasterplatz, und überlappende Tropfen in Bewegung summieren sich sonst zu dicken Klumpen. Mit der Schrumpfung bleibt fliegende Flüssigkeit ein feiner Sprühnebel, der sich am Ziel wieder zur glatten Fläche schließt; in Ruhe ist das Bild unverändert. Ergänzend skaliert `homing` in den Physikparametern die Feder zur Schriftform, damit Flug und Zusammensetzen schneller zur Ruhe kommen.

Die Effekte der MS-Seite bauen auf drei kleinen Engine-Erweiterungen auf: `free[i]` löst ein Partikel von seiner Feder und lässt es `dripGravity` spüren (Tropfen fallen, nach dem Platzen fliegt alles kurz frei), `nudge` verschiebt die Geschwindigkeit der ganzen Flüssigkeit, und `setColors` tauscht Papier- und Tintenfarbe für den dunklen Modus. Das Zusammensetzen beim Laden ist nur ein Startzustand: Die Partikel beginnen in einer Wolke um ihre Zielpunkte, der Rest ist die normale Rückstellfeder. Die Magnetbrücke nutzt den vorhandenen Pinsel der Physik mit kleinerem Radius und eigener Stärke, aktiv nur, wenn der Mauszeiger zwischen den Buchstaben steht. Tropfen entstehen aus den untersten Zielpunkten, fallen auf die Linie und geben ihr beim Aufprall einen Geschwindigkeitsstoß.

Die Leinwand liegt auf Seitenebene unter allen Ansichten, damit jeder Seitenwechsel ein Übergang der Flüssigkeit sein kann. Beim Wechsel bleibt die alte Ansicht sichtbar, ihre Überschrift wird ausgeblendet und ihr Text blendet ab; die neue Ansicht liegt mit unsichtbarer Überschrift darüber. Der gesamte Text eines Bereichs (Überschrift, Absätze, Fakten, Links) wird Wort für Wort in seiner eigenen Schrift dort gezeichnet, wo der Browser das Wort gesetzt hat (per `Range`-Rechtecken), deshalb stimmen auch umbrochene Zeilen zeilengenau; Großschreibung per CSS wird dabei nachgebildet. Von den Initialen aus entsteht eine dichtere Flüssigkeit, deren Partikel beim aktuellen Zustand der Buchstaben starten; zwischen zwei Überschriften werden beide in Überschriftsdichte abgetastet und die Partikel von der einen zur anderen umgezielt. Nach der Flugzeit werden Überschrift und Text sichtbar, die Leinwand blendet aus und wird abgeschaltet. Beim Rückweg zu den Initialen startet eine Flüssigkeit in Überschriftsdichte, deren Zielpunkte die Initialen sind; erst nach der Ankunft übernimmt die volle Partikelmenge, weil die Buchstaben um ein Vielfaches mehr Flüssigkeit fassen. Während des Flugs ist die Flüssigkeit zäher und die gezeichnete Tropfengröße wird von der alten zur neuen Dichte überblendet. Ohne WebGL2 oder bei reduzierter Bewegung wird schlicht umgeschaltet.

Der schwingende Text ist ein unsichtbares Gitter waagerechter Saiten in Seitenkoordinaten, eine alle paar Buchstabengrößen. Jeder Buchstabe der Bereiche, der Tagline und des Hinweises steckt in einem eigenen `span` und wird senkrecht um die interpolierte Auslenkung der zwei nächsten Saiten an seiner x-Position verschoben. Die Saiten teilen die Bézierform und die gedämpfte Feder der sichtbaren Linie, nur weicher (Steifigkeit und Dämpfung einstellbar). Kreuzt der Zeiger zwischen zwei Ereignissen eine Saite, ist sie gegriffen und folgt ihm, bis der Zug die Schnappweite überschreitet; Scrollen zupft die Saiten im Bild proportional zur Geschwindigkeit, ein kurzer Tipp daneben die nächste. Bei jedem Seitenwechsel wird das Gitter beruhigt und nach dem Übergang neu vermessen, damit die Abtastung des Textes für die Flüssigkeit in Ruhe geschieht.

Alle Stellgrößen der Effekte liegen in einem Objekt `tune` (Vorgaben in `defaults`), die Physikparameter in `parameters`. Ein Einstellfeld erzeugt daraus Regler, speichert Änderungen im localStorage und kann sie als JSON kopieren, damit gefundene Werte als neue Vorgaben übernommen werden können.

Bewegungssensoren wirken nur über Änderungen: Die lineare Beschleunigung wird pro Ereignis in einen Geschwindigkeitsschub integriert (`nudge`, leicht über die Glyphe variiert, damit es schwappt statt zu schieben), die Änderung der Schwerkraftrichtung ergibt einen weiteren Schub, und eine schwache Kraft zur aktuellen Neigung klingt innerhalb von zwei Sekunden ab. Eine ruhig gehaltene Schräglage erzeugt deshalb keinen dauerhaften Fluss. Alles wird nach Bildschirmausrichtung gedreht und pro Ereignis begrenzt; bleiben Sensordaten aus, fällt die Restkraft auf null.

Wenn `EXT_color_buffer_float` verfügbar ist, verwendet die Summentextur RGBA16F; andernfalls RGBA8. Die Schrift wird ausschließlich über denselben Partikel-Renderpfad ausgegeben. Die Materialmaske wird nicht als separate Schriftebene angezeigt.

## Prüfstand

- Automatisierte Tests prüfen endliche/beschränkte Zustände, Rückkehr zur Schrift, reziproke Reaktion, leere Eingabe im Physikkern, Reset und stabiles Gleichgewicht bei maximalen Reglern.
- Die Shader wurden in einem realen EGL/OpenGL-ES-3-Kontext kompiliert und gerendert. Ruhe, beginnende und stärkere Verformung wurden visuell geprüft, einschließlich nicht ganzzahliger Partikelabstände.
- Ein Test mit 1.925 Glyph-Partikeln und allen Reglern auf 100 % ergab nach starkem Impuls und anschließendem Einschwingen eine maximale Abweichung von rund 0,00025 Pixeln von der Zielposition.
- Die vollständige Oberfläche, Touchbedienung und optionale WebMCP-Anbindung wurden nicht in einem echten Browser automatisiert getestet. Die Grafiktests ersetzen keinen gerätespezifischen Browser-Test.
- `original-design.md` dokumentiert den Ausgangsentwurf. Bei Abweichungen beschreiben diese Datei und der aktuelle Quellcode den ausgelieferten Stand.

Optional unter Linux mit Mesa/EGL: `python3 tests/check-shaders.py` kompiliert und verlinkt die Shader aus dem aktuellen Quellcode. Dieser Test ist nicht Teil von `npm test`.
