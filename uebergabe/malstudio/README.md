# Vier fertige Änderungen am Malstudio, die noch nirgends liegen

**Für die Familie ist hier nichts zu tun.** Dieser Ordner ist eine Notiz an
die nächste Claude-Sitzung.

## Warum das hier liegt

Das Malstudio hat ein eigenes Repo: `pahlborn/malstudio`. Die Sitzung, in der
diese vier Änderungen entstanden sind, durfte dort nicht schreiben – sie war
auf `pahlborn/mandala-atelier` festgelegt worden, als sie startete. Der
Container einer Sitzung wird danach weggeräumt. Ohne diese vier Dateien wäre
die Arbeit verloren gewesen.

Sie liegen also in dem Repo, in das geschrieben werden durfte, und warten auf
eine Sitzung, die auch `pahlborn/malstudio` als Quelle mitbekommen hat.

## Was drin steht

| | |
|---|---|
| `0001` | Wikipedia und Karten-App sind ab Werk zu. Eltern geben sie im Zahnrad frei, hinter der Rechenaufgabe. |
| `0002` | Ein Beispielfoto für den Fundort, deutlich als Beispiel gekennzeichnet. |
| `0003` | Fünf Stellen, an denen die Oberfläche ins Deutsche zurückfiel – darunter der Vollbild-Knopf. |
| `0004` | Sechs Fundstücke für die Schatzsuche, eines je Bucht, mit Übersetzung ins Englische und Italienische. |

Danach steht das Malstudio auf **v7-52** (`APP_VERSION` in `index.html`,
`CACHE` in `sw.js`).

## Wie sie angewendet werden

Die Patches setzen auf `35fe57b` auf – dem Stand, der zur Zeit dieser Notiz
auf `main` lag. Geprüft: sie laufen sauber durch und ergeben genau die
Dateien, die in der Sitzung getestet wurden.

    git checkout -b claude/fundstuecke main
    git am uebergabe/malstudio/0*.patch

Liegt auf `main` inzwischen etwas Neueres, ist `git am -3` der Weg; die vier
Änderungen fassen `index.html` an vielen Stellen an, aber an kleinen.

**Wenn sie angewendet und gepusht sind, gehört dieser Ordner gelöscht.**
Zwei Kopien derselben Arbeit sind schlimmer als keine.

## Ein offener Punkt

`0002` erwartet eine Datei `foto-fundort-beispiel.jpg` im Hauptverzeichnis des
Malstudios – das Foto vom echten Fundort. Es liegt nicht in den Patches: Ein
Bild aus einem Gespräch lässt sich nicht in eine Datei schreiben. Die Datei
**darf fehlen**; dann bleibt die Bildspalte leer, so wie vorher auch. Deshalb
steht sie auch nicht im Pflichtvorrat des Service Workers – `addAll()` bricht
bei einer einzigen fehlenden Datei ab und nimmt den ganzen Offline-Betrieb
mit.
