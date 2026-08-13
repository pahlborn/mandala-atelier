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

**Für den Vergleich beide Apps ablegen** – am einfachsten über
[`../beide.html`](../beide.html), wo sie nebeneinander stehen. Sie haben
eigene Icons, eigene Namen und eigene Speicher; auf dem Homescreen sind sie
auf einen Blick unterscheidbar.

Der Service Worker des Mandala Ateliers liegt eine Ebene höher, sein
Geltungsbereich schließt `/atelier3/` also mit ein. Damit die beiden Apps
sich nicht ins Gehege kommen, räumt er nur noch seine **eigenen** alten
Caches weg und fasst Abrufe unter `/atelier3/` gar nicht erst an. Wer dort
etwas ändert, muss das mitdenken.

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

**Die zweite Hand.** Ein Finger reibt, **zwei Finger bewegen das Blatt** –
heranholen, verschieben. Beim Ausmalen auf Papier malt eine Hand und die
andere schiebt das Blatt zurecht; genau das ist gemeint. Kein Bedienelement,
keine Einstellung, kein Modus.

Der Unterschied zum Zoom des Browsers ist wesentlich: Der vergrößert die
ganze Stube samt Pigmenten, die dabei aus dem Bild wandern. Hier bewegt sich
nur das Blatt, die Stifte bleiben auf dem Tisch liegen.

Der Weg zurück ist kein Knopf: Nach vierzig Sekunden Ruhe **sinkt das Blatt
mit in die Vollansicht zurück**, zusammen mit dem Abtreten der Pigmente. Der
Abschluss zeigt so immer das ganze Mandala und nie einen Ausschnitt – und man
kann sich nicht aussperren.

Grenzen: nie kleiner als bildfüllend, nach oben Anschlag bei 2,2. Über die
Grenzen lässt es sich weich hinausziehen und federt beim Loslassen zurück.
Der obere Anschlag ist nicht willkürlich – jenseits davon sieht man nicht
mehr Mandala, sondern das Raster der 1280 Punkte. Bis dahin liest es sich
als Papierstruktur, so wie man beim Naherangehen an echtes Papier Fasern
sieht und keine feineren Blüten.

**Der Kontakt klebt am Glas, nicht am Bild.** Eine Fingerkuppe ist rund zwölf
Millimeter breit, und daran ändert sich nichts, wenn man näher herangeht.
Deshalb steht der Kontaktradius in Bildschirmpunkten (`R_FINGER_CSS`,
`R_PEN_CSS`) und wird erst zur Laufzeit in Blatt-Einheiten umgerechnet. Holt
man das Blatt heran, deckt dieselbe Fingerkuppe **weniger** Bildfläche ab –
so wird feine Arbeit möglich, ohne dass es dafür einen Regler gäbe. Stünde
der Radius wie früher fest in Blatt-Koordinaten, wüchse der Finger beim
Heranholen mit und das Näherkommen wäre nutzlos.

**Werkzeug wird nicht gewählt, sondern erkannt.** Finger und Stift kommen als
verschiedene Zeigerarten herein und bekommen ihre eigene Kontaktbreite und
ihren eigenen Umgang mit Druck. Man kann mitten in einem Blatt wechseln, ohne
irgendwo etwas umzustellen. Solange ein Stift aufliegt, werden Berührungen
vollständig verworfen – das ist der Handballen. Mit dem Finger entscheidet
die Zeit: ein zweiter Kontakt innerhalb von 260 ms ist die zweite Hand, ein
späterer ist der Ballen.

In derselben Frist trägt ein **ruhender** Finger noch kein Pigment auf. Ein
Reiben beginnt mit einer Bewegung, ein Heranholen mit zwei ruhenden Fingern –
ohne diese Frist bliebe von jedem Heranholen ein dunkler Punkt zurück.

**Der Weg trägt auf, nicht die Zeit.** Farbe wandert durch Reibung auf das
Papier, und Reibung braucht Weg. Ein Zug über eine Stelle legt `PASS` ab,
gleich ob langsam oder schnell gefahren; eine ruhende Hand hat nichts mehr
zu geben und trägt nur noch langsam nach (`REST_RATE`, ungefähr ein Zug je
Sekunde).

