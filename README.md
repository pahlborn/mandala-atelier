# Mandala Atelier

> **In diesem Repository liegen zwei Apps.** Diese hier im Wurzelverzeichnis,
> und daneben in [`atelier3/`](atelier3/) die App **„Blatt“ (Atelier 3.0)** –
> kein Nachfolger, sondern eine **Gegenprobe** mit der entgegengesetzten
> Wette. Beide bleiben lauffähig, beide werden getrennt installiert, und
> Menschen sollen sie vergleichen. Das Warum steht in
> [`docs/atelier-3.md`](docs/atelier-3.md), das Wie in
> [`atelier3/README.md`](atelier3/README.md).
>
> Kurz: Atelier 2 wettet, **Ordnung wird geschenkt** – eine Handbewegung wird
> achtundvierzigfach. Blatt wettet, **Ordnung wird hervorgebracht** – nichts
> wird vervielfältigt, man reibt ein verborgenes Relief hervor. Welches die
> bessere Viertelstunde ergibt, entscheiden Testpersonen, nicht Argumente.

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
arbeitet der Service Worker nicht. GitHub Pages ist dafür eingerichtet
(Branch `main`, Ordner `/`) und liefert beide Apps ohne weiteres Zutun:

| Adresse | |
|---|---|
| `…/mandala-atelier/` | Mandala Atelier |
| `…/mandala-atelier/atelier3/` | Blatt (Atelier 3.0) |
| `…/mandala-atelier/beide.html` | Einstiegsseite zum Ablegen beider |

Am einfachsten geht man über **`beide.html`**: dort stehen beide Apps
nebeneinander, und man legt sie nacheinander über „Teilen → Zum
Home-Bildschirm“ ab. Danach liegen zwei unterscheidbare Symbole auf dem
Gerät, „Mandala“ und „Blatt“. Beide starten im Vollbild und laufen ohne Netz.

Die Seite gehört zu keiner der beiden Apps und ist bewusst nüchtern: keine
Beschreibung einer Wirkung, keine Empfehlung, keine Reihenfolge – wer dort
landet, könnte eine Testperson sein.

**Die beiden Apps gehen einander vollständig aus dem Weg:** eigene Icons und
Namen, getrennte Service-Worker-Bereiche und Cache-Namen, getrennte
Speicher (`mandala-atelier.*` gegen `atelier3-*`, eigene Datenbanken).

Zwei Stellen mussten dafür ausdrücklich geregelt werden, beide in `sw.js`:
Der Worker hier räumt beim Aktivieren **nur die eigenen** alten Caches weg
(vorher alle – das hätte Blatt bei jedem Release den Offline-Vorrat
gelöscht), und er fasst Abrufe unter `/atelier3/` nicht an, obwohl sein
Geltungsbereich sie mit einschließt. `.nojekyll` liegt bei, damit Pages die
Dateien unverändert ausliefert.

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

    docs/atelier-3.md       Konzept und Vergleichsprotokoll für Atelier 3.0
    atelier3/               Zweite App „Blatt“ – eigenes README dort
    beide.html              Einstiegsseite: beide Apps auf den Homescreen
    .nojekyll               Pages liefert unverändert aus

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
    tools/gen-atelier3-icons.js  Icons für „Blatt“
    tools/test-atelier3.js  Testlauf für „Blatt“
    tools/test-nebeneinander.js  Prüft, dass sich beide Apps nicht stören
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

**Schnellzugriff.** Farben, Werkzeuge, Vergrößern, Rückgängig und
Wiederherstellen liegen in einer Leiste unter der Zeichenfläche, nicht in einer
Schublade – beim Malen werden sie ständig gebraucht. **Alle** Pigmente der
Farbwelt müssen dort sichtbar sein; eine seitlich scrollbare Reihe findet
niemand, auf dem Telefon waren zwei von vierzehn zu sehen. Deshalb bricht die
Reihe um, statt zu schieben. Der Testlauf zählt sie in fünf Auflösungen.

Die Werkzeuge tragen gezeichnete Symbole und **behalten ihre Beschriftung**,
auch auf dem Telefon. Vorher standen dort Zeichen aus dem Zeichensatz; `⌫`
las sich als Rücktaste, nicht als Radiergummi. Ein Wort ist verlässlicher als
ein Symbol – die Leiste darf dafür eine Zeile mehr brauchen.

