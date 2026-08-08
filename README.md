# Mandala Atelier

Eine Web-App für Erwachsene, um Mandalas zu **gestalten und zu kolorieren**.
Schwesterprojekt zur Kinder-App „Malstudio“, aber eigenständig: eigenes Repo,
eigene Zielgruppe, eigene Gestaltung.

Der Kern ist nicht das Ausmalbuch, sondern das **Symmetrie-Werkzeug**: Man
zeichnet ein Segment, die App spiegelt den Rest. Dieses Gefühl ist das
eigentliche Produkt. Die 19 fertigen Vorlagen sind die Ergänzung für alle, die
sofort losfärben wollen.

Leitsatz: ruhig, erwachsen, entspannend. **Keine Gamification** – keine Sterne,
keine Pokale, keine Streaks. Wer hier malt, will abschalten.

## Starten

Es gibt nichts zu bauen. `index.html` im Browser öffnen genügt.

Für die Fassung auf dem iPad braucht es eine Adresse über `https`, sonst
arbeitet der Service Worker nicht:

    Einstellungen → Pages → Branch `main`, Ordner `/`

Danach die Seite in Safari öffnen und über „Teilen → Zum Home-Bildschirm“
ablegen. Die App startet dann im Vollbild und läuft auch ohne Netz.

## Randbedingungen

- **Alles offline, alles im Browser.** Keine Server, keine KI zur Laufzeit,
  keine Konten, kein Tracking, keine Werbung. Symmetrie und Formen entstehen
  aus klassischer Geometrie.
- **Einzige externe Ressource:** der Google-Fonts-Link (Fraunces, Work Sans,
  IBM Plex Mono). Der Service Worker legt die Schriften beim ersten Laden ab.
  Sie dürfen gern durch lokal eingebettete Dateien ersetzt werden – dann kommt
  die App ganz ohne externen Abruf aus.
- **iPad zuerst.** `pointer`-Events, `touch-action: none`, Safe-Area, Quer- und
  Hochformat.
- **Sprache der Oberfläche: Deutsch.**
- **Bei jedem Release die Cache-Version in `sw.js` erhöhen**
  (`const CACHE = 'mandala-atelier-vX-Y'`), sonst lädt das iPad die alte Fassung.

## Dateien

    index.html              App-Gerüst, Bedienleiste, Motivwelten-Bereich
    style.css               Design-Tokens, Hell/Dunkel, Layout
    app.js                  Gesamte Logik, in kommentierte Abschnitte geteilt
    manifest.webmanifest    PWA-Manifest
    sw.js                   Service Worker (Offline-Cache)
    icon-*.png              6 Icons, prozedural erzeugt
    tools/browser.js        Sucht einen vorhandenen Chrome/Chromium
    tools/gen-icons.js      Erzeugt die Icons neu
    tools/test-app.js       Automatischer Durchlauf durch alle Motive
    package.json            Nur devDependencies (playwright-core) für tools/

Zur Laufzeit hat die App **keine Abhängigkeiten**. `node_modules` wird nur für
die Testskripte gebraucht und steht in `.gitignore`.

## Technischer Aufbau

**Vier übereinanderliegende Canvas-Ebenen**, je 900 × 900 logisch, per `dpr`
hochskaliert (`dpr` auf höchstens 2 begrenzt):

| Ebene         | Zweck                                  | Interaktion        |
|---------------|----------------------------------------|--------------------|
| `guideCanvas` | Hilfsraster, dreht sich sehr langsam   | keine              |
| `fillCanvas`  | Farbflächen                            | keine              |
| `drawCanvas`  | Linien **und** Zeigerereignisse        | fängt alle Eingaben|
| `labelCanvas` | Punkte und Rechenaufgaben              | keine              |

Die Trennung ist wesentlich: Das Füllwerkzeug liest `drawCanvas` als **Wand**
(Alpha > 60) und schreibt nach `fillCanvas`. Dadurch liegen Linien immer über
der Farbe und werden beim Füllen nie zerstört. `labelCanvas` liegt ganz oben,
damit Zahlen auch auf gefärbtem Grund lesbar bleiben.

