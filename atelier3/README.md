# Blatt — Atelier 3.0

Die zweite App in diesem Repository. Sie steht **neben** dem Mandala Atelier,
nicht an seiner Stelle. Das Konzept dahinter steht in
[`../docs/atelier-3.md`](../docs/atelier-3.md); hier steht, wie sie gebaut ist.

Ein Blatt. Man streicht darüber, und ein Mandala kommt hervor — wie wenn man
Papier über eine Münze legt und mit dem Bleistift darüber reibt. Man malt
nicht, man **reibt durch**.

## Warum es die App gibt

Die Frage, die sich am Schreibtisch nicht beantworten ließ: Nimmt die
Symmetrie des Mandala Ateliers dem Menschen gerade die Wiederholung ab, die
der Wirkmechanismus sein soll? Eine Handbewegung wird dort achtundvierzigfach.

- **Atelier 2 wettet:** Ordnung wird geschenkt.
- **Blatt wettet:** Ordnung wird hervorgebracht. Nichts wird vervielfältigt.

Beide geben Ordnung. Nur eines gibt auch die Arbeit zurück. Welches die
bessere Viertelstunde ergibt, entscheiden Menschen, nicht Argumente — das
Vergleichsprotokoll steht im Konzeptpapier.

## Starten

Nichts zu bauen. `atelier3/index.html` im Browser öffnen genügt.

Auf dem iPad braucht es `https`, sonst arbeitet der Service Worker nicht.
Die GitHub-Pages-Adresse ist dieselbe wie beim Mandala Atelier, nur mit
`/atelier3/` am Ende. Danach in Safari „Teilen → Zum Home-Bildschirm“.

**Für den Vergleich beide Apps ablegen.** Sie haben eigene Icons, eigene
Namen und eigene Speicher; auf dem Homescreen sind sie auf einen Blick
unterscheidbar.

## Randbedingungen

Dieselben wie beim Mandala Atelier: alles offline, alles im Browser, keine
Server, keine Konten, kein Tracking, keine Werbung, iPad zuerst, deutsche
Oberfläche.

Zwei Verschärfungen:

- **Keine Schriftdatei.** Diese App sagt so wenig, dass Systemschriften
  genügen. Das spart die 400 kB von `fonts.css` und macht die Zusage „lädt
  nichts nach“ trivial wahr.
- **Kein Klang aus einer Datei.** Das Reibegeräusch wird zur Laufzeit
  synthetisiert (gefiltertes rosa Rauschen).

**Eigener Service-Worker-Bereich (`/atelier3/`) und eigener Cache-Name.**
Beides ist zwingend, sonst greifen die beiden Apps einander in den Cache und
auf dem iPad überlebt nur eine. Bei jedem Release `const CACHE` in `sw.js`
erhöhen.

## Dateien

    index.html              Gerüst: Blatt, Pigmente, Fach, Stapel
    style.css               Raum, Blatt, Pigmentstifte, die Stille
    app.js                  Gesamte Logik, in 15 kommentierte Abschnitte geteilt
    manifest.webmanifest    PWA-Manifest
    sw.js                   Service Worker, Bereich /atelier3/
    icon-*.png              6 Icons, prozedural erzeugt

## Wie das Durchreiben funktioniert

**Unter dem Papier liegt ein Relief.** Ein Höhenfeld über dem ganzen Blatt,
n-zählig drehsymmetrisch, aus konzentrischen Bändern: Rosette, Blütenkränze,
Gitter, Perlen, Wellen, Strahlen, Bögen, dazwischen Randlinien. Erhebungen
sind die Ornamentlinien, dazwischen liegen Flächen tiefer.

**Was die Hand tut, bestimmt, wie tief der Kontakt greift.**

| Hand | Blatt |
|---|---|
| langsam | viel Pigment, satte Farbe |
| schnell | wenig Pigment, luftiger Hauch |
| fest (wo Druck gemeldet wird) | greift bis in die Tiefen, wird flächig |
| leicht | küsst nur die Höhen, das Ornament tritt scharf hervor |
| noch einmal darüber | dichter — bis es asymptotisch nicht mehr weitergeht |

