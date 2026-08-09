# Mandala Atelier

Eine Web-App für Erwachsene, um Mandalas zu **gestalten und zu kolorieren**.
Schwesterprojekt zur Kinder-App „Malstudio“, aber eigenständig: eigenes Repo,
eigene Zielgruppe, eigene Gestaltung.

Der Kern ist nicht das Ausmalbuch, sondern das **Symmetrie-Werkzeug**: Man
zeichnet ein Segment, die App spiegelt den Rest. Dieses Gefühl ist das
eigentliche Produkt. Die 26 fertigen Vorlagen sind die Ergänzung für alle, die
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
- **Keine externen Abrufe.** Auch die Schriften (Fraunces, Work Sans,
  IBM Plex Mono) stecken als Daten-URI in `fonts.css`, Schnitt „latin“.
  Der Testlauf prüft ausdrücklich, dass die Seite nichts nachlädt. Neu
  erzeugen lässt sich die Datei mit `node tools/gen-fonts.js` – das ist der
  einzige Vorgang im Projekt, der überhaupt ins Netz greift, und er läuft
  nur von Hand.
- **iPad zuerst.** `pointer`-Events, `touch-action: none`, Safe-Area, Quer- und
  Hochformat.
- **Sprache der Oberfläche: Deutsch.**
- **Bei jedem Release die Cache-Version in `sw.js` erhöhen**
  (`const CACHE = 'mandala-atelier-vX-Y'`), sonst lädt das iPad die alte Fassung.

## Dateien

    index.html              App-Gerüst, Schubladen, Galerie
    fonts.css               Schriften als Daten-URI (erzeugt)
    style.css               Design-Tokens, Hell/Dunkel, Layout
    app.js                  Gesamte Logik, in kommentierte Abschnitte geteilt
    manifest.webmanifest    PWA-Manifest
    sw.js                   Service Worker (Offline-Cache)
    icon-*.png              6 Icons, prozedural erzeugt
    tools/browser.js        Sucht einen vorhandenen Chrome/Chromium
    tools/gen-fonts.js      Erzeugt fonts.css neu
    tools/gen-icons.js      Erzeugt die Icons neu
    tools/test-app.js       Automatischer Durchlauf durch alle Motive
    package.json            Nur devDependencies (playwright-core) für tools/

Zur Laufzeit hat die App **keine Abhängigkeiten**. `node_modules` wird nur für
die Testskripte gebraucht und steht in `.gitignore`.

## Technischer Aufbau

**Fünf übereinanderliegende Canvas-Ebenen**, je 900 × 900 logisch, per `dpr`
hochskaliert (`dpr` auf höchstens 2 begrenzt):

| Ebene         | Zweck                                  | Interaktion        |
|---------------|----------------------------------------|--------------------|
| `guideCanvas` | Hilfsraster, dreht sich sehr langsam   | keine              |
| `fillCanvas`  | Farbflächen                            | keine              |
| `motifCanvas` | Linien der Vorlage                     | keine              |
| `drawCanvas`  | eigene Striche **und** Zeigerereignisse| fängt alle Eingaben|
| `labelCanvas` | Punkte und Rechenaufgaben              | keine              |

Die Trennung ist wesentlich: Das Füllwerkzeug liest `motifCanvas` und
`drawCanvas` als **Wand** (Alpha > 60) und schreibt nach `fillCanvas`. Dadurch
liegen Linien immer über der Farbe und werden beim Füllen nie zerstört.
`labelCanvas` liegt ganz oben, damit Zahlen auch auf gefärbtem Grund lesbar
bleiben.

Vorlage und eigene Striche liegen getrennt, damit beim Wechsel zwischen Hell
und Dunkel die Linienfarbe der Vorlage neu gezeichnet werden kann, ohne
begonnene Arbeit zu zerstören. Nebeneffekt: Der Radierer nimmt nur die eigenen
Striche weg, nie die Vorlage.

**Hell und Dunkel** wechseln Papier, Linien und Hilfsraster mit. Die Werte
stehen doppelt – als CSS-Variablen in `style.css` und als `THEMES` in `app.js`,
weil die Vorlage auf Canvas entsteht und keine CSS-Variable lesen kann. **Beide
Stellen zusammen ändern.** Bereits gefärbte Flächen behalten ihr Pigment.

**Layout.** Die Zeichenfläche bekommt allen Platz, den das Fenster hergibt;
Motive und Werkzeuge liegen in Schubladen, die darüber ein- und ausfahren.
Die Kantenlänge des Blatts setzt `fitStage()` in JavaScript – in CSS lässt sie
sich nicht verlässlich ausdrücken, weil `aspect-ratio` nicht mehr greift,
sobald Breite und Höhe beide feststehen. Dann wird aus dem Mandala eine Ellipse.

**Vollbild.** Der Knopf tut zwei Dinge: die eigene Bedienung tritt zurück
(`body.is-quiet`, nur noch eine schmale schwebende Leiste), und wo der Browser
es zulässt, wird echtes Vollbild angefordert. Safari auf dem iPad kennt die
Vollbild-Schnittstelle nicht überall – dann bleibt es beim ruhigen Modus, und
der bringt schon fast den ganzen Gewinn.