Das stand lange falsch herum — der Auftrag hing an der Verweildauer — und
es waren **zwei Beschwerden aus einem Rechenfehler**: große Flächen blieben
blass wie Geschmiere, weil zügiges Streichen fast nichts ablegte, und jedes
Zögern brannte einen dunklen Fleck. Wer daran wieder dreht, dreht an beidem
gleichzeitig.

Zwei Feinheiten sind nötig, damit „ein Zug ist ein Zug“ auch stimmt, wenn
ein Gerät die Hand hundertmal je Sekunde meldet:

* Der Auftrag eines Teilstücks ist `PASS · seg/(seg + span)`, nicht
  `PASS · seg/span`. `span` ist die *wirksame* Breite des Kontakts
  (`CONTACT_SPAN · radius`, das Integral des Kontaktprofils). Jedes
  Teilstück trägt auch an seinen beiden Enden eine halbe Kontaktscheibe
  mit sich; ohne den Nenner legten viele winzige Stücke fast doppelt so
  viel ab wie wenige große.
* Die Dichte wächst mit `add = dep/(1 + dep/2) · (1 − cur)`, der billigen
  Fassung von `1 − e^(−dep)`. Damit multiplizieren sich die Restanteile zu
  `e^(−Summe)`: Die Summe zählt, die Stückelung nicht.

Gemessen: über einen Bereich von 1 bis 120 Teilstücken je Strich bleibt die
Dichte innerhalb von 4 %. Der Test `der Weg trägt auf, nicht die Zeit` hält
das fest.

**Was die Hand tut, bestimmt, wie tief der Kontakt greift.** Nicht mehr,
wie viel — sondern wie tief.

| Hand | Blatt |
|---|---|
| langsam | greift bis in die Mulden, die Fläche füllt sich |
| schnell | streift die Grate, das Ornament tritt als Zeichnung hervor |
| fest (wo Druck gemeldet wird) | dasselbe wie langsam, nur bewusst |
| noch einmal darüber | dichter — bis es asymptotisch nicht mehr weitergeht |

Die Griffkurve ist `bite = (relief)^gamma`, **keine Schwelle**. Es gibt keinen
Zustand, in dem gar nichts passiert. Wer oft genug über eine Stelle geht,
füllt sie auch mit leichter Hand. Das ist wichtig, weil die meisten Geräte
überhaupt keinen Druck melden — dort trägt die Langsamkeit die ganze
Ausdruckskraft (`GAMMA_LIGHT`/`GAMMA_FIRM`, gespeist aus Druck **und** Tempo,
mit `GRIP_BASE` als Boden: auch der flüchtigste Kontakt greift ein wenig).

### Die Trennschärfe der leichten Hand — `?griff=`

Beim Umstieg auf den Wegauftrag wurden **zwei Dinge zugleich** geändert: die
*Menge* (Zeit → Weg, die Antwort auf zwei Befunde vom iPad) und die
*Trennschärfe* (`GAMMA_LIGHT` 3,6 → 2,0, dazu der neue Boden `GRIP_BASE`).
Die Trennschärfe verlangte kein Befund; sie kam mit.

Sie entscheidet aber genau darüber, ob eine leichte Hand nur die Ränder
hervorholt oder gleich die Flächen mitnimmt — und damit, ob man ein Blatt
**erst zeichnen und danach ausmalen** kann. Über `?griff=` lässt sich das
vergleichen, ohne dass die Oberfläche etwas davon zeigt:

| `?griff=` | Gamma | Linie | Fläche | Verhältnis |
|---|---|---|---|---|
| `zart` | 3,18 | 0,431 | 0,023 | 18,5 : 1 |
| `mittel` | 2,55 | 0,438 | 0,043 | 10,2 : 1 |
| *ohne Angabe* (`jetzt`) | 1,69 | 0,448 | 0,092 | 4,8 : 1 |

Gemessen mit echtem Reiben, leichte zügige Hand über ein ganzes Blatt. Die
Zahlen zeigen das Entscheidende: **Die Linie kommt in allen drei Fassungen
gleich schnell** — nur die Fläche hält sich zurück. Der Wegauftrag bleibt
unangetastet, `GAMMA_FIRM` auch: Die feste, langsame Hand füllt überall
gleich gut. Ohne Angabe bleibt alles, wie es ist.

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

## Die Anlage — ein Grundriss statt eines Kranzes