Die Griffkurve ist `bite = (relief)^gamma`, **keine Schwelle**. Es gibt keinen
Zustand, in dem gar nichts passiert. Wer lange genug an einer Stelle bleibt,
füllt sie auch mit leichter Hand. Das ist wichtig, weil die meisten Geräte
überhaupt keinen Druck melden — dort trägt die Langsamkeit die ganze
Ausdruckskraft (`GAMMA_LIGHT`/`GAMMA_FIRM`, gespeist aus Druck **und** Tempo).

**Der Abstand der Höhenstufen ist die eigentliche Gestaltungsentscheidung.**
`OUTER 0.16 < BASE 0.38 < Plateaus 0.52…0.70 < Linien 1.0`. Zu weit
auseinander, und man bekommt nie mehr als eine Zeichnung; zu eng, und alles
kommt gleichzeitig hoch. Diese Zahlen und die Gamma-Werte gehören zusammen —
wer eine ändert, muss die anderen ansehen.

**Pigment über Pigment gibt eine dritte Farbe.** Nicht reine Multiplikation,
die liefe unweigerlich ins Schwarze. Das Ziel liegt zwischen der reinen
Pigmentfarbe und ihrer Multiplikation mit dem Untergrund (`MIX_SUB`), und
läuft damit in einen Fixpunkt: satt gebaut, aber nie tot. **Nichts
verschwindet, und nichts lässt sich zumatschen** — deshalb braucht es kein
Rückgängig und keinen Radierer. Nicht als Strenge, sondern weil es keinen
Zustand gibt, aus dem man gerettet werden müsste.

**Tag und Nacht sind kein Thema, sondern zwei Papiere.** Bei Tag helles
Papier mit subtraktivem Pigment, bei Nacht getöntes Papier mit heller Kreide
(dieselbe Rechnung, nur `screen` statt `multiply`). Welches ein Blatt ist,
entscheidet sich bei seiner Entstehung und bleibt dann — ein Blatt wechselt
nicht die Farbe, nur weil es Abend wird. Der Raum folgt dem Blatt.

## Technischer Aufbau

**Ein Canvas**, fest 1280 × 1280, per CSS skaliert. Die Größe darf sich
**nie** ändern, sonst wäre das begonnene Bild verloren. Drei Puffer:

| Puffer | Inhalt |
|---|---|
| `relief` | `Uint8Array`, das Höhenfeld — einmal gerechnet |
| `dens` | `Float32Array`, wie viel Pigment je Pixel liegt |
| `pix` | die `ImageData` des sichtbaren Bildes |

**Das Relief wird nicht je Pixel ausgewertet.** Das Feld ist exakt um 2π/n
drehsymmetrisch, deshalb wird es über einen einzigen Keil in eine
Polartabelle gerechnet (700 × ~430 Punkte) und danach nur noch bilinear
abgetastet. Das spart den Faktor n an teuren Auswertungen. Alle Ornamente
sind deshalb n- oder 2n-zählig, nie etwas dazwischen — **diese Regel nicht
brechen**, sonst zerfällt die Tabelle.

Weitere Beschleunigungen, alle nötig: eine Tabelle für die Gaußglocke statt
`Math.exp`, ein Abstandstest vor den Randlinien, eine Näherung für `atan2`,
vorgerechnete Gitter für das Papierrauschen. Zusammen liegt ein Blatt bei
etwa **260 ms** auf einem Schreibtischrechner; auf einem iPad eher 400–500 ms.
Deshalb liegt hinter „Neues Blatt“ eine Überblendung.

**Es wird nie das ganze Blatt neu gezeichnet.** Zeigerereignisse werden nur
eingesammelt; aufgetragen wird einmal je Bild, über ein schmutziges Rechteck
um den Weg der Hand. 1280² Pixel je Bild hält kein iPad durch.

