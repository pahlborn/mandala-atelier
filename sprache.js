'use strict';

/* ============================================================================
   Sprache – Deutsch im deutschsprachigen Raum, sonst Englisch.

   Der deutsche Text ist der Schlüssel:

     T('Leeres Blatt')  →  'Leeres Blatt'  auf Deutsch
                        →  'Blank sheet'   auf Englisch

   Warum keine Kennungen wie `blatt.leer`: Weil dann im Quelltext nirgends
   mehr stünde, was auf dem Knopf steht. Man müsste bei jeder Zeile
   nachschlagen. So bleibt das Deutsche dort, wo es hingehört, und diese Datei
   ist ein Wörterbuch – kein zweiter Satz Namen für dieselben Dinge.

   Fehlt ein Eintrag, erscheint der deutsche Text. Sichtbar unfertig ist
   besser als leer oder abgestürzt.

   ---------------------------------------------------------------------------
   Der eine Fall, in dem ein Wort nicht genügt

   „Blatt" heißt in dieser App zweierlei: die Grundform neben Ring, Speiche,
   Raute und Band – das ist ein `leaf` – und der Bogen, auf dem gezeichnet
   wird – das ist ein `sheet`. Ein Wörterbuch mit dem deutschen Wort als
   Schlüssel kann das nicht auseinanderhalten.

   Deshalb gibt es einen zweiten Schlüssel, den Sinn:

     im Wörterbuch     'Blatt @form': 'Leaf'
     im HTML           <button data-sinn="form">Blatt</button>
     im Quelltext      T('Blatt', 'form')

   Ohne Sinn gilt der schlichte Eintrag. `tools/test-sprache.js` sucht nach
   weiteren solchen Fällen und meldet sie, bevor sie jemandem auffallen.

   ---------------------------------------------------------------------------
   Welche Sprache gilt, entscheidet sich in dieser Reihenfolge:

     1. ?sprache=de  oder  ?sprache=en   in der Adresse
     2. was zuletzt von Hand gewählt wurde
     3. die Sprache des Geräts – „de…" heißt Deutsch, alles andere Englisch
   ========================================================================== */