Der fünfte Charakter fällt aus der Reihe, und zwar mit Absicht. „Ruhe“,
„Blüte“, „Klarheit“ und „Fülle“ **biegen** den Generator: andere Zähligkeit,
andere Bandzahl, anderes Ornament. „Anlage“ **ersetzt** ihn.

Denn ein Grundriss lässt sich nicht würfeln, nur bemessen. Die Abfolge steht
fest, weil sie die Sache selbst ist:

    Schutzbereich → Vorhöfe → vier Tore → Mauer → Innenhof → Kammer → Mitte

Gewürfelt werden die Maße: Weite der Bereiche, Zahl der Mauerwerke im
Schutzbereich (16, 20 oder 24), Größe der Torhäuser, Abstand der Binder. Zwei
Anlagen sind so verschieden wie zwei Häuser desselben Baumeisters.

**Eine Anlage hat immer n = 4.** Das ist keine Vorliebe, sondern Bedingung: Ein
Quadrat ist vierzählig, und die Rasterung setzt exakte Drehsymmetrie um 2π/n
voraus (siehe oben). Käme je ein anderes n heraus, zerfiele das Feld. Die
Ornamente im Schutzbereich dürfen trotzdem 16-, 20- oder 24-zählig sein — alles
Vielfache von vier.

**Gerechnet wird in `per` und `lat`.** Die drei neuen Bauteile — `wall`,
`yard`, `gate` — falten den Winkel auf eine der vier Himmelsrichtungen: `per`
ist der Abstand vom Mittelpunkt senkrecht zur Mauer, `lat` die Lage längs der
Mauer. Ein Quadrat ist in diesen Größen einfach `per = s`, und Binder sind
Linien bei festem `lat`. Ohne diesen Kniff bräuchte es Kartesisches im
Polarfeld, und die Nachschlagetabelle wäre hin.

### Die Staffelung: nach innen gibt das Blatt weniger her

Das ist der eigentliche Gedanke, und er ist die Übersetzung der gestaffelten
Symmetrie aus dem Mandala Atelier in die Sprache dieser App. Dort nimmt die
Maschine nach innen immer weniger ab. Hier gibt **das Papier** nach innen immer
weniger her — über `gain` (Höhe des Grats) und `lws` (Breite des Grats):

| Bereich | Relief | nach zwei leichten Zügen |
|---|---|---|
| Schutzbereich | 1,00 | 0,60 |
| Vorhof | 0,88 | 0,51 |
| Palastmauer | 0,78 | 0,43 |
| Innenhof | 0,68 | 0,35 |
| Kammer | 0,60 | 0,28 |
| Mitte | 0,54 | 0,24 |
| *blanke Fläche* | *0,38* | *0,12* |

Beide Male wird das Innere mehr und mehr die eigene Arbeit. Der Testlauf misst
die Reihe genau auf dem Grat jedes Bauteils — ein Flächenmittel wäre von der
blanken Fläche beherrscht und sagte nichts.

**Die Untergrenze ist so wichtig wie die Staffelung.** Auch die Mitte muss
deutlich über der blanken Fläche liegen (gemessen: 1,4-fach). Ein Bauteil, das
man nicht mehr findet, wäre kein Widerstand, sondern ein Fehler.

**Und die Staffelung meint Geduld, nicht Kraft.** Wer die Mitte mit fester Hand
holen will, bekommt sie nicht: Fest greift bis in die Mulden, die Fläche füllt
sich, und die Architektur ersäuft in Pigment. Das ist keine Eigenheit der
Anlage, sondern die Bauart dieser App — nur fällt es hier zum ersten Mal auf,
weil es hier etwas zu ertränken gibt. Nach innen kommt man mit **oft**, nicht
mit **stark**.

**Die Mitte bleibt leer.** Sie ist das flachste Stück des Blattes und die
einzige Stelle ohne Ornament. Sie füllt sich durchaus (gemessen 0,66 bis 0,79
Dichte) — aber weil ringsum dichtes Mauerwerk steht, liest sie sich als der
ruhige Ort. Ein Ziel ist sie nicht: Es gibt kein Ankommen, keine Meldung, nichts,
was passiert, wenn man dort ist.

## Die Farbwelten

Die vier Farbwelten des Mandala Ateliers, unverändert übernommen –
**Erdpigmente, Nordlicht, Färbergarten, Rauchglas**. Ihre Stimmung ist das
eigentliche Kapital. Neun je Welt statt vierzehn: Der Griff soll aus dem
Handgelenk kommen, nicht aus einer Abwägung.