**Vergrößern.** Knöpfe für Plus, Minus und Zurücksetzen, dazu Zwei-Finger-Gesten
zum Zoomen und Schieben. Der Anlass war, dass der Versuch zu zoomen sonst im
Zeichnen landete: Sobald ein zweiter Finger aufsetzt, wird der eben begonnene
Strich zurückgenommen und stattdessen geschoben. `.stage` muss dabei
`overflow: hidden` behalten, sonst malt das vergrößerte Blatt über die
Schnellzugriffsleiste. Die Zeigerkoordinaten stimmen automatisch, weil
`toLocal()` über `getBoundingClientRect()` rechnet und die Vergrößerung darin
schon steckt.

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

**Grundformen.** Freihand gezogene Kreise werden krumm – das liegt an der
Sache, nicht am Können. Das Werkzeug **Form** setzt deshalb dieselben fünf
Bausteine exakt, aus denen auch die Vorlagen bestehen: Ring, Speiche, Blatt,
Raute, Band. Aufsetzen legt Anfang und Achse fest, Ziehen nach außen die
Länge, seitliches Ziehen die Breite; losgelassen wird die Form auf allen
Achsen zugleich gesetzt. Die Vorschau liegt auf der Rasterebene, die ohnehin
laufend neu gezeichnet wird – so bleibt nichts zurück, wenn man abbricht.
Der Testlauf misst die Rundheit an 72 Winkeln.

**Symmetrie.** `segmentLine(p0, p1)` zeichnet jede Linie n-mal um die Mitte
rotiert; bei aktiver Spiegelung zusätzlich an der Waagerechten gespiegelt.
Achsen 6/8/10/12/16/24, mit Spiegelung also bis 48-fach.

**Füllen.** Scanline-Flood-Fill mit Span-Verfolgung. Es wird **pro
Symmetrie-Position ein eigener Startpunkt** gesetzt – ein Tipp färbt alle
gleichwertigen Felder zugleich. Das ist der Komfortgewinn gegenüber einem
Papier-Ausmalbuch und sollte erhalten bleiben.

Ob das geschieht, entscheidet der Schalter **„Füllen wirkt auf alle Achsen“**
unter Symmetrie. An ist das Voreingestellte – der Komfortgewinn gegenüber
Papier. Aus, wer jedes Feld einzeln setzen und dabei eigene Muster legen will.

Davon unberührt: Bei Zähl- und Rechenmandalas trägt jedes Feld einen eigenen
Wert, dort wird **immer** einzeln gefüllt. Das ist keine Einstellung, sondern
eine Bedingung – sonst bekämen Felder mit verschiedenen Ergebnissen dieselbe
Farbe und die Aufgabe wäre hinfällig. Der Schalter ist dann gesperrt und sagt
warum (`isExercise()` / `fillsSymmetrically()`).

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

Bei Zähl- und Rechenmandalas steht die **Aufgabenstellung** über dem Blatt,
freundlich formuliert und an das Kind gerichtet – ohne sie erschließt sich
nicht, was zu tun ist. Sie steht auch auf dem Druckbogen.

Die Aufgabe verweist auf die Farben, also müssen die erreichbar sein: Bei
diesen Motiven wird die Schnellzugriffsleiste **selbst zur Legende** und zeigt
statt der vollen Palette genau die gebrauchten Farben, jede mit ihrer Zahl
daneben. Eine Legende, die in einer Schublade liegt, hilft einem Kind nicht.

Zusätzlich erscheint die ausführliche **Farblegende** in der Bedienleiste („Ergebnis 7“, „4 Punkte“). Sie wird aus den tatsächlich
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
    npm test             # diese App
    npm run test:alle    # beide Apps und ihr Nebeneinander

`test:nebeneinander` ist der Wächter über die Koexistenz: Er startet kurz
einen Dateiserver, lässt beide Service Worker laufen, erzwingt eine
Neufassung des Workers hier und prüft dann dreierlei – dass Blatt am Ende
von seinem eigenen Worker bedient wird, dass keine `/atelier3/`-Datei im
Vorrat dieser App landet, und dass ein fremder Vorrat das Aufräumen
übersteht.

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
- **Vergrößern** – stimmen die Koordinaten beim Zeichnen im Maßstab, und
  hinterlässt eine Zwei-Finger-Geste wirklich keinen Strich?
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
