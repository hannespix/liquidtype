# Liquid Type – Entwurf

Stand: 2. Oktober 2026. Die gestalterische Richtung wurde von Hannes bestätigt; dieser Entwurf konkretisiert die Umsetzung zur Prüfung.

## Ziel und Erscheinungsbild

Eine im Browser bedienbare, responsive Schriftanimation, inspiriert vom gelieferten Video 106990.mp4: große schwarze Serifenschrift auf weißem Hintergrund. Die Schrift verhält sich wie eine zusammenhängende Flüssigkeit. In Ruhe ist sie lesbar, unter Bewegung entstehen Wellen, Fäden und ablösbare Tropfen. Dezente Bedienelemente halten den Fokus auf der Animation.

## Bedienung

- Ein Textfeld ändert die dargestellte Schrift unmittelbar nach einer kurzen Eingabepause. Starttext: LIQUID. Bis zu 32 Zeichen einschließlich Leerzeichen; automatische Größenanpassung. Ein leerer Text leert die Darstellung ohne Fehler.
- Maus oder Finger ziehen Flüssigkeit lokal mit. Nach Loslassen bleibt Schwung erhalten; die Oberfläche schwingt gedämpft nach.
- Scrollbewegung gibt einen begrenzten vertikalen Impuls. Die Seite bleibt außerhalb der berührten Animationsfläche normal scrollbar. Die Animation bleibt während eines kurzen Scrollabschnitts sichtbar.
- Regler für Zähflüssigkeit, Oberflächenspannung, gegenseitige Anziehung und Interaktionsstärke. Ergänzend Pause und Zurücksetzen. Alle Regler erhalten Beschriftung und Tastaturbedienung.
- Bei reduzierter Bewegung startet die Darstellung ruhend und lässt sich ausdrücklich aktivieren.

## Physikalisches Verhalten

Eine zweidimensionale Partikelsimulation verbindet Nachbarschaftsdruck, Dämpfung und kurzreichweitige Kohäsion. Druck verhindert übermäßige Verdichtung, Kohäsion hält die Oberfläche zusammen. Eine begrenzte zusätzliche Anziehung lässt nahe Tropfen zusammenlaufen. Die vom Nutzer gewünschte Eigenanziehung ist ein gestalterischer Effekt, keine Behauptung realistischer Wassergravitation.

Aus einer gerasterten Textmaske werden Zielpunkte gewonnen. Eine sanfte Rückstellkraft bindet die Flüssigkeit an die Schriftform und lässt abgelöste Tropfen zurückkehren. Unter kräftiger Interaktion wird diese Bindung lokal schwächer. Die Simulation läuft mit begrenzten Zeitschritten; lange Hintergrundpausen erzeugen keine aufgestauten Impulse.

## Technische Struktur

Eine statische Browseranwendung ohne Konto, Backend oder externe Datenspeicherung. Text und Einstellungen bleiben während der Sitzung lokal im Browser.

1. Textmaske: Schrift rasterisieren, Partikelziele erzeugen und nach Textänderung neu zuordnen.
2. Simulation: Positionen und Geschwindigkeiten, räumliches Nachbarschaftsraster, Druck, Kohäsion, Rückstellkraft und Eingabeimpulse.
3. Darstellung: Partikeldichte in einer Textur sammeln und als geglättete schwarze Oberfläche rendern. WebGL2 ist der bevorzugte Renderpfad; bei fehlender Unterstützung erscheint eine klare Meldung mit lesbarer statischer Schrift.
4. Oberfläche: Texteingabe, Regler, Pause, Reset, Größenänderungen, Maus-, Touch- und Scrollereignisse.

Die Berechnung ist von Darstellung und Bedienung getrennt. Partikelzahl und Renderauflösung werden für kleine Geräte begrenzt. Ziel sind flüssige Bewegungen auf Desktop und eine sinnvoll reduzierte Qualität auf Mobilgeräten; konkrete Bildraten werden erst nach Messung berichtet.

## Grenzen und Fehlerverhalten

Es handelt sich um eine visuell plausible 2D-Flüssigkeit mit künstlicher Schriftbindung, nicht um eine wissenschaftlich validierte 3D-Wassersimulation. Starkes Ziehen darf die Lesbarkeit vorübergehend aufheben. Sehr lange Texte werden verkleinert; die Längenbegrenzung wird sichtbar angegeben. Bei Verlust des Grafikkontexts wird pausiert und eine Wiederherstellung angeboten. Resize und Textwechsel dürfen keine ungültigen Positionen erzeugen.

## Abnahme

- LIQUID, PIX, ein Text mit Umlauten und ein leerer Text werden korrekt verarbeitet.
- Beim Ziehen entstehen nachvollziehbares Nachschwingen und bei ausreichend starkem Impuls abgelöste Flüssigkeitsbereiche.
- Nahe Tropfen reagieren miteinander und können verschmelzen; nach Ende der Interaktion bildet sich die Schrift wieder.
- Scrollimpulse wirken in beide Richtungen und bleiben auch bei schnellem Scrollen stabil.
- Regler verändern das Verhalten sichtbar; Pause und Reset funktionieren.
- Desktop- und Mobilansicht, Maus und Touch, Größenänderung sowie Hintergrundpause werden geprüft.
- Ein längerer Simulationslauf bleibt frei von ungültigen Koordinaten oder unbegrenzt wachsenden Geschwindigkeiten. Browserkonsole und fertiger Build werden kontrolliert.

## Lieferung

Eine direkt aufrufbare interaktive Website. Nach Prüfung dieses Entwurfs folgt der konkrete Implementierungsplan und anschließend die Umsetzung mit visueller und funktionaler Kontrolle.