**Gewählt wird die Welt nicht.** Sie gehört zum Blatt, so wie das Relief, und
steckt im Seed. Man setzt sich an einen Tisch, auf dem heute die Erdpigmente
liegen; morgen liegt Nordlicht da. Eine Auswahl wäre eine Entscheidung vor
dem ersten Strich, ein gedeckter Tisch ist keine – und Stifte sucht man sich
auf einem fremden Tisch auch nicht aus. Wer eine andere Stimmung will, nimmt
ein neues Blatt.

Der Zweig des Seeds für die Welt ist ein anderer als der fürs Relief, sonst
wanderte die Farbe mit der Zähligkeit mit. Gesicherte Blätter tragen ihre
Welt zusätzlich bei sich: Käme später eine fünfte dazu, verschöbe sich sonst
die Farbe eines längst gemalten Blattes.

**Die Kreide wird abgeleitet, nicht ein zweites Mal ausgesucht.** `asChalk()`
behält den Farbton, hebt die Helligkeit und nimmt die Buntheit leicht zurück.
So ist eine Welt bei Tag und bei Nacht dieselbe Welt – und der dunkelste
Pigmentstift wird ganz von selbst zum hellsten, der Kreide.

**Kein Weiß bei Tag.** Pigment liegt dort subtraktiv; ein weißer Stift hätte
den Wert 255 und würde jede dunklere Stelle aufhellen. Er wäre ein Radierer
mit anderem Namen, und es gibt auch kein harmloses Elfenbein – jedes Pigment,
das heller ist als das, was daliegt, hellt auf. Gebraucht wird es ohnehin
nicht: **In dieser App ist Weiß schon da. Es heißt „nicht reiben“.** Beim
Nachtblatt dagegen ist Weiß ein vollwertiges Pigment, weil es dort auf
getöntem Grund hinzufügt statt wegzunehmen.

**Tag und Nacht sind kein Thema, sondern zwei Papiere.** Bei Tag helles
Papier mit subtraktivem Pigment, bei Nacht getöntes Papier mit heller Kreide
(dieselbe Rechnung, nur `screen` statt `multiply`). Welches ein Blatt ist,
entscheidet sich bei seiner Entstehung und bleibt dann — ein Blatt wechselt
nicht die Farbe, nur weil es Abend wird. Der Raum folgt dem Blatt.

**Gewählt wird das Papier in der Lade, nicht am Gerät.** Zwei kleine
Kacheln, jede in ihrem eigenen Ton, mit drei Pigmenten der gerade gewählten
Welt darauf: Man wählt nicht „hell“ oder „dunkel“, sondern sieht, wie die
Farbe darauf liegen wird. Solange die Lade offen steht, nimmt der Raum den
Ton schon an — die Entscheidung ist zu sehen, nicht vorzustellen.

Die Herkunft ist eine Kette mit drei Gliedern: was zuletzt gewählt wurde
(`localStorage['atelier3-papier']`), sonst was das Gerät für die Tageszeit
hält, sonst Tag. Das Gerät zu fragen ist als *Anfang* richtig — es weiß
etwas über den Raum, in dem jemand sitzt. Es als letztes Wort zu nehmen war
falsch: Wer beim dunklen Papier bleiben will, obwohl das Gerät hell steht,
soll dafür nicht das Betriebssystem umstellen müssen.

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

## Ein Satz an der Tür

Beim Aufschlagen eines frischen Blattes steht für einen Moment ein Satz da.
**Nur dort** – nicht beim Fortsetzen, nicht während des Malens, nicht am Ende.
Er verschwindet von selbst; es gibt nichts zu bestätigen.

Warum nur an der Tür: Alles andere in dieser App ist **Material**. Papier,
Pigment, Relief, Klang reden nicht mit einem, sie sind einfach da, und
deshalb verschwinden sie nach zwei Minuten. Ein Satz ist kein Material – er
wendet sich an jemanden, und im selben Moment ist eine zweite Person im
Raum. Dazu kommt: Reiben und Lesen sind zwei verschiedene Arten von
Aufmerksamkeit. Der Mechanismus dieser App bindet die Aufmerksamkeit an eine
wortlose, körperliche Aufgabe; Sprache schaltet ein anderes System an. Ein
Satz legt sich nicht neben den Fluss, er wechselt den Modus.

