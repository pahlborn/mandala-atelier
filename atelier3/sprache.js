'use strict';

/* ============================================================================
   Sprache – Deutsch im deutschsprachigen Raum, sonst Englisch.

   Der deutsche Text ist der Schlüssel. Das ist die ganze Idee:

     T('Neues Blatt')   →  'Neues Blatt'  auf Deutsch
                        →  'New sheet'    auf Englisch

   Warum nicht Kennungen wie `blatt.neu`: Weil dann im Quelltext nirgends mehr
   stünde, was auf dem Knopf steht. Man müsste bei jeder Zeile nachschlagen,
   und die Datei hier wäre die einzige Stelle, an der die App noch lesbar ist.
   So bleibt das Deutsche im Code stehen, wo es hingehört, und diese Datei ist
   ein Wörterbuch – nicht ein zweiter Satz Namen für dieselben Dinge.

   Der Preis: Zwei gleich lautende deutsche Wörter, die verschieden übersetzt
   werden müssten, gehen nicht. Bisher gibt es keins; `tools/test-sprache.js`
   sucht danach und meldet es, falls doch eins entsteht.

   Fehlt ein Eintrag, erscheint der deutsche Text. Das ist Absicht: sichtbar
   unfertig ist besser als leer oder abgestürzt.

   ---------------------------------------------------------------------------

   Welche Sprache gilt, entscheidet sich in dieser Reihenfolge:

     1. ?sprache=de  oder  ?sprache=en   in der Adresse
     2. was zuletzt von Hand gewählt wurde
     3. die Sprache des Geräts – „de…" heißt Deutsch, alles andere Englisch

   Punkt 1 gibt es, weil ein Testlauf eine feste Sprache braucht und weil man
   die englische Fassung sonst nicht vorführen könnte, ohne das iPad
   umzustellen.
   ========================================================================== */