**Symmetrie.** `segmentLine(p0, p1)` zeichnet jede Linie n-mal um die Mitte
rotiert; bei aktiver Spiegelung zusätzlich an der Waagerechten gespiegelt.
Achsen 6/8/10/12/16/24, mit Spiegelung also bis 48-fach.

**Füllen.** Scanline-Flood-Fill mit Span-Verfolgung. Es wird **pro
Symmetrie-Position ein eigener Startpunkt** gesetzt – ein Tipp färbt alle
gleichwertigen Felder zugleich. Das ist der Komfortgewinn gegenüber einem
Papier-Ausmalbuch und sollte erhalten bleiben.

Eine Ausnahme: Bei Zähl- und Rechenmandalas trägt jedes Feld einen eigenen
Wert. Dort färbt ein Tipp nur das angetippte Feld (`fillsSymmetrically()`) –
sonst bekämen Felder mit verschiedenen Ergebnissen dieselbe Farbe und die
Aufgabe wäre hinfällig.

**Rückgängig.** Schnappschüsse der Ebenen, die der jeweilige Zug verändert –
beim Zeichnen also nur `drawCanvas`, beim Füllen nur `fillCanvas`. Bis zu 20
Schritte, zusätzlich auf 128 MB gedeckelt: ein Schnappschuss belegt bei `dpr` 2
rund 13 MB, ohne Deckel wäre der Speicher auf dem iPad nach wenigen Zügen
erschöpft.

**Rechenmandalas.** Aufgaben entstehen über einen **festen Seed**
(`mulberry32`, Seed aus der Motiv-ID). Gleiche Vorlage ⇒ gleiche Aufgaben, auf
jedem Gerät. Wichtig, damit Lehrkräfte ein Blatt ausdrucken und im Unterricht
verwenden können. Die Werte werden nicht frei gewürfelt, sondern als Liste
gemischt – so kommt jeder Eintrag der Legende garantiert auch im Bild vor.

## Motivkatalog (19 Vorlagen, 5 Welten)

- **Geometrisch-klassisch:** Sternkranz, Rautenkranz, Sternmandala fein
- **Natur:** Blüte, Blätterkranz, Muschelspirale
- **Zen & Achtsamkeit:** Wellenkreis, Tropfenkranz, Ruhefeld
- **Jahreszeiten:** Winter, Frühling, Sommer, Herbst
- **Kids-Corner:** Erste Formen (Kindergarten), Mustertanz (Grundschule),
  Zähl bis 6, Zähl bis 10, Rechenmandala ZR 10, Rechenmandala ZR 20

Bei Zähl- und Rechenmandalas erscheint automatisch eine **Farblegende** in der
Bedienleiste („Ergebnis 7“, „4 Punkte“). Sie wird aus den tatsächlich
vorkommenden Werten erzeugt, nicht fest verdrahtet; ein Klick auf einen
Legendeneintrag wählt die Farbe aus.

Motive sind Datensätze in `MOTIFS` mit einer `build()`-Funktion. Neue Motive
kommen dort dazu. Bausteine: `petalPoints`, `wedgeBandPoints`, `diamondPoints`,
`spiralPoints`, `wavyRingPoints`, `rotatePoints` sowie die Zeichenhilfen
`drawClosedLoop`, `drawPolyline`, `drawRing`, `drawWavyRing`, `drawDotAccent`.

## Fallen, die schon zugeschnappt sind

1. **Offene Flächen fluten.** Anfangs bestanden die Vorlagen nur aus
   freistehenden Blüten; ein Klick daneben füllte die ganze Fläche. Lösung:
   `drawWedgeFrame()` legt vor jedem Motiv Außenring, Nabe und Speichen an, so
   dass auch der Hintergrund in geschlossene Felder zerfällt. **Diese Funktion
   nicht entfernen** – ohne sie ist das Füllwerkzeug bei offenen Motiven
   unbrauchbar.

2. **`Array.prototype.slice.call(new Set(...))` liefert ein leeres Array.**
   Hat dazu geführt, dass die Legende der Rechenmandalas still leer blieb.
   Jetzt `Array.from(...)`. Der Testlauf prüft die Legende ausdrücklich.