Vor dem ersten Strich stört das nicht – da kommt man an. Mitten im Malen
schon, und zwar auch dann, wenn man ihn gar nicht liest: **Wer weiß, dass
jederzeit etwas erscheinen könnte, wartet mit einem Teil darauf.** Das ist
Wachsamkeit, und Wachsamkeit ist der Zustand, aus dem die Viertelstunde
herausführen soll. Was immer da ist, verschwindet; was jederzeit auftauchen
kann, wird beobachtet.

**Zur Sprache.** In keinem der fünfundzwanzig Sätze kommt „du“ vor. Sobald
einer anspricht, gibt es jemanden, der spricht – und wer „du darfst“ sagt,
ist eine Instanz, die Erlaubnis erteilt. In einer App, deren ganzer Sinn
ist, dass niemand zusieht, richtete das genau die Instanz ein, die sie
leugnet. Aus demselben Grund kein Imperativ: „Lass es so stehen“ verlangt
etwas, „Es muss nicht gleichmäßig werden“ nicht.

Die stärksten Sätze sprechen über das Material und dabei nebenbei über etwas
anderes. Neue gehören in das Feld `THOUGHTS` in `app.js` und sonst nirgends –
keine Kennungen, keine Fassungen, keine Freigaben, keine zweite Sprache. Es
sind fünfundzwanzig Zeichenketten.

Ein Satz wiederholt sich nicht, solange er unter den letzten neun war.

**Bewusst nicht gebaut:** Gedanken *während* des Malens. Nicht verworfen,
sondern zurückgestellt, bis das an der Tür ein paar Wochen erlebt ist. Der
Testlauf hält fest, dass beim Fortsetzen eines Blattes geschwiegen wird.

## Blätter weglegen und wieder aufnehmen

Es gibt genau **ein laufendes Blatt**. Daneben liegt der **Stapel**.

- **„Neues Blatt“** legt das laufende auf den Stapel und holt ein frisches.
- **„Aufnehmen“** im Stapel macht ein früheres Blatt wieder zum laufenden –
  das bisherige wandert dafür auf den Stapel. Zwei Blätter tauschen die
  Plätze, so wie auf dem Tisch. Kein Speichern, kein Laden, kein Dialog.
- **„Verwerfen“** ist die einzige Stelle in dieser App, an der wirklich
  etwas verloren geht, und deshalb die einzige mit einer Rückfrage – ohne
  Dialog: Der Knopf selbst fragt, wer danebentippt oder wartet, hat nichts
  getan.

Beim Aufnehmen ist die Reihenfolge Absicht: erst das laufende Blatt in
Sicherheit bringen, dann das andere holen, und erst wenn das geglückt ist,
den alten Eintrag entfernen. Bricht etwas dazwischen ab, liegt schlimmsten-
falls ein Blatt doppelt – aber keines fehlt.

Wiederhergestellt wird über **einen** Weg, `adoptSheet()`, den sich Start und
Aufnehmen teilen.

**Speicher.** Das laufende Blatt wird 700 ms nach jedem Strich in IndexedDB
gesichert, als zusammengesetztes Bild plus Seed, Papierzustand und Welt.
Dazu eine **Langstreckensicherung**: Wer eine Viertelstunde am Stück kreist,
ohne abzusetzen, hätte sonst bis dahin nichts auf der Platte – deshalb
zusätzlich alle 25 Sekunden, ausdrücklich nur zwischen zwei Bildern. Beim Fortsetzen wird die Dichte
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

Dazu gehört `npm run test:nebeneinander`: Beide Apps liegen auf GitHub Pages
unter einem Origin, und der Worker des Mandala Ateliers hat sie beide in
seinem Geltungsbereich. Der Lauf prüft, dass Blatt am Ende von seinem
eigenen Worker bedient wird, dass keine `/atelier3/`-Datei im fremden Vorrat
landet und dass ein fremder Vorrat das Aufräumen übersteht.

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

