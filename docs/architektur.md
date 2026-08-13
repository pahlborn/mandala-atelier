# Anlagen — Stufe 4.0

> **Stand: Prototyp.** Eine Motivwelt „Anlagen“ und eine Vorlage darin
> („Anlage“) stehen im Mandala Atelier und laufen. Dieses Papier hält fest,
> woher die Idee kommt, was daran neu ist, was bewusst *nicht* übernommen
> wurde und was jetzt nur noch Menschen beantworten können, die davor sitzen.

---

## 1. Warum die Zählung 4.0 heißt und trotzdem keine vierte App entsteht

Der Anlass war die Sorge, die App könnte zu groß werden — technisch, nicht
gedanklich. Deshalb wurde gemessen, bevor entschieden wurde.

    5 Canvas-Ebenen, 900 logisch bei dpr 2   61,8 MB Grafikspeicher
    renderMotif()  Median 0,2 ms             Maximum 7,4 ms

Die Kosten der App hängen nicht am Katalog, sondern an der **einen geöffneten
Vorlage**. Motive sind Datensätze mit `build()`; gezeichnet wird nur das
gewählte. Zwanzig weitere Vorlagen kosten zur Laufzeit nichts. Eine vierte App
hätte also ein Problem gelöst, das es nicht gibt — und dafür die Wette
verdoppelt, die seit `atelier-3.md` §14 unentschieden ist.

Was tatsächlich teuer wäre, ist die **Auflösung**. 900 → 1400 logisch hieße
61,8 MB → rund 157 MB allein für die Ebenen, dazu die Schnappschüsse für
Rückgängig. Das ist die Grenze der App, und sie liegt woanders, als man
vermutet.

**4.0 ist deshalb die Stufe, nicht die App.** Die Anlagen wachsen im Mandala
Atelier.

---

## 2. Was an einer Anlage anders ist

Die bisherigen 26 Vorlagen sind **Muster**: Ringe, Blätter, Rauten, Speichen um
eine Mitte. Man ordnet eine Fläche.

Eine Anlage ist ein **Grundriss**. Von außen nach innen:

    Schutzbereich  →  Vorhöfe  →  vier Tore  →  Palastmauer
                   →  Innenhof  →  Kammer  →  Mitte

Das Vorbild ist die tibetische Mandala-Architektur, die genau das ist: ein
Bauwerk, zweidimensional aufgerissen. Übernommen wurde die **Bauordnung**,
nicht das Bildprogramm (siehe §5).

---

## 3. Der Widerspruch, an dem sich alles entschied

Ein Raum lebt davon, dass Orte **verschieden** sind. Der Motor dieser App ist,
dass eine Handbewegung achtundvierzigfach wird — also davon, dass Orte
**gleich** sind. Wer das Osttor gestaltet und dabei die drei anderen Tore
mitgestaltet, hat nichts entdeckt; er hat ein Ornament gemacht, das aussieht
wie ein Grundriss.

Die Auflösung ist der eigentliche Gewinn dieser Stufe:

> **Die Symmetrie hängt nicht mehr an der Einstellung, sondern am Ort.**

| Bereich | Achsen | was die Maschine tut |
|---|---|---|
| Schutzbereich (außen) | 24 | fast alles |
| Palast | 4 | die vier Himmelsrichtungen |
| Mitte | 1 | nichts mehr, auch keine Spiegelung |

Je weiter nach innen, desto weniger wird geschenkt und desto mehr zählt der
einzelne Strich. Damit ist die Architektur keine Dekoration, sondern eine
**Mechanik** — und nebenbei eine erste Antwort auf die offene Frage aus
`atelier-3.md`: *Geschenk oder Diebstahl?* Hier ist es beides, gestaffelt, im
selben Bild. Außen Atelier 2, innen Blatt.

![Anlage, teilweise gefärbt](anlage-beispiel.png)

Das Bild oben ist mit **neun Tipps** entstanden und hat **69 Felder**: die
beiden Ringbänder je 24 auf einen Tipp, jedes Feld im Palast vier, die Mitte
genau eines. Man sieht der Fläche an, wo man ist.

Ein Zug gehört dem Bereich, in dem er **aufsetzt**, und behält dessen
Achsenzahl bis zum Loslassen. Sonst änderte sich die Symmetrie mitten im
Strich. Der Testlauf prüft genau diesen Fall.

---

## 4. Die Mitte

Im traditionellen Mandala hat die Mitte eine festgelegte Bedeutung. Hier nicht.

Die Mitte der Anlage ist **das größte einzelne Feld** der ganzen Vorlage und
zugleich der einzige Ort ohne Symmetrie. Sie ist leer. Wer will, gestaltet sie;
wer will, lässt sie, wie sie ist.

Und sie ist **kein Ziel**. Es gibt kein Erreichen des Zentrums, keinen
Abschluss, keine Meldung, wenn man dort ankommt — dieselbe Linie wie im ganzen
übrigen Atelier: keine Gamification. Dass eine Architektur im Kopf des
Betrachters von selbst einen Weg nahelegt, ist gut und gewollt. Die App
bestätigt ihn nur nie.

---

## 5. Was übernommen wurde und was nicht

**Übernommen:** konzentrische Bereiche, starke Symmetrie mit Staffelung, die
vier Himmelsrichtungen, vier Tore, quadratische Architektur im Kreis, Innenhöfe,
Räume in Räumen, Hierarchie, die Bewegung von außen nach innen.

**Nicht übernommen:** buddhistische Gottheiten, Figurenprogramme, Mantras,
tantrische Symbole, festgelegte Bedeutungen. Die Oberfläche nennt die Bereiche
nüchtern und deutsch: Schutzbereich, Vorhof, Tor, Palast, Innenhof, Kammer,
Mitte.