var Sprache = (function () {

  var EN = {

    /* --- Kopfzeile und Grundbedienung ------------------------------------ */
    'Mandala Atelier':            'Mandala Atelier',
    'Zeichne ein Segment – der Rest entsteht von selbst.':
      'Draw one segment — the rest comes about by itself.',
    'Motive':                     'Motifs',
    'Werkzeuge':                  'Tools',
    'Galerie':                    'Gallery',
    'Vollbild':                   'Full screen',
    'Vollbild beenden':           'Leave full screen',
    'Hell':                       'Light',
    'Dunkel':                     'Dark',
    'Sprache':                    'Language',

    /* --- Werkzeuge -------------------------------------------------------- */
    'Werkzeug':                   'Tool',
    'Stift':                      'Pen',
    'Füllen':                     'Fill',
    'Form':                       'Shape',
    'Radierer':                   'Eraser',
    'Strichstärke':               'Stroke width',

    /* --- Grundformen ------------------------------------------------------
       Hier steht der Sinn dabei: `Blatt` ist an dieser Stelle ein Blatt am
       Zweig, nicht ein Blatt Papier. */
    'Ring':                       'Ring',
    'Speiche':                    'Spoke',
    'Blatt @form':                'Leaf',
    'Raute':                      'Diamond',
    'Band':                       'Band',
    'gesetzt.':                   'placed.',

    /* --- Farbe ------------------------------------------------------------ */
    'Farbwelt':                   'Colour world',
    'Pigment':                    'Pigment',
    'Gewähltes Pigment mischen':  'Mix the chosen pigment',
    'Farblegende':                'Colour key',
    'Farblegende – Ergebnis':     'Colour key — result',
    'Farblegende – Anzahl':       'Colour key — count',
    'Eigen ':                     'Own ',

    /* --- Symmetrie -------------------------------------------------------- */
    'Symmetrie':                  'Symmetry',
    'Spiegelung':                 'Mirroring',
    'Hilfsraster':                'Guide grid',
    'Füllen wirkt auf alle Achsen': 'Fill acts on all axes',
    'Symmetrie folgt den Bereichen': 'Symmetry follows the precincts',
    'Achsenzahl':                 'Number of axes',

    /* --- Das Blatt selbst -------------------------------------------------
       Ohne Sinn: der Bogen, auf dem gezeichnet wird. */
    'Blatt':                      'Sheet',
    'Leeres Blatt':               'Blank sheet',
    'Freies Blatt':               'Free sheet',
    'Nur Symmetrie, keine Vorlage': 'Symmetry only, no template',
    'Zurücksetzen':               'Start over',
    'In die Galerie legen':       'Lay it in the gallery',
    'Als Bild speichern':         'Save as a picture',
    'Druckbogen (A4)':            'Print sheet (A4)',
    'Wähle ein Motiv oder beginne auf dem leeren Blatt.':
      'Choose a motif, or begin on the blank sheet.',

    /* --- Ganze Absätze ----------------------------------------------------
       Die Träger stehen im HTML mit `data-satz`. Schlüssel ist der innere
       HTML-Text, auf einzelne Leerzeichen zusammengezogen – deshalb steht
       hier auch das <b> mit drin. */
    '34 Vorlagen in 6 Welten. Ein Motiv setzt die Achsenzahl passend – du kannst sie danach jederzeit ändern.':
      '34 templates in 6 worlds. A motif sets the number of axes to suit it — you can change that afterwards at any time.',

    'Mit „Form“ entstehen die Grundformen exakt: Ring, Speiche, Blatt, Raute und Band – dieselben Bausteine, aus denen auch die Vorlagen gemacht sind. Ziehen setzt die Länge, seitlich ziehen die Breite.':
      'With “Shape” the basic forms come out exact: ring, spoke, leaf, diamond and band — the same building blocks the templates are made of. Dragging sets the length, dragging sideways the width.',

    'Noch nichts abgelegt. Leg ein fertiges Bild über „In die Galerie legen“ hierher.':
      'Nothing laid down yet. Put a finished picture here with “Lay it in the gallery”.',

    'Werke liegen nur auf diesem Gerät. Eine Sicherung ist zugleich der Weg auf ein zweites Gerät – sie enthält alle Personen, deren Werke und die eigene Farbwelt.':
      'Pieces stay on this device only. A backup is also the way onto a second device — it holds every person, their pieces and the colour world you mixed yourself.',

    '<b>Sicherung speichern</b> packt alles in eine Datei und öffnet das Teilen-Blatt. Dort <b>„In Dateien sichern“</b> wählen – etwa in iCloud Drive, dann liegt sie auch auf dem zweiten Gerät bereit. <b>Sicherung einlesen</b> holt sie von dort zurück; vorhandene Werke bleiben dabei stehen, es kommt nur dazu, was noch fehlt.':
      '<b>Save a backup</b> packs everything into one file and opens the share sheet. Choose <b>“Save to Files”</b> there — in iCloud Drive, say, and it is ready on the second device too. <b>Read a backup</b> fetches it back; pieces already here stay as they are, only what is missing is added.',

    /* --- Galerie ---------------------------------------------------------- */
    'Galerie von':                'Gallery of',
    'Galerie von ':               'Gallery of ',
    'Titel':                      'Title',
    'Aus der Galerie nehmen':     'Take out of the gallery',
    'Schließen':                  'Close',
    'Name':                       'Name',
    '＋ Neue Person':             '＋ New person',
    'Ohne Namen ':                'Unnamed ',
    'Sicherung speichern':        'Save a backup',
    'Sicherung einlesen':         'Read a backup',
    'Die Sicherung':              'The backup',
    'Das Bild':                   'The picture',

    /* --- Was die App sagt --------------------------------------------------
       Kurze Rückmeldungen. Sie stehen dort, wo sonst der Hinweis steht, und
       verschwinden von selbst. */
    'In die Galerie gelegt.':     'Laid in the gallery.',
    'In die Galerie gelegt – bleibt aber nur, solange die Seite offen ist.':
      'Laid in the gallery — but only while this page stays open.',
    'Das Werk ließ sich nicht ablegen – der Speicher des Geräts ist voll.':
      'The piece could not be laid down — the device is out of storage.',
    'Die Datei ließ sich nicht lesen.': 'The file could not be read.',
    'Das ist keine Sicherung des Mandala Ateliers.':
      'That is not a Mandala Atelier backup.',
    ' Werk eingelesen.':          ' piece read in.',
    ' Werke eingelesen.':         ' pieces read in.',
    'Alles aus der Sicherung war schon vorhanden.':
      'Everything in the backup was already here.',
    ' liegt bei den Downloads.':  ' is in your downloads.',
    'Der Browser hat das Druckfenster blockiert.':
      'The browser blocked the print window.',
    'Druckbogen erstellen.\n\n':  'Make a print sheet.\n\n',
    'OK: mit den gesetzten Farben\n': 'OK: with the colours as set\n',
    'Abbrechen: nur die Linien zum Ausmalen':
      'Cancel: the lines alone, to colour in',

    /* --- Der Hinweis unter dem Blatt --------------------------------------
       Er wird aus Teilen zusammengesetzt; deshalb stehen die Teile hier
       einzeln, jeweils mit ihrem führenden Trennzeichen. */
    'Leeres Blatt · zeichne ein Segment, der Rest entsteht von selbst':
      'Blank sheet · draw one segment, the rest comes about by itself',
    ' · die Symmetrie folgt dem Bereich, in dem die Hand aufsetzt':
      ' · the symmetry follows the precinct the hand starts in',
    ' · ein Tipp färbt alle gleichwertigen Felder':
      ' · one tap colours every field of equal value',
    ' · ein Tipp färbt nur das angetippte Feld':
      ' · one tap colours only the field tapped',
    'Ein Tipp färbt alle gleichwertigen Felder zugleich.':
      'One tap colours every field of equal value at once.',
    'Ein Tipp färbt nur das angetippte Feld.':
      'One tap colours only the field tapped.',
    'Bei Zähl- und Rechenmandalas wird immer einzeln gefüllt – sonst bekämen ':
      'Counting and sums mandalas always fill one field at a time — otherwise ',
    'Felder mit verschiedenen Ergebnissen dieselbe Farbe.':
      'fields with different results would get the same colour.',
    'Aus: überall dieselbe Achsenzahl, wie bei den anderen Vorlagen.':
      'Off: the same number of axes everywhere, as in the other templates.',
    '-fach':                      '-fold',
    'frei':                       'free',

    /* --- Zähl- und Rechenmandalas ----------------------------------------- */
    'Ergebnis ':                  'Result ',
    ' Punkt':                     ' dot',
    ' Punkte':                    ' dots',

    /* --- Was nur die Vorlesestimme hört ----------------------------------- */
    'Mandala – hier zeichnen und füllen': 'Mandala — draw and fill here',
    'Zeichenfläche':              'Drawing area',
    'Zeichenfläche vergrößern':   'Enlarge the drawing area',
    'Motivwelten':                'Motif worlds',
    'Motive schließen':           'Close motifs',
    'Werkzeuge schließen':        'Close tools',
    'Galerie schließen':          'Close the gallery',
    'Werkzeug wählen':            'Choose a tool',
    'Grundform':                  'Basic shape',
    'Farbwelt wählen':            'Choose a colour world',
    'Pigment wählen':             'Choose a pigment',
    'Person wählen':              'Choose a person',
    'Person umbenennen':          'Rename this person',
    'Werk ansehen':               'Look at this piece',
    'Rückgängig':                 'Undo',
    'Wiederherstellen':           'Redo',
    'Schritte':                   'Steps',
    'Vergrößern':                 'Zoom in',
    'Verkleinern':                'Zoom out',
    'Vergrößerung zurücksetzen':  'Reset the zoom',
    'Leiste einklappen':          'Fold the bar away',
    'Leiste ausklappen':          'Unfold the bar',
    'Sprache wählen':             'Choose a language',

    /* --- Tastenkürzel in den Kurzhinweisen -------------------------------- */
    'Stift (1)':                  'Pen (1)',
    'Füllen (2)':                 'Fill (2)',
    'Form (3)':                   'Shape (3)',
    'Radierer (4)':               'Eraser (4)',
    'Auf Anfang zurück (0)':      'Back to the start (0)',
    'Vergrößern (+)':             'Zoom in (+)',
    'Verkleinern (−)':            'Zoom out (−)',
    'Hell / Dunkel umschalten':   'Switch light / dark',
    'Rückgängig (Cmd/Strg+Z)':    'Undo (Cmd/Ctrl+Z)',
    'Wiederherstellen (Cmd/Strg+Umschalt+Z)': 'Redo (Cmd/Ctrl+Shift+Z)',

    /* --- Motivwelten ------------------------------------------------------ */
    'Geometrisch-klassisch':      'Geometric & Classical',
    'Natur':                      'Nature',
    'Zen & Achtsamkeit':          'Zen & Mindfulness',
    'Jahreszeiten':               'Seasons',
    'Anlagen':                    'Grounds',
    'Kids-Corner':                "Kids' Corner",

    /* --- Motive: Name und Beischrift --------------------------------------
       Die Beischrift zählt auf, was zu sehen ist – sie soll auf Englisch
       genauso nüchtern bleiben und nichts versprechen. */
    'Sternkranz':                 'Star Wreath',
    'Zwölf Spitzen, ruhiger Grundriss': 'Twelve points, a quiet plan',
    'Rautenkranz':                'Diamond Wreath',
    'Rauten in drei Größen':      'Diamonds in three sizes',
    'Sternmandala fein':          'Fine Star Mandala',
    'Sechzehn Achsen, viele kleine Felder': 'Sixteen axes, many small fields',
    'Achteckstern':               'Octagon Star',
    'Acht Achsen, klare Kanten':  'Eight axes, clean edges',
    'Gitterrose':                 'Lattice Rose',
    'Verschränkte Rauten, dichtes Netz': 'Interlocking diamonds, a dense net',

    'Blüte':                      'Blossom',
    'Acht große Blätter, viel Fläche': 'Eight large petals, plenty of surface',
    'Blätterkranz':               'Leaf Wreath',
    'Blätter mit Mittelrippe, versetzt': 'Leaves with a midrib, offset',
    'Muschelspirale':             'Shell Spiral',
    'Sechs Arme, weite Bögen':    'Six arms, wide arcs',
    'Farnkreis':                  'Fern Circle',
    'Wedel mit feinen Fiedern':   'Fronds with fine pinnae',
    'Samenkranz':                 'Seed Wreath',
    'Sechzehn Samen, feine Teilung': 'Sixteen seeds, fine division',

    'Wellenkreis':                'Wave Circle',
    'Fünf Wellenringe, gleichmäßiger Takt': 'Five wave rings, an even beat',
    'Tropfenkranz':               'Drop Wreath',
    'Tropfen in zwei Lagen, versetzt': 'Drops in two layers, offset',
    'Ruhefeld':                   'Field of Quiet',
    'Wenige große Flächen, viel Raum': 'Few large areas, much room',
    'Atemringe':                  'Breathing Rings',
    'Ruhiger Takt, gleichmäßige Weite': 'A quiet beat, even spacing',
    'Steingarten':                'Stone Garden',
    'Wenige Formen, geharkte Bahnen': 'Few forms, raked lanes',

    'Winter':                     'Winter',
    'Schneekristall mit Seitenästen': 'A snow crystal with side branches',
    'Frühling':                   'Spring',
    'Knospen in drei Lagen':      'Buds in three layers',
    'Sommer':                     'Summer',
    'Strahlenkranz um eine offene Mitte': 'A ring of rays round an open centre',
    'Herbst':                     'Autumn',
    'Geneigte Blätter, Eicheln als Punkte': 'Tilted leaves, acorns as dots',

    'Anlage':                     'Grounds',
    'Vier Tore, drei Bereiche':   'Four gates, three precincts',
    'Ringanlage':                 'Ring Grounds',
    'Vier Tore, vier Ringbänder': 'Four gates, four ring bands',
    'Gartenanlage':               'Garden Grounds',
    'Vier Wasserläufe, sechsunddreißig Beete':
      'Four watercourses, thirty-six beds',
    'Sternanlage':                'Star Grounds',
    'Acht Bastionen, eine Piazza': 'Eight bastions, one piazza',
    'Rasteranlage':               'Grid Grounds',
    'Neun mal neun Felder, kein Kranz': 'Nine by nine fields, no wreath',
    'Stufenanlage':               'Stepped Grounds',
    'Außen eckig, innen rund':    'Angular without, round within',
    'Torstadt':                   'Gate City',
    'Zwölf Tore, sechs Mauern':   'Twelve gates, six walls',
    'Kuppelanlage':               'Dome Grounds',
    'Ein Gewölbe von unten, 132 Kassetten': 'A vault from below, 132 coffers',

    'Erste Formen':               'First Shapes',
    'Kindergarten – sehr große Felder': 'Nursery — very large fields',
    'Mustertanz':                 'Pattern Dance',
    'Grundschule – Bänder im Wechsel': 'Primary school — bands in turn',
    'Formenreigen':               'Round of Shapes',
    'Kindergarten – runde und eckige Felder':
      'Nursery — round and angular fields',
    'Zähl bis 6':                 'Count to 6',
    'Punkte zählen, nach Anzahl färben': 'Count the dots, colour by number',
    'Zähl bis 10':                'Count to 10',
    'Punkte zählen bis zehn':     'Counting dots up to ten',
    'Rechenmandala ZR 10':        'Sums Mandala to 10',
    'Plus und Minus im Zahlenraum 10': 'Plus and minus up to 10',
    'Rechenmandala ZR 20':        'Sums Mandala to 20',
    'Plus und Minus im Zahlenraum 20': 'Plus and minus up to 20',

    /* Diese beiden stehen im Quelltext über zwei Zeilen, zusammengefügt
       mit `+`. Der Schlüssel ist deshalb der fertige Satz, nicht die
       Hälfte. */
    'Zähl die Punkte in einem Feld. Unten in der Leiste steht bei jeder Farbe eine Zahl – nimm die Farbe mit deiner Anzahl und tippe ins Feld.':
      'Count the dots in a field. In the bar below, every colour carries a number — take the colour with your count and tap the field.',
    'Rechne die Aufgabe in einem Feld aus. Unten in der Leiste steht bei jeder Farbe eine Zahl – nimm die Farbe mit deinem Ergebnis und tippe ins Feld.':
      'Work out the sum in a field. In the bar below, every colour carries a number — take the colour with your result and tap the field.',

    /* --- Bereiche der Anlagen ---------------------------------------------
       Sie stehen unter dem Blatt, wenn die Symmetrie den Bereichen folgt.
       Es sind Bauteile, keine Stimmungen: Wall bleibt `rampart`, nicht
       `wall` – gemeint ist der Erdwall, nicht die Mauer, die daneben
       steht. */
    'Mitte':                      'Centre',
    'Palast':                     'Palace',
    'Schutzbereich':              'Precinct',
    'Speichen':                   'Spokes',
    'Blätter':                    'Leaves',
    'Wellen':                     'Waves',
    'Perlen':                     'Beads',
    'Becken':                     'Basin',
    'Garten':                     'Garden',
    'Mauer':                      'Wall',
    'Piazza':                     'Piazza',
    'Innenstadt':                 'Inner city',
    'Wall':                       'Rampart',
    'Mittelfeld':                 'Middle field',
    'Raster':                     'Grid',
    'Kuppe':                      'Crown',
    'obere Terrasse':             'upper terrace',
    'mittlere Terrasse':          'middle terrace',
    'untere Terrasse':            'lower terrace',
    'Umgänge':                    'Ambulatories',
    'Stadt':                      'City',
    'Vorfeld':                    'Approach',
    'Auge':                       'Eye',
    'Augenring':                  'Eye ring',
    'Laterne':                    'Lantern',
    'Reihe 12':                   'Row 12',
    'Reihe 16':                   'Row 16',
    'Reihe 20':                   'Row 20',
    'Reihe 24':                   'Row 24',
    'Reihe 28':                   'Row 28',
    'Reihe 32':                   'Row 32',

    /* --- Pigmentwelten ----------------------------------------------------- */
    'Erdpigmente':                'Earth Pigments',
    'Nordlicht':                  'Northern Light',
    'Färbergarten':               "Dyer's Garden",
    'Rauchglas':                  'Smoked Glass',
    'Goldgrund':                  'Gold Ground',

    /* --- Pigmente ----------------------------------------------------------
       Wo es das Wort im Englischen wirklich gibt, steht es: Krapp ist
       `Madder`, Waid ist `Woad`, Cochenille ist `Cochineal`. Das sind
       Farbstoffnamen, keine Erfindungen.

       Eine Ausnahme: `Kalk` heißt wörtlich `Lime` und liest sich dann zuerst
       als Frucht. `Limewash` trifft die Farbe und lässt keinen Zweifel. */
    'Terrakotta':   'Terracotta',
    'Ocker':        'Ochre',
    'Petrol':       'Petrol',
    'Indigo':       'Indigo',
    'Moos':         'Moss',
    'Mohn':         'Poppy',
    'Nebelblau':    'Mist Blue',
    'Pflaume':      'Plum',
    'Anthrazit':    'Anthracite',
    'Elfenbein':    'Ivory',

    'Tanne':        'Fir',
    'Amethyst':     'Amethyst',
    'Tiefsee':      'Deep Sea',
    'Flechte':      'Lichen',
    'Beere':        'Berry',
    'Fjord':        'Fjord',
    'Heidekraut':   'Heather',
    'Stahl':        'Steel',
    'Polarnacht':   'Polar Night',
    'Raureif':      'Hoarfrost',

    'Krapp':        'Madder',
    'Safran':       'Saffron',
    'Waid':         'Woad',
    'Färberginster': "Dyer's Broom",
    'Cochenille':   'Cochineal',
    'Malve':        'Mallow',
    'Katechu':      'Catechu',
    'Rinde':        'Bark',
    'Ruß':          'Soot',
    'Leinen':       'Linen',

    'Taubenblau':   'Dove Blue',
    'Altrosa':      'Dusty Rose',
    'Farn':         'Fern',
    'Kastanie':     'Chestnut',
    'Schilf':       'Reed',
    'Zinn':         'Pewter',
    'Trüffel':      'Truffle',
    'Nebel':        'Mist',
    'Basalt':       'Basalt',
    'Kalk':         'Limewash',

    'Bronze':       'Bronze',
    'Lichtgold':    'Light Gold',
    'Nachtblau':    'Night Blue',
    'Kobalt':       'Cobalt',
    'Himmel':       'Sky',
    'Ochsenblut':   'Oxblood',
    'Purpur':       'Purple',
    'Grund':        'Ground',

    /* --- Die Beschreibung im Kopf der Seite --------------------------------
       Sie steht in <meta name="description">; Suchmaschinen und die
       Vorschau beim Teilen lesen sie. */
    'Mandalas gestalten und kolorieren – ein Symmetrie-Werkzeug für ruhige Stunden. Offline, ohne Konto, ohne Werbung.':
      'Design and colour mandalas — an instrument for symmetry, for quiet hours. Offline, no account, no advertising.'
  };


  /* ------------------------------------------------------------------------
     Welche Sprache gilt
     ---------------------------------------------------------------------- */

  var SCHLUESSEL = 'mandala-sprache';

  function ausAdresse() {
    var treffer = /[?&]sprache=(de|en)\b/.exec(location.search);
    return treffer ? treffer[1] : null;
  }

  function gemerkt() {
    try {
      var wert = localStorage.getItem(SCHLUESSEL);
      return (wert === 'de' || wert === 'en') ? wert : null;
    } catch (err) { return null; }
  }

  /* Der deutschsprachige Raum bekommt Deutsch, alles andere Englisch.
     `navigator.languages` statt `navigator.language`, weil auf einem iPad mit
     mehreren eingestellten Sprachen nur die Liste die zweite Wahl kennt. */
  function vomGeraet() {
    var liste = navigator.languages || [navigator.language || 'en'];
    for (var i = 0; i < liste.length; i++) {
      if (String(liste[i] || '').toLowerCase().indexOf('de') === 0) return 'de';
    }
    return 'en';
  }

  var aktiv = ausAdresse() || gemerkt() || vomGeraet();

  function waehle(sprache) {
    if (sprache !== 'de' && sprache !== 'en') return;
    try { localStorage.setItem(SCHLUESSEL, sprache); } catch (err) {}
    /* Neu laden statt alles zurückbauen: Die Namen stecken nach dem Start in
       aufgebauten Knöpfen, in gezeichneten Vorschauen und im Blatt selbst.
       Ein Neustart ist ehrlicher als ein halber Umbau – und dauert keine
       Sekunde, weil alles lokal liegt. Die Werke bleiben, sie liegen im
       Speicher des Geräts und nicht in der Seite. */
    location.replace(location.pathname + '?sprache=' + sprache + location.hash);
  }


  /* ------------------------------------------------------------------------
     Übersetzen
     ---------------------------------------------------------------------- */

  function t(text, sinn) {
    if (aktiv === 'de' || typeof text !== 'string') return text;

    if (sinn) {
      var mitSinn = EN[text + ' @' + sinn];
      if (mitSinn !== undefined) return mitSinn;
    }

    var fertig = EN[text];
    if (fertig !== undefined) return fertig;

    /* Auch mit Rand: Text aus dem HTML kommt oft mit Zeilenumbruch und
       Einrückung. Der Rand bleibt stehen, nur der Kern wird getauscht. */
    var kern = text.trim();
    if (kern !== text && kern) {
      if (sinn && EN[kern + ' @' + sinn] !== undefined) {
        return text.replace(kern, EN[kern + ' @' + sinn]);
      }
      if (EN[kern] !== undefined) return text.replace(kern, EN[kern]);
    }
    return text;
  }

  /* Die fertige Seite einmal durchgehen. Textknoten und die vier Attribute,
     die ein Mensch je zu hören oder zu sehen bekommt.

     `data-sinn` gilt für das Element und alles darin – so genügt eine Marke
     am umschließenden Kasten, wenn mehrere Knöpfe denselben Sinn teilen. */
  var ATTRIBUTE = ['aria-label', 'title', 'placeholder', 'alt'];

  /* Ganze Absätze -----------------------------------------------------------

     Ein Fließtext mit <b> darin zerfällt beim Durchgang über die Textknoten
     in Bruchstücke – „packt alles in eine Datei und öffnet das", dann fett
     „In Dateien sichern", dann der Rest. Einzeln übersetzt ergibt das keinen
     Satz, und in einem Wörterbuch stünden Halbsätze.

     Solche Absätze tragen deshalb `data-satz`. Sie werden als Ganzes
     nachgeschlagen – Schlüssel ist ihr innerer HTML-Text, auf einzelne
     Leerzeichen zusammengezogen, damit Einrückung und Zeilenumbruch im
     Quelltext nichts ausmachen. */
  function glatt(text) {
    return String(text).replace(/\s+/g, ' ').trim();
  }

  function absaetze(wurzel) {
    var offen = wurzel.querySelectorAll('[data-satz]');
    for (var i = 0; i < offen.length; i++) {
      var schluessel = glatt(offen[i].innerHTML);
      var fertig = EN[schluessel];
      if (fertig !== undefined) offen[i].innerHTML = fertig;
    }
  }

  function sinnVon(knoten) {
    var el = knoten.nodeType === 1 ? knoten : knoten.parentElement;
    var traeger = el && el.closest ? el.closest('[data-sinn]') : null;
    return traeger ? traeger.getAttribute('data-sinn') : null;
  }

  function seite(wurzel) {
    if (aktiv === 'de') return;
    wurzel = wurzel || document;

    /* Erst die ganzen Absätze, dann die einzelnen Knoten: Was oben schon
       vollständig ersetzt wurde, ist danach englisch und wird vom Durchgang
       über die Textknoten nicht mehr angefasst. */
    absaetze(wurzel);

    var lauf = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT, null);
    var offen = [];
    var knoten;
    while ((knoten = lauf.nextNode())) offen.push(knoten);
    offen.forEach(function (n) {
      var neu = t(n.nodeValue, sinnVon(n));
      if (neu !== n.nodeValue) n.nodeValue = neu;
    });

    var alle = wurzel.querySelectorAll('*');
    for (var i = 0; i < alle.length; i++) {
      var sinn = sinnVon(alle[i]);
      for (var k = 0; k < ATTRIBUTE.length; k++) {
        var wert = alle[i].getAttribute(ATTRIBUTE[k]);
        if (!wert) continue;
        var neu = t(wert, sinn);
        if (neu !== wert) alle[i].setAttribute(ATTRIBUTE[k], neu);
      }
    }

    if (document.documentElement) document.documentElement.lang = 'en';
    if (document.title) document.title = t(document.title);

    /* Die Beschreibung im Kopf. Sie steht nicht auf der Seite, wird aber
       gelesen – von Suchmaschinen und von der Vorschau, die beim Teilen
       eines Links erscheint. */
    var beschreibung = document.querySelector('meta[name="description"]');
    if (beschreibung) {
      beschreibung.setAttribute('content', t(beschreibung.getAttribute('content')));
    }
  }

  return {
    get aktiv() { return aktiv; },
    t: t,
    seite: seite,
    waehle: waehle,
    woerter: EN
  };
})();

/* Kurz, weil es an sehr vielen Stellen steht. */
function T(text, sinn) { return Sprache.t(text, sinn); }