1. **Die Cache-Version vergessen.** Zweimal hintereinander passiert, und die
   Folge ist bösartig: Das iPad bleibt **für immer** auf der alten Fassung
   stehen. Der Worker selbst hat sich ja nicht geändert, also installiert der
   Browser nichts nach, also wird der Vorrat nie erneuert – während auf dem
   Server längst die neue Fassung liegt und alles korrekt aussieht. Auf dem
   Schreibtisch sieht man davon nichts, weil dort über `file://` gar kein
   Worker läuft. Der `fetch`-Handler frischt den Vorrat deshalb jetzt im
   Hintergrund auf; die Version trotzdem bei jedem Release erhöhen, damit die
   neue Fassung sofort ankommt und nicht erst beim übernächsten Start.

2. **`display: flex` schlägt `hidden`.** Fach und Stapel bekommen im CSS ein
   `display: flex`; das überstimmt das `display: none`, das der Browser dem
   `hidden`-Attribut mitgibt. Der Stapel lag dadurch unsichtbar über dem
   ganzen Blatt und fing jede Berührung ab — die App war vollständig tot,
   und in den Canvas-Vorschauen war davon nichts zu sehen, weil `toDataURL`
   die Überdeckung nicht kennt. Deshalb steht ganz oben in `style.css`
   `[hidden] { display: none !important; }`. **Nicht entfernen.**

3. **Die Prägung mit Byte-Werten rechnen.** Siehe oben — Faktor 255.

4. **Zwei Finger nach Reihenfolge aus der Liste greifen.** Die Zwei-Finger-Geste
   nimmt ausdrücklich den *reibenden* und den *neu hinzugekommenen* Zeiger.
   Nahm sie stattdessen die ersten beiden aus der Liste der aufliegenden
   Kontakte, hing sie an einem Zeiger, dessen Loslassen der Browser
   verschluckt hatte – die Geste zog dann an einem Punkt, an dem längst kein
   Finger mehr war.

5. **`setPointerCapture` ohne Absicherung.** Es wirft gelegentlich, und eine
   Ausnahme an dieser Stelle heißt: Der Strich beginnt gar nicht erst. Immer
   in `try` einpacken.

6. **„Weglegen“ an zwei Stellen für Gegensätzliches.** Im Fach legt „Neues
   Blatt“ das laufende Blatt weg – auf den Stapel. Im Stapel hieß der Knopf
   zum endgültigen Löschen ebenfalls „Weglegen“. Heißt jetzt „Verwerfen“ und
   fragt einmal nach; es ist die einzige Stelle in dieser App, an der etwas
   wirklich verloren geht.

7. **Blockiges Papier.** Ein bloßes `hash2(x >> 4, y >> 4)` für die
   Wolkigkeit ergibt ein sichtbares Schachbrett. Papier hat keine Kacheln,
   also zwischen den Gitterpunkten weich überblenden.

8. **Die Höhen zu weit auseinander.** Beim ersten Versuch lag die Fläche bei
   0,11 gegen Linien bei 1,0. Ergebnis: Man bekam ausschließlich Linien, die
   Flächen nahmen praktisch nie Farbe an. Die Stufen und die Gamma-Werte
   müssen zusammen gedacht werden.

9. **Die Größe des Canvas ändern.** `SIZE` ist fest. Würde sie mit `dpr` oder
   der Fenstergröße wandern, wäre bei jeder Drehung des iPads die Arbeit weg.

10. **Den Auftrag an der Zeit aufhängen.** `dwell = dt/len` sah plausibel aus
    und war die Ursache für zwei Beschwerden auf einmal: Flächen blieben
    blass, Zögern brannte Flecken. Beim Frottieren zählt der Weg. Wer hier
    wieder etwas mit `dt` einführt, holt sich beides zurück — und die
    zweite Hälfte des Fehlers ist leiser als die erste: Selbst mit
    weglängen-basiertem Auftrag bleibt ein Rest Zeitverhalten übrig, wenn
    man nicht auf die *wirksame* Kontaktbreite normiert und die Sättigung
    stückelungsfrei rechnet (siehe oben, gemessen 30 % Unterschied
    zwischen kriechend und zügig, bevor beides drin war).

11. **Die Systemeinstellung für das letzte Wort halten.** Tag/Nacht kam
    ausschließlich aus `prefers-color-scheme`. Wer das dunkle Papier
    schöner findet, aber sein iPad hell stehen hat, konnte es nicht
    bekommen, ohne das ganze Gerät umzustellen. Das Gerät ist ein guter
    Anfangswert, nie mehr.

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