Ausdrücklich **nicht** übernommen wurde auch die Bildsprache der äußeren
Schutzringe. Im Original sind das Flammen- und Leichenacker-Kränze; ihr Aussehen
zu kopieren, führte geradewegs ins Okkult-Esoterische, das diese App nicht will.
Der Schutzbereich ist hier gemauertes Ringwerk, mehr nicht.

> **Offen und vor dem Ausliefern zu klären:** Das README des Ateliers verlangt
> Rücksprache mit der Familie, bevor religiös aufgeladene Zeichen aufgenommen
> werden. Ein Grundriss tibetischer Herkunft ist näher an dieser Grenze als
> alles im bisherigen Katalog, auch ohne ein einziges religiöses Zeichen. Diese
> Rücksprache steht aus.

---

## 6. Zwei Regeln, die beim Bauen sofort zuschnappen

1. **Kein Ringband und kein Mauerband ohne Querwände.** Ein umlaufendes Band
   ist ein einziges, riesiges Feld; ein Tipp färbt den halben Rand. Jedes Band
   bekommt Wände, versetzt gegen das Nachbarband — daraus entsteht nebenbei der
   Mauerverband.

2. **Ein Tor ist kein Loch.** Der Durchgang ist eine Kammer *in* der Mauer,
   geschlossen von beiden Mauerfluchten und den beiden Wangen. Ein wirklich
   offener Durchgang verbände Vorhof und Innenhof zu einem einzigen Raum, und
   ein Tipp färbte den halben Palast. Die Schwelle ist also keine Zierde,
   sondern die Bedingung dafür, dass ein Tor überhaupt eines sein kann — und
   sie kommt hier von der inneren Mauerflucht selbst, die als geschlossenes
   Quadrat umläuft.

   Das Torhaus darüber sitzt auf der äußeren Flucht und nimmt nach außen in
   drei Stufen ab. Eine einzelne Spitze sah, nach außen gedreht, aus wie ein
   Pfeil; eine Stufe, die breiter ist als die darunter, wie ein Stecker. Erst
   die abnehmende Staffelung liest sich als Bauwerk.

Dazu zwei kleinere Festlegungen:

- Eine Anlage bringt ihren **eigenen Rahmen** mit (`frame: false`). Der
  Speichenrahmen `drawWedgeFrame()` liefe ihr quer durch den Palast. Er bleibt
  für alle anderen Motive zwingend.
- Das **Hilfsraster steht still**, sobald eine Anlage geladen ist. Vier Tore in
  vier Richtungen geben dem Blatt zum ersten Mal ein Oben; ein Raster, das sich
  darüber wegdreht, widerspräche dem. Stattdessen zeigt es die Bereiche und in
  jedem so viele Achsen, wie dort wirklich gelten.

---

## 7. Was der Testlauf jetzt zusätzlich prüft

    Gestaffelte Symmetrie (Anlage)
      Schutzbereich    24 von 24 Kopien   0 dazwischen
      Palast            4 von 4 Kopien    0 dazwischen
      Mitte             1 von 1 Kopien    0 dazwischen
      über die Grenze   4 von 4 Kopien    der Zug bleibt beim Aufsetzpunkt
      Schalter aus     12 von 12 Kopien   wie jede andere Vorlage

Die Gegenprobe („0 dazwischen“) ist der eigentliche Test: Es genügt nicht, dass
die erwarteten Kopien da sind — zwischen ihnen darf auch nichts stehen.

Zwei Fehlalarme des alten Testlaufs wurden dabei behoben, beide im Test, nicht
im Motiv:

- Ein Feld, das die **Mitte enthält**, deckt zwangsläufig alle 360° ab. Der
  Winkeltest ist dort blind und wird ausgesetzt.
- Ein Prüfzug **dicht am Mittelpunkt** liegt nach jeder Drehung auf sich selbst.
  Der Zug für die Mitte liegt deshalb weiter außen, aber noch im Bereich.

---

## 8. Was dieses Papier nicht beantworten kann

Ob die Anlage sich beim Ausmalen wirklich wie ein **Raum** anfühlt oder nur wie
ein sehr ordentliches Muster. Das entscheidet niemand am Schreibtisch.

Konkret zu beobachten wäre:

- Fällt die Staffelung überhaupt auf, ohne dass jemand sie erklärt? Der
  Übergang von 24 auf 4 Achsen ist ein starker Sprung — vielleicht zu stark,
  vielleicht genau richtig.
- Geht man nach innen? Bleibt man außen? Kommt man zurück?
- Bleibt die Mitte leer? Und stört das, oder ist es die Erleichterung?
- Sind die Felder groß genug für einen Finger bei 100 %, oder wird die Anlage
  eine Zoom-Vorlage?

---

## 9. Was offen ist

- **Aussehen der Tore.** Sie sind derzeit sehr technisch geraten; nach außen
  gesehen liest sich das Dach eher als Pfeil denn als Tor.
- **Nur eine Vorlage.** Eine Welt mit einem einzigen Motiv ist keine Welt.
  Naheliegend wären eine schlichtere Anlage mit nur zwei Bereichen und eine mit
  einem stärker gegliederten Innenhof.
- **Detail beim Näherkommen.** Reizvoll wäre, dass der Zoom nicht nur
  vergrößert, sondern aufdeckt. Das kostet Auflösung (§1) und ist deshalb Kür,
  nicht Voraussetzung. Architektur will große, unterscheidbare Flächen, kein
  Mikrodetail.
- **Die Rücksprache aus §5.**
- **Test am echten iPad**, wie beim ganzen übrigen Atelier.