**Der Handballen malt nicht mit.** Es malt ausschließlich der erste, primäre
Zeiger; alle weiteren Kontakte werden verworfen. Wer minutenlang über ein
Blatt reibt, legt die Hand auf — ohne diese Regel wäre jede Sitzung nach zwei
Minuten ruiniert. Das Mandala Atelier braucht das nicht, weil dort in kurzen
Zügen gearbeitet wird.

**Kein Rückgängig heißt auch: keine Schnappschuss-Historie.** Im Mandala
Atelier darf die bis zu 128 MB belegen. Hier gibt es sie nicht — eine
philosophische Entscheidung mit angenehmem Nebeneffekt.

**Speicher.** Das laufende Blatt wird entprellt in IndexedDB gesichert, als
zusammengesetztes Bild plus Seed des Reliefs. Beim Fortsetzen wird die Dichte
aus der Helligkeit zurückgerechnet — eine Näherung, aber eine ehrliche: Das
Blatt erinnert sich an das, was man sieht. Ein Totgang (`GRAIN_DEADBAND`)
sorgt dafür, dass Papierkorn und Randabschattung nicht als Pigment gelesen
werden. Ohne IndexedDB (Safari im privaten Modus) hält die App das Blatt nur
für die Sitzung und sagt das im Fach — nicht als Meldung.

## Was es bewusst nicht gibt

Kein Werkzeugwechsel, keine Strichstärke, kein Radierer, kein Rückgängig,
keine Füllfunktion, keine Symmetrie-Einstellung, keine Vorlagenauswahl, keine
Farbwelten, kein Speichern-Knopf, keine Prozentanzeige, keine Zeit, keine
Zahl, keine Vollbild-Taste.

Entscheidungen vor dem ersten Strich: **eine** — welches Pigment. Und selbst
die liegt schon in der Hand. Im Mandala Atelier sind es Motiv × Werkzeug ×
Strichstärke × Farbwelt × Pigment × Achsen × Spiegelung × Hilfsraster, also
gut eine Million Kombinationen.

**Die Kids-Corner und die Rechenmandalas kommen nicht mit.** „Ergebnis 7“,
Legende befolgen, richtig oder falsch — reine Aufgabenerfüllung und damit der
exakte Gegenpol. Völlig legitim für Lehrkräfte, aber ein anderes Produkt.

## Anfang, Dauer, Ende

Es gibt keinen Anfang: Das Blatt liegt so da, wie man es verlassen hat, auch
nach Tagen. Nirgends steht, wie lange man schon dabei ist.

Nach vierzig Sekunden ohne Berührung tritt die Bedienung ab — die Pigmente
verblassen, das Zeichen verschwindet, das Blatt steht allein. Kein Knopf,
kein „Gespeichert!“, kein Titelfeld, keine Frage. Wer die Hand wieder
auflegt, macht weiter.

Fertige Blätter liegen in einem **Stapel**, nicht in einem Kachelraster. Ein
Raster stellt Bilder nebeneinander und lädt zum Vergleichen ein, und
Vergleichen ist der Anfang von Bewertung.

## Die Prägung — die heikelste Zahl

`HINT_BASE` (0,030) bestimmt, wie deutlich das Relief im **unberührten**
Papier durchscheint. Sie wird auf die Steigung des Reliefs angewandt, nicht
auf seine Höhe: Was man sieht, ist eine Prägung im Papier, kein Strich.

- Zu wenig → man weiß nicht, wo man anfangen soll.
- Zu viel → ein geprägtes Ausmalbuch, und wir hätten die Schwester-App
  nachgebaut, nur umständlicher.

Beim Bauen ist genau das einmal passiert: Der Wert wurde auf Byte-Werte
angewandt, war also 255-fach zu stark, und das unberührte Blatt zeigte das
ganze Mandala als saubere Strichzeichnung.