**Farbwelten.** Fünf Sätze zu je 14 gedeckten Pigmenten: Erdpigmente,
Nordlicht, Färbergarten, Rauchglas und eine selbst gemischte. Die eigene
Farbwelt gehört dem Haushalt, nicht einer Person – sie ist Material wie der
Motivkatalog. Die Reihenfolge innerhalb eines Satzes ist
nicht beliebig – die Farblegende der Zählmandalas vergibt die ersten Einträge
der Reihe nach, deshalb stehen die gut unterscheidbaren vorn.

**Schnellzugriff.** Farben, Werkzeuge, Rückgängig und Wiederherstellen liegen
in einer Leiste unter der Zeichenfläche, nicht in einer Schublade – beim Malen
werden sie ständig gebraucht. Die Leiste lässt sich einklappen und bleibt auch
im Vollbild stehen.

**Personen.** Eine dünne Ebene über der Galerie: ein Name, eigene Werke. Kein
Konto, kein Bild, keine Punkte – nur damit sich mehrere Leute auf einem iPad
nicht in die Bilder malen. Werke aus der Zeit davor gehören der ersten Person.

**Sicherung.** Eine Datei mit allen Personen, deren Werken und der eigenen
Farbwelt. Zugleich der Weg auf ein zweites Gerät. Einlesen führt zusammen,
statt zu ersetzen – vorhandene Werke bleiben, Dopplungen entstehen nicht.

**Druckbogen.** A4, ohne Hilfsraster, wahlweise nur die Linien (zum Ausmalen
mit echten Stiften) oder das fertige Werk. Gedruckt wird immer auf hellem
Grund; im Dunkelmodus werden die Linien dafür umgefärbt.

**Galerie.** Fertige Bilder bleiben auf dem Gerät, in IndexedDB. `localStorage`
wäre zu klein: ein Werk wiegt ein paar hundert Kilobyte. Ist IndexedDB nicht
verfügbar (Safari im privaten Modus), hält die App die Werke nur für die
laufende Sitzung – und sagt das, statt es stillschweigend zu schlucken. Jedes
Werk hat einen Titel. Alles bleibt auf dem Gerät und wird nirgends hingeschickt.

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

## Motivkatalog (26 Vorlagen, 5 Welten)

- **Geometrisch-klassisch:** Sternkranz, Rautenkranz, Sternmandala fein,
  Achteckstern, Gitterrose
- **Natur:** Blüte, Blätterkranz, Muschelspirale, Farnkreis, Samenkranz
- **Zen & Achtsamkeit:** Wellenkreis, Tropfenkranz, Ruhefeld, Atemringe,
  Steingarten
- **Jahreszeiten:** Winter, Frühling, Sommer, Herbst
- **Kids-Corner:** Erste Formen (Kindergarten), Formenreigen (Kindergarten),
  Mustertanz (Grundschule), Zähl bis 6, Zähl bis 10, Rechenmandala ZR 10,
  Rechenmandala ZR 20

**Regel für neue Motive:** Genug Ringe, damit der Hintergrund in Felder
zerfällt. Ein Feld, das von der Nabe bis zum Rand reicht, wirkt beim
symmetrischen Füllen wie eine offene Linie – auch wenn die Geometrie
geschlossen ist. Offene Linien müssen bis an Nabe **und** Außenring laufen.
Der Testlauf misst beides.

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
- **Galerie** – lässt sich ein Werk ablegen, umbenennen und herausnehmen?
- **Feldgröße** – wie viel färbt ein Tipp wirklich? Zu große Felder wirken wie
  eine offene Linie, auch wenn die Geometrie geschlossen ist.
- **Atelier** – mischt die eigene Farbwelt, trennt sie die Galerien der
  Personen, liest sie eine Sicherung ohne Dopplung ein?
- **Abgeschlossenheit** – holt die Seite wirklich nichts von außen?
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
- **Der Speicher läuft über eine `Store`-Abstraktion**, nicht direkt über
  `localStorage`: Safari wirft im privaten Modus beim Schreiben, und eine
  spätere Galerie soll denselben Weg nehmen.

## Grenzen

Die Motive sind Canvas-Formen aus Koordinaten, **keine handgezeichneten
Illustrationen**. Das ist eine echte Grenze und lässt sich nicht wegprogrammieren:
Was hier entsteht, ist geometrische Ornamentik. Wer freie Illustration will,
braucht gezeichnete Vorlagen – die kann die App anzeigen, aber nicht erfinden.

## Sinnvolle nächste Schritte

1. **Person löschen** – heute lassen sich Personen anlegen und umbenennen,
   aber nicht entfernen. Das Löschen nimmt Werke mit und braucht deshalb eine
   saubere Rückfrage.
2. **Mehr Vorlagen** je Welt; der Katalog ist bewusst erweiterbar angelegt.
3. **Eigene Farbwelt benennen** und mehrere davon halten.
4. **Test am echten iPad** – bisher läuft der Testlauf nur in einem
   kopflosen Chromium. Zeichnen mit dem Finger, Safaris Vollbild und die
   Geschwindigkeit bei 24 Achsen sind ungeprüft.