var Sprache = (function () {

  /* ------------------------------------------------------------------------
     Das Wörterbuch. Links steht, was im Quelltext steht.
     ---------------------------------------------------------------------- */

  var EN = {

    /* --- Der Name der App ------------------------------------------------ */
    'Mandala – Das ruhige Blatt': 'Mandala – The Quiet Leaf',
    'Blatt': 'Leaf',

    /* --- Die Bedienung --------------------------------------------------- */
    'Streiche über das Blatt.':   'Rub across the sheet.',
    'Neues Blatt':                'New sheet',
    'Blätter':                    'Sheets',
    'Ton aus':                    'Sound off',
    'Ton an':                     'Sound on',
    'Dieses Gerät behält nichts.': 'This device keeps nothing.',
    'Andere zeigen':              'Show others',
    'Zurück':                     'Back',
    'Noch nichts weggelegt.':     'Nothing laid aside yet.',
    'Aufnehmen':                  'Pick up',
    'Verwerfen':                  'Discard',
    'Wirklich verwerfen':         'Really discard',
    'Schließen':                  'Close',
    'Sprache':                    'Language',
    'Deutsch':                    'Deutsch',
    'Englisch':                   'English',

    /* --- Was nur die Vorlesestimme hört ---------------------------------- */
    'Blätter und Ton':            'Sheets and sound',
    'Ein Blatt Papier. Streiche mit dem Finger darüber – darunter liegt ein Mandala.':
      'A sheet of paper. Rub across it with a finger — a mandala lies underneath.',
    'Ein neues Blatt nehmen':     'Take a new sheet',
    'Dieses Blatt nehmen':        'Take this sheet',
    'Helles oder dunkles Papier': 'Light or dark paper',
    'Nächstes Blatt':             'Next sheet',
    'Voriges Blatt':              'Previous sheet',
    'Pigment wählen':             'Choose a pigment',
    'Welche Pigmente':            'Which pigments',
    'Welches Blatt':              'Which sheet',
    'Wonach ist dir heute':       'What is it to be today',
    'Sprache wählen':             'Choose a language',
    'Tagpapier':                  'Day paper',
    'Nachtpapier':                'Night paper',

    /* --- Papier ---------------------------------------------------------- */
    'Tag':                        'Day',
    'Nacht':                      'Night',

    /* --- Wonach einem heute ist ------------------------------------------
       Stimmungen, keine Formenkunde – das gilt auf Englisch genauso.
       „Anlage" ist der Sonderfall: etwas Gebautes, in das man hineingehen
       kann. `Grounds` sagt das, ohne einen Fachbegriff zu bemühen. */
    'Ruhe':                       'Quiet',
    'Blüte':                      'Bloom',
    'Klarheit':                   'Clarity',
    'Fülle':                      'Abundance',
    'Anlage':                     'Grounds',

    /* --- Pigmentwelten --------------------------------------------------- */
    'Erdpigmente':                'Earth Pigments',
    'Nordlicht':                  'Northern Light',
    'Färbergarten':               "Dyer's Garden",
    'Rauchglas':                  'Smoked Glass',
    'Goldgrund':                  'Gold Ground',

    /* --- Pigmente --------------------------------------------------------
       Wo es das Wort im Englischen wirklich gibt, steht es: Krapp ist
       `Madder`, Waid ist `Woad`, Cochenille ist `Cochineal`. Das sind
       Farbstoffnamen, keine Erfindungen, und ein Färbergarten ohne sie wäre
       keiner mehr.

       Eine Ausnahme: `Kalk` heißt wörtlich `Lime`, und das liest sich im
       Englischen zuerst als Frucht. `Limewash` trifft die Farbe – gekalkte
       Wand – und lässt keinen Zweifel. */
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

    /* --- Die Sätze -------------------------------------------------------
       Hier gelten dieselben zwei Regeln wie im Deutschen, und sie sind der
       Grund, warum diese Sätze nicht maschinell übersetzt werden können:

         kein „du"      – wer angesprochen wird, wird beobachtet
         kein Imperativ – „Lass es so stehen" verlangt etwas

       `you` steht deshalb in keinem einzigen. Und keiner ist länger als
       45 Zeichen; der Testlauf zählt nach. */
    'Hier gibt es nichts zu erreichen.':      'There is nothing to achieve here.',
    'Niemand zählt mit.':                     'No one is keeping count.',
    'Hier ist keine Uhr.':                    'There is no clock here.',
    'Es kann nichts kaputtgehen.':            'Nothing here can break.',
    'Hier gibt es nichts zurückzunehmen.':    'There is nothing here to take back.',
    'Es ist nur ein Blatt.':                  'It is only a sheet of paper.',

    'Unter dem Papier liegt schon etwas.':    'Something already lies under the paper.',
    'Das Muster war vor der Hand da.':        'The pattern was there before the hand.',
    'Papier nimmt nicht überall gleich an.':  'Paper does not take evenly everywhere.',
    'Langsam wird dunkler als schnell.':      'Slow comes out darker than fast.',
    'Zwei Farben übereinander ergeben eine dritte.':
      'Two colours over each other make a third.',
    'Eine dünne Schicht ist auch eine Schicht.': 'A thin layer is a layer too.',
    'Noch ein Strich verändert alles.':       'One more stroke changes everything.',

    'Es muss nicht gleichmäßig werden.':      'It does not have to come out even.',
    'Eine Spur bleibt eine Spur.':            'A trace stays a trace.',
    'Was liegt, gehört jetzt dazu.':          'What lies there belongs to it now.',
    'Unregelmäßig ist auch eine Beschaffenheit.': 'Uneven is a texture too.',
    'Nichts hier wird nachgebessert.':        'Nothing here gets touched up.',

    'Fertig ist keine Eigenschaft dieses Blattes.':
      'Finished is no property of this sheet.',
    'Ein Drittel ist auch ein Mandala.':      'A third of it is a mandala too.',
    'Man hört irgendwann auf. Das ist alles.': 'One stops at some point. That is all.',
    'Es läuft nichts davon.':                 'Nothing is running away.',

    'Manchmal ist es einfach nur Farbe auf Papier.':
      'Sometimes it is simply colour on paper.',
    'Nicht alles muss etwas bedeuten.':       'Not everything has to mean something.',
    'Das Blatt hat keine Meinung.':           'The sheet has no opinion.',

    /* --- Die Beschreibung im Kopf der Seite --------------------------------
       Sie steht in <meta name="description">; Suchmaschinen und die
       Vorschau beim Teilen lesen sie. */
    'Ein Blatt. Streiche darüber, und ein Mandala kommt hervor. Offline, ohne Konto, ohne Werbung.':
      'A sheet of paper. Rub across it, and a mandala comes out. Offline, no account, no advertising.'
  };


  /* ------------------------------------------------------------------------
     Welche Sprache gilt
     ---------------------------------------------------------------------- */

  var SCHLUESSEL = 'atelier3-sprache';

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
      var kurz = String(liste[i] || '').toLowerCase();
      if (kurz.indexOf('de') === 0) return 'de';
    }
    return 'en';
  }

  var aktiv = ausAdresse() || gemerkt() || vomGeraet();

  function waehle(sprache) {
    if (sprache !== 'de' && sprache !== 'en') return;
    try { localStorage.setItem(SCHLUESSEL, sprache); } catch (err) {}
    /* Neu laden statt alles zurückbauen: Die Namen stecken nach dem Start in
       aufgebauten Knöpfen, in gezeichneten Vorschauen und im Blatt selbst.
       Ein Neustart ist hier ehrlicher als ein halber Umbau – und dauert
       keine Sekunde, weil alles lokal liegt. */
    var ziel = location.pathname + '?sprache=' + sprache + location.hash;
    location.replace(ziel);
  }


  /* ------------------------------------------------------------------------
     Übersetzen
     ---------------------------------------------------------------------- */

  function t(text) {
    if (aktiv === 'de' || typeof text !== 'string') return text;
    var fertig = EN[text];
    if (fertig !== undefined) return fertig;

    /* Auch mit Rand: „ Blätter " kommt aus dem HTML mit Leerzeichen. */
    var kern = text.trim();
    if (kern !== text && EN[kern] !== undefined) {
      return text.replace(kern, EN[kern]);
    }
    return text;
  }

  /* Die fertige Seite einmal durchgehen. Textknoten und die vier Attribute,
     die ein Mensch je zu hören oder zu sehen bekommt. */
  var ATTRIBUTE = ['aria-label', 'title', 'placeholder', 'alt'];

  function seite(wurzel) {
    if (aktiv === 'de') return;
    wurzel = wurzel || document;

    var lauf = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT, null);
    var knoten;
    var offen = [];
    while ((knoten = lauf.nextNode())) offen.push(knoten);
    offen.forEach(function (n) {
      var neu = t(n.nodeValue);
      if (neu !== n.nodeValue) n.nodeValue = neu;
    });

    var alle = wurzel.querySelectorAll('*');
    for (var i = 0; i < alle.length; i++) {
      for (var k = 0; k < ATTRIBUTE.length; k++) {
        var wert = alle[i].getAttribute(ATTRIBUTE[k]);
        if (wert) {
          var neu = t(wert);
          if (neu !== wert) alle[i].setAttribute(ATTRIBUTE[k], neu);
        }
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
    /* Für den Testlauf: Wie viele Einträge das Wörterbuch hat und welche. */
    woerter: EN
  };
})();

/* Kurz, weil es an sehr vielen Stellen steht. */
function T(text) { return Sprache.t(text); }