Für den Vergleich lässt sich die Stärke über **`?relief=0…2`** verstellen —
in der Oberfläche gibt es dafür nichts, und Testpersonen sollen davon auch
nichts wissen. Das ist der Regler für die Frage, die das Konzeptpapier als
größtes Risiko benennt.

## Testen

    npm install
    npm run test:atelier3        # oder: npm run test:alle

Geprüft wird nicht, ob es hübsch aussieht — das muss man ansehen. Geprüft
wird, ob die Zusagen des Entwurfs gelten: nichts von außen; die Hand
hinterlässt eine Spur; langsam ist dichter als schnell; Wiederholung
vertieft, sättigt und kippt nie ins Schwarze; das Gemachte ist n-zählig
drehsymmetrisch; das unberührte Papier verrät das Relief fast nicht; der
Handballen malt nicht mit; es gibt kein Rückgängig; das Blatt bleibt in vier
Auflösungen quadratisch; ein begonnenes Blatt überlebt den Neustart.

Der Testlauf startet dafür kurz einen winzigen Dateiserver — über `file://`
gibt es keinen Origin und damit keine IndexedDB, die einen Neustart übersteht.

Vor dem Ausliefern zusätzlich am iPad prüfen: beide Ausrichtungen, Reiben mit
dem Finger **und** mit der aufliegenden Hand, Klang, Dunkelmodus.

## Fallen, die schon zugeschnappt sind

1. **`display: flex` schlägt `hidden`.** Fach und Stapel bekommen im CSS ein
   `display: flex`; das überstimmt das `display: none`, das der Browser dem
   `hidden`-Attribut mitgibt. Der Stapel lag dadurch unsichtbar über dem
   ganzen Blatt und fing jede Berührung ab — die App war vollständig tot,
   und in den Canvas-Vorschauen war davon nichts zu sehen, weil `toDataURL`
   die Überdeckung nicht kennt. Deshalb steht ganz oben in `style.css`
   `[hidden] { display: none !important; }`. **Nicht entfernen.**

2. **Die Prägung mit Byte-Werten rechnen.** Siehe oben — Faktor 255.

3. **Blockiges Papier.** Ein bloßes `hash2(x >> 4, y >> 4)` für die
   Wolkigkeit ergibt ein sichtbares Schachbrett. Papier hat keine Kacheln,
   also zwischen den Gitterpunkten weich überblenden.

4. **Die Höhen zu weit auseinander.** Beim ersten Versuch lag die Fläche bei
   0,11 gegen Linien bei 1,0. Ergebnis: Man bekam ausschließlich Linien, die
   Flächen nahmen praktisch nie Farbe an. Die Stufen und die Gamma-Werte
   müssen zusammen gedacht werden.

5. **Die Größe des Canvas ändern.** `SIZE` ist fest. Würde sie mit `dpr` oder
   der Fenstergröße wandern, wäre bei jeder Drehung des iPads die Arbeit weg.

## Grenzen

**Erreichbarkeit.** Eine App, deren ganzer Sinn eine ausdauernde
Handbewegung ist, schließt Menschen aus, denen diese Bewegung schwerfällt.
Dafür gibt es hier **keine Lösung**, und das soll nicht überspielt werden.
Ein langsamerer Modus mit größerer Kontaktfläche wäre ein Anfang, kein
Ersatz. Bedienelemente sind beschriftet und tastaturbedienbar, das Reiben
selbst ist es nicht.

**Glas ist nicht Papier.** Minutenlanges Reiben auf einer Scheibe quietscht,
fettet und ermüdet. Der Klang überschreibt einen Teil davon, nicht alles.

**Folgenlosigkeit könnte langweilen.** Man kann hier nichts falsch machen.
Ob das befreit oder die Spannung nimmt, weiß niemand — es ist eine der
Fragen, die der Vergleich beantworten soll.

**Keine Wirkungsversprechen.** Nirgends in der App, nirgends in einer
Beschreibung. Was hier entsteht, ist eine Tätigkeit mit plausibler Wirkung.
