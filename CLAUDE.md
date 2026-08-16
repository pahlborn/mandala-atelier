# Absprachen für die Arbeit an diesem Repository

Kurze Notiz an mich selbst für die nächste Sitzung. Das Ausführliche steht in
[`README.md`](README.md), [`atelier3/README.md`](atelier3/README.md) und unter
[`docs/`](docs/) — hier steht nur, was sonst jedes Mal neu erfragt werden müsste.

## Beim Antworten

**Bei großflächigen Änderungen den Link zur Hauptseite mitgeben:**

    https://pahlborn.github.io/mandala-atelier/beide.html

Großflächig heißt: neue Motive oder Grammatiken, neue Farbwelten, neue Seiten,
alles mit Wechsel der Cache-Version — kurz, alles, was man ansehen möchte. Bei
Zwischenfragen und Erklärungen nicht.

**Der Link steht in der ersten Zeile der Antwort, nicht irgendwo im Text.**
Wer etwas ansehen will, soll nicht danach suchen müssen. Wurde etwas Neues
gebaut, kommt der unmittelbare Link dazu — und zwar auch in die erste Zeile.

Getestet wird auf einem **iPad**, und geschrieben wird auf einem iPad. Also:
keine Anweisungen, die eine Kommandozeile voraussetzen; was zu tun ist, muss
sich mit dem Finger erledigen lassen.

## Beim Bauen

- **Cache-Version bei jedem Release erhöhen** — `sw.js` (`mandala-atelier-v1-…`)
  und `atelier3/sw.js` (`atelier3-v1-…`), jede für sich. Sie räumt auf; sich
  auf sie **verlassen** darf man aber nicht:
- **Der Service Worker erneuert sich nicht von selbst.** Nachgemessen mit
  echtem Browser: Ein Gerät, auf dem schon ein Worker läuft, fragt `sw.js`
  über fünf Öffnungen **null Mal** ab. Was eine neue Fassung trägt, ist allein
  das Auffrischen von `app.js` im Worker. Zwei Folgen:
  1. Verbesserungen, die *im* Worker stehen, erreichen ein eingerichtetes
     Gerät womöglich nie. Alles, worauf es ankommt, gehört in `app.js`.
  2. GitHub Pages liefert mit `Cache-Control: max-age=600`. Zehn Minuten lang
     bekommt auch der Worker die alte Datei aus dem HTTP-Vorrat des Browsers
     zurück — deshalb `fetch(…, { cache: 'reload' })` und
     `register(…, { updateViaCache: 'none' })`.
  3. Auf dem iPad muss die App **wirklich beendet** werden (App-Umschalter,
     hochwischen). Nur Hervorholen bedient sich aus dem Arbeitsspeicher und
     zeigt die alte Fassung selbst dann, wenn die neue längst im Vorrat liegt.
     Danach: **zweimal** öffnen — einmal holt, einmal zeigt.
- **Keine religiösen Symbole ohne ausdrückliche Rücksprache in der Familie.**
  Übernommen wird die Ordnung eines Vorbilds, nicht seine Bedeutung. Siehe
  [`docs/architektur.md`](docs/architektur.md) §5 — die Rücksprache steht aus.
- **Alles offline.** Zur Laufzeit wird nichts von außen geholt; Schriften
  stecken als Daten-URI in `fonts.css`. Der Testlauf prüft das.
- **Keine Gamification** — keine Sterne, keine Pokale, keine Streaks, keine
  Prozentanzeige. Wer hier malt, will abschalten.
- **Deutsche Oberfläche**, ruhiger Ton, gedeckte Farben.
- **Farbwelten und Motive dürfen zwischen den beiden Apps nicht auseinander-
  laufen.** Was das Atelier bekommt, bekommt Blatt auch — in Blatts Grammatik
  übersetzt, nicht kopiert.
- **Gesicherte Blätter müssen reproduzierbar bleiben.** Ein Blatt speichert nur
  Seed, Welt, Charakter und Grammatik; das Relief wird neu gerechnet. Wer den
  Generator ändert, schiebt sonst einem bemalten Blatt einen anderen Grundriss
  unter. Neue Wahlmöglichkeiten dürfen den Zufallsstrom nicht verschieben, und
  was ein altes Blatt nicht bei sich trägt, muss einen festen Vorgabewert haben.

## Fassungen und das Regal

Jede Fassung hat eine **Nummer**, und es ist dieselbe wie im Cache-Namen:
`atelier3-v1-13` ist **Blatt 3.13**, `mandala-atelier-v1-19` ist
**Atelier 2.19**. Kein zweiter Zähler — zwei liefen garantiert auseinander.
Sie steht sichtbar in der App (Blatt: im Fach; Atelier: im Fuß der Galerie),
und `npm run test:nebeneinander` prüft, dass beide Stellen übereinstimmen.

**Beim Veröffentlichen, in dieser Reihenfolge:**

1. Cache-Version **und** `FASSUNG` erhöhen — beide, in beiden Dateien.
2. `npm run einfrieren` — stellt die Fassung nach `v/<nummer>/`.
3. `npm run fassungen` — schreibt `docs/fassungen.html` neu.
4. Testläufe, dann committen und pushen.

Eingefrorene Fassungen bleiben **für immer** erreichbar. Damit ist „zurück auf
3.7" ein Link statt eines Auftrags. Zwei Dinge daran sind nicht verhandelbar,
sonst richtet das Regal Schaden an:

- **Kein Service Worker.** Sein `activate` löscht alles, was mit `atelier3-`
  bzw. `mandala-atelier-` anfängt — also den Offline-Vorrat der laufenden App.
- **Eigener Speicher.** Sonst überschriebe eine alte Fassung das laufende
  Blatt und schöbe ihm einen fremden Grundriss unter.

`tools/einfrieren.js` erledigt beides; `npm run test:regal` prüft es im echten
Browser.

**Eine Änderung je Fassung, mit Messwert.** Das ist die Lehre aus `v1-4`: Dort
wurden vier Dinge auf einmal geändert, nur eines war durch einen Befund
gedeckt, und es hat zwölf Fassungen gedauert, bis auffiel, was verlorenging.
Was sich nicht messen lässt, gehört in einen eigenen Commit.

## Testläufe

    npm test                  Mandala Atelier
    npm run test:atelier3     Blatt
    npm run test:nebeneinander  beide Apps an einem Origin
    npm run test:druck        die Prüfseite docs/druck.html (Sekunden)
    npm run test:regal        das Fassungsregal unter v/ (Sekunden)

Sie laufen gegen einen echten Browser. Die ersten drei dauern je ein paar
Minuten und gehören vor jeden Push; die letzten beiden sind in Sekunden durch
und nur nötig, wenn `docs/druck.html` bzw. das Regal angefasst wurde.

## Git

Entwickelt wird auf `claude/mandala-atelier-architektur-o8hy4b`, gepusht wird
**auch direkt nach `main`** — das ist ausdrücklich so gewollt, weil GitHub Pages
nur `main` ausliefert und die Änderung sonst nicht auf dem iPad ankommt.