3. **Das Blatt wird zur Ellipse.** Ein Flex-Container staucht die Höhe des
   Canvas-Stapels, `aspect-ratio` allein genügt nicht (`flex: none`). Im
   Hochformat kam dazu, dass die Rasterzeile schrumpfte, sobald die Legende die
   Bedienleiste wachsen ließ (`min-height: auto` statt `0`). Der Testlauf misst
   das Seitenverhältnis inzwischen in vier Auflösungen.

## Testen

    npm install          # nur playwright-core, kein Browser-Download nötig
    node tools/test-app.js

Der Durchlauf lädt jedes Motiv, füllt es an vielen Stellen und prüft:

- **Dichtigkeit** – läuft Farbe bis in die Ecken? Dann hat die Vorlage ein Leck.
- **Symmetrie** – färbt ein Tipp bei den Ziermotiven alle gleichwertigen
  Positionen und bei den Zähl-/Rechenmandalas genau ein Feld?
- **Legende** – hat jedes Zähl- und Rechenmandala Einträge?
- **Layout** – bleibt das Blatt in vier Auflösungen quadratisch, ohne aus der
  Bühne zu ragen?
- **Zeichnen** – erscheint ein mit dem Zeiger gezogener Strich an allen Achsen?
- **Seed** – liefern zwei Durchläufe dieselben Aufgaben?

Zur Auswertung: Die Meldungen über Service Worker und `ERR_CONNECTION_RESET`
sind beim Öffnen über `file://` **normal** (kein Origin, keine Schriften) und
kein Fehler. Ein sehr niedriger Füllanteil liegt meist an den Testpunkten und
nicht an der App: Trifft ein Testpunkt genau eine Linie, füllt er nichts.

Die Icons lassen sich mit `node tools/gen-icons.js` neu erzeugen.

Vor dem Ausliefern zusätzlich am iPad prüfen: beide Ausrichtungen, Zeichnen mit
dem Finger, Dunkelmodus.

## Bewusst getroffene Entscheidungen

- **Keine religiösen Symbole** (Om, Chakren, Dharmarad). Geometrische Ornamentik
  ja, religiös aufgeladene Zeichen nur nach ausdrücklicher Rücksprache mit der
  Familie.
- **Datei-Download ist hier in Ordnung.** Anders als bei der Kinder-App auf dem
  iPad ist „Als Bild speichern“ ein legitimer Hauptweg.
- **Gedeckte Palette** (14 Pigmente: Terrakotta, Ocker, Petrol, Indigo …) statt
  Buntstift-Knallfarben. Trägt die erwachsene Anmutung wesentlich.
- **Kein Kinder-Look, obwohl es eine Kids-Corner gibt.** Die Kids-Corner ist
  eine Motivwelt innerhalb der ruhigen Erwachsenen-Oberfläche – Eltern und
  Lehrkräfte sind die Bedienenden.
- **Das Blatt bleibt im Dunkelmodus hell.** Nur die Umgebung wird dunkel. So
  sehen gespeicherte Bilder immer gleich aus, und ein Moduswechsel muss die
  Vorlage nicht neu zeichnen – was begonnene Arbeit zerstören würde.
- **Der Speicher läuft über eine `Store`-Abstraktion**, nicht direkt über
  `localStorage`: Safari wirft im privaten Modus beim Schreiben, und eine
  spätere Galerie soll denselben Weg nehmen.

## Grenzen

Die Motive sind Canvas-Formen aus Koordinaten, **keine handgezeichneten
Illustrationen**. Das ist eine echte Grenze und lässt sich nicht wegprogrammieren:
Was hier entsteht, ist geometrische Ornamentik. Wer freie Illustration will,
braucht gezeichnete Vorlagen – die kann die App anzeigen, aber nicht erfinden.

## Sinnvolle nächste Schritte

1. **Galerie** – gespeicherte Werke lokal ablegen, über die `Store`-Abstraktion.
2. **Druckansicht** für die Kids-Corner: schwarz-weiß, ohne Hilfsraster, DIN A4.
   Wahrscheinlich der größte praktische Gewinn für Lehrkräfte.
3. **Mehr Vorlagen** je Welt; der Katalog ist bewusst erweiterbar angelegt.
4. **Eigene Farben** mischen.
5. **Schriften lokal einbetten**, damit die App wirklich ohne jeden externen
   Abruf auskommt.
