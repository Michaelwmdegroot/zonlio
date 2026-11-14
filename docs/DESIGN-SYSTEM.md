# Zonlio 2.0 — Blue Glass

**Ontwerpversie:** 2.0 / 14 november 2026. **Status:** ontwerpimplementatie voor review, niet automatisch een commerciële vrijgave.

De eigenaar heeft de visuele basis expliciet vóór de resterende backoffice-/productie-issues geprioriteerd. Deze iteratie wijzigt de presentatie; MySQL, SMTP, authenticatie, contacttoestemming en de activeringsvoorwaarden voor aanvragen blijven intact.

## Ontwerpbronnen

1. De door de eigenaar aangeleverde screenshot `ChatGPT Image Nov 14, 2026 at 03_41_22 AM(1).png`: lichte blauwe achtergrond met zachte plooien, glasachtige kaarten, gesegmenteerde navigatie, drie kerncijfers, grafiek en apparatenplanner.
2. `Zonlio_Brand_Kit(1).zip`: exact het aangeleverde vectorlogo en beeldmerk, met de hieronder vastgelegde merkkleuren. Het logo is niet opnieuw getekend.

We bouwen de website binnen de browser. De Safari-vensterrand uit de referentie wordt niet als nep-browser in de pagina nagebouwd. De voorbeeldtekst over automatische apparaataansturing wordt niet overgenomen: Zonlio kiest een tijdvak; de gebruiker stelt zelf een apparaat of timer in.

## Eén visuele bron van waarheid

**`src/design-system.css` is de centrale, versieerbare stylesheet.**

Elke HTML-ingang laadt eerst de bestaande structurele stylesheet(s) en daarna `design-system.css`. De oude bestanden behouden lay-out en functionele selectors. De centrale laag bepaalt de visuele tokens en gedeelde componenten; de bestaande variabelen worden aan diezelfde tokens gekoppeld. Geen los tweede thema of nieuw frontendframework.

```html
<link rel="stylesheet" href="/src/style.css">
<!-- Alleen waar nodig: admin.css of de bestaande legal.css. -->
<link rel="stylesheet" href="/src/design-system.css">
```

Van toepassing op: Overzicht, Planner, Mijn 2027, Batterij, instellingen, rapport-/adviesdialogen, bestaande beheerinterface, contact en privacy. De componentkaart staat in `docs/design-system.html`.

## Merkkleuren en semantiek

| Token | Waarde | Gebruik |
| --- | --- | --- |
| `--zonlio-navy` | `#031A37` | Koppen, primaire tekst en woordmerk |
| `--zonlio-blue` | `#0765F1` | Primaire actie, selectie en kerncijfers |
| `--zonlio-sky` | `#03BBF8` | Alleen ondersteunend merkaccent |
| `--zonlio-sun` | `#FFBC12` | Zonaccent, niet als tekstkleur op wit |
| `--zonlio-surface` | `#F8FBFF` | Licht merkoppervlak |
| `--z-text-secondary` | `#526585` | Leesbare toelichting |
| `--z-success` | `#126B48` | Positieve betekenis, met tekst erbij |
| `--z-warning` | `#815807` | Aannames, onzekerheid en waarschuwingen |
| `--z-danger` | `#AC3045` | Fouten en negatieve financiële uitkomsten |

Gebruik semantische `--z-*`-tokens in componenten. Maak geen nieuwe ruwe kleuren, schaduwen of afgeronde-hoekwaarden in featurebestanden. Voeg een werkelijk ontbrekend token hier toe, niet in een plaatselijke override.

## Typografie, ruimte en materiaal

Native systeemlettertype: op Apple-apparaten het beschikbare systeemlettertype; elders de opgegeven fallback. Er worden geen fonts gedownload of meegestuurd. Koppen zijn stevig maar niet zwaar; cijfers zijn tabulair. De hoofdkop schaalt van 30 naar 40 px, gewone tekst is 15 px en mobiele invoer is minimaal 16 px.

Afstanden volgen 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 px. Desktopinhoud is maximaal 1248 px breed. Kaarten hebben 22 px afronding, op kleine schermen 19 px; controls gebruiken 13 px. Oppervlakken zijn bijna-wit, met een fijne rand en een zachte schaduw. De illustratieve achtergrond is een kleine, lokale SVG zonder JavaScript of externe afhankelijkheden.

Primaire knoppen zijn 48 px hoog en blauw. Secundaire acties gebruiken een licht oppervlak. Navigatieselectie en prijsdag gebruiken een segmentcontrol; de tijdresolutie gebruikt compacte pillen. Focus heeft een blauwe contour én een zachte ring. Een geselecteerde grafiekbalk blijft herkenbaar naast de expliciete tijd-/waardeweergave en tabel.

## Mobiele regels

Controlebreedtes: 320, 375, 390, 768, 820, 1280 en 1440 px.

- Vanaf 940 px worden dubbele inhoudskolommen één kolom.
- Tot 820 px vervangt de vaste ondernavigatie de desktopnavigatie.
- Tot 600 px krijgt de eerste prijskernwaarde de volle breedte; de andere twee delen de volgende rij.
- Grafiekcontrols mogen herschikken, maar geen inhoud wegknippen. Geen `overflow-x:hidden` als oplossing voor een layoutfout.
- Inputs blijven minimaal 16 px; ondernavigatie en footer houden rekening met veilige schermranden.

Dit zijn CSS-/Chromium-viewportcontroles. Een fysieke iPhone-/Safari-test en een productiecontrole blijven aparte acceptatiepunten.

## Inhoud en vertrouwen

Geen voorbeeldprijzen in de productiecode. Geen fictieve opwek, automatisch gestarte apparaten of gegarandeerd batterijrendement. De compacte apparatenlijst gebruikt de bestaande rekenfunctie en dezelfde gekozen start-/eindtijden als de planner. Alleen de drie reeds ondersteunde apparaten worden getoond.

Ontwerpvoorbeelden zijn herkenbaar als **designpreview met voorbeeldgegevens**. Het script dat zo'n offline preview maakt staat onder `scripts/`, niet in `src/` of `public/`. Het wordt niet in de productiebouw opgenomen. Aanvragen en analytics staan in deze preview uit.

## Toegankelijkheid en prestaties

Behoud toetsenbordfocus, de overslaan-link, tabelalternatief, tekstlabels en alle privacykeuzes. Negatieve prijzen houden hun aparte semantische klasse. Verminderde beweging, verminderde transparantie, hoge-contrastmodus en print hebben expliciete varianten. Zonder blur-ondersteuning blijft een leesbaar, licht oppervlak over.

Geen nieuwe runtime-afhankelijkheden. Logo en achtergrond zijn lokale SVG's. Pas geen grote fotografie, uitgebreide animatiebibliotheek of meervoudige blurlaag toe zonder aantoonbare meerwaarde en meting.

## Controle en wijzigingen

```sh
npm run check
npm test
npm run build
node scripts/design-preview.mjs
```

`tests/design-system.test.mjs` borgt de merkwaarden, de gedeelde stylesheet, het gebruik van het goedgekeurde logo, de negatieve grafiekstatus en de afwezigheid van de previewadapter in de publieke build.

Nieuwe schermen gebruiken bestaande componenten en tokens. Eerst beoordelen op desktop én mobiel, daarna pas publiceren. De commerciële P0-issues blijven losstaan van een ontwerpgoedkeuring; deze stylesheet geeft geen toestemming om leadopvang te activeren.
