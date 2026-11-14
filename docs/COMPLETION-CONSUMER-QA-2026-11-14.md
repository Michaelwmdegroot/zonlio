# Consumentenfunnel, contractcorrectheid en SEO — 14 november 2026

## Opgeleverd in de repository

Het bestaande Blue Glass-design, de gratis modules en de afzonderlijke featureflags blijven de basis. Deze wijziging zet geen productieflag aan en verbindt geen Portal of Odoo.

### Een samenhangend woningplan vóór contactgegevens

`Mijn woningplan` brengt het huidige variabele jaarsaldo, het verschil door meer direct eigen verbruik en de extra jaarwaarde van opslag samen. De vervolgstappen verwijzen terug naar de eigen jaarinvoer, apparatenplanner en batterijaannames. Negatieve en niet-terugverdiende scenario's blijven zichtbaar. Uitgebreide aannames staan bij de uitkomst; tekst/PDF via de bestaande browserfuncties blijft mogelijk zonder account of contactgegevens.

Vrijwillig woningadvies volgt pas op de getoonde uitkomst. Het rekenprofiel wordt alleen gedeeld wanneer de bezoeker dat in de intake aanvinkt. De planner biedt een account-/dagmailvervolg alleen wanneer de betreffende runtimeconfiguratie dit toelaat, anders een gratis scenariostap.

### Een echte contractfout hersteld

De publieke planner gebruikte voor bevestigde dynamische contracten steeds de oorspronkelijke prijsintervallen, zonder te vragen of de leverancier per uur of per kwartier afrekent. Daardoor kon een uurcontract een voordeel uit kwartierfluctuaties suggereren.

- Bij dynamische afname is de afrekenperiode nu een verplichte, bewuste keuze.
- De grafiekresolutie staat los van de contractresolutie.
- Een kwartierweergave van een uurcontract gebruikt voor alle kwartieren binnen hetzelfde uur de uurprijs.
- De planner gebruikt hele uurblokken bij een uurcontract, overeenkomstig de huidige persoonlijke dagplanengine.
- De twee terugkerende Nederlandse wintertijduren worden op hun werkelijke tijdstippen onderscheiden.
- Eerder lokaal opgeslagen dynamische contracten zonder afrekenperiode worden niet stilzwijgend als bevestigd hergebruikt. De jaarinvoer blijft behouden; de gebruiker bevestigt de actuele contractonderdelen opnieuw.

De berekening is geïsoleerd in `src/planner-prices.mjs`. De beursweergave blijft de oorspronkelijke bronwaarden tonen. Vast/variabel blijft één door de gebruiker ingevoerd tarief; geen beloofde besparing door alleen te schuiven.

### Privacybewuste interactiemeting

`calculator_complete` wordt nu verzonden bij een bewuste geldige rekenwijziging, een geldige gekozen planning of expliciet gebruik van het resultaat. Een automatische eerste rendering telt niet als voltooide berekening. Een planning zonder passend tijdvak telt niet mee.

De eerdere frontend markeerde de berekening ook zonder analytics-toestemming al als gemeten, waardoor een latere bewuste keuze binnen dezelfde sessie kon ontbreken. Dat is hersteld. Weigeren en intrekken stoppen nieuwe events; intrekking verwijdert het tab-ID en de lokale meetmarkering. Alleen de bestaande allowlist van event/module/tab-ID/toestemming gaat naar de API, zonder tarieven, scenario-invoer, contactgegevens, vrije URL's of campagneparameters.

Opgeslagen leads en salesmijlpalen blijven de backendbron van waarheid. Interactie-events zijn geen leadbewijs en vormen geen conversiepercentage met alle bezoekers. Deze wijziging claimt geen herleidbare SEO- of campagneattributie.

### Statische, inhoudelijke zoeklandings

| URL | Inhoud en passende gratis tool |
| --- | --- |
| `/kennis` | Uitlegindex met zichtbare interne links |
| `/stroomprijzen` | Beurs/afname/teruglevering, uur/kwartier, datum en bronstatus → overzicht |
| `/slim-stroomverbruik` | Complete apparaatprogramma's, tijdvensters, contractbasis en grenzen → planner |
| `/zonnepanelen-2027` | Einde wettelijke saldering, eigen invoer, energiebalans en scenarioaannames → Mijn 2027 |
| `/terugleveren` | Bruto vergoeding, kostenstructuur, netto waarde en voorbeelden → Mijn 2027 |
| `/thuisbatterij-berekenen` | Extra waarde boven direct verbruik, verliezen, kosten en ontbrekende simulatie → batterij |

Iedere pagina heeft een eigen titel, description, canonical en Open Graph-metadata. De vijf artikelen gebruiken zichtbare schema.org Article/Breadcrumb-microdata. De content en interne links werken zonder JavaScript. Dat maakt geen versoepeling van `script-src 'self'` nodig. Geen gesuggereerde reviews, sterren, gegarandeerde opbrengsten of FAQ-rich-resultclaims.

De homepage krijgt een bruikbare HTML-startinhoud vóór JavaScript, met een link naar de uitleg. Sitemap en robots zijn bijgewerkt; account-, admin- en API-routes staan niet in de sitemap. `noindex` in HTML en HTTP blijft voor account en beheer intact. De openbare inlogschermen worden niet met robots.txt geblokkeerd, zodat zoekmachines die noindex-regel daadwerkelijk kunnen lezen; persoonlijke data blijven achter authenticatie op de API. De server behoudt een expliciete statische routeallowlist; ruwe `pages/`-paden worden niet openbaar gemaakt.

## Uitgevoerde controles en bewijsniveau

- **Lokaal, Node 24:** `npm run check` geslaagd; `npm run build` geslaagd, alleen publieke bestanden in `dist`.
- **Lokaal, 19 gerichte tests:** `tests/frontend.test.mjs`, `tests/design-system.test.mjs` en `tests/consumer-seo.test.mjs` allemaal geslaagd. Nieuwe regressies dekken uur/kwartier-contractcorrectheid, niet-bevestigde resolutie, wintertijd, HTTP-landings, canonicals, shared styling, sitemap, noindex en het behoud van de assetallowlist.
- **Onafhankelijke code-review:** een tweede agent controleerde de tariefmapping, publieke contractflow en consistentie met de dagplanengine; geen blokkade gevonden. De huidige marktadapter vereist kwartierdata; ondersteuning voor andere bronresoluties vraagt later expliciete contractvalidatie.
- **Nog geen lokaal browserbewijs:** de geïnstalleerde Chromium kon in deze uitvoeromgeving niet starten door `socket() failed: Operation not permitted`. WebKit was hier niet geïnstalleerd. Dit is geen geslaagde viewport- of Safari-test.
- **Reproduceerbare browsergate toegevoegd:** `npm run test:browser -- chromium` / `webkit` en workflow `Consumer browser acceptance`. Die gebruikt uitsluitend een lokale Express-server, in-memory SQLite, vaste synthetische prijsdata en een fake SMTP-transport. De browsertest zelf maakt geen productieverbinding en verstuurt geen echte e-mail.

De browsergate is ontworpen voor breedtes 320/375/390/1440, horizontale overflow, zichtbare resultaten vóór NAW, dialog/keyboard, analytics-toestemming/intrekking, uurafrekening, één synthetische woningaanvraag en fake mailontvangst, echte lokale beheersessie/statusupdate, gecontroleerde contactcorrectie en erasure, accountlink met expliciete POST, opgeslagen profiel/dagplan, pauze en afmelding. Screenshots en geschoonde testuitkomsten worden alleen als korte CI-artifacts gepubliceerd. **Voeg pas na een geslaagde workflow de exacte run/commit toe aan releasebewijs.** WebKit op Linux is bovendien geen fysieke iPhone/Safari-acceptatie.

## Geverifieerde officiële bronnen

Gecontroleerd op 14 november 2026. Artikeltekst verwijst bij feitelijke wijziging/risico naar de betreffende bron. Rekenvoorbeelden zijn duidelijk voorbeelden; actuele prijzen komen uitsluitend uit de bestaande feed.

- Rijksoverheid, [salderingsregeling stopt in 2027](https://www.rijksoverheid.nl/themas/klimaat-milieu-en-natuur/energie-thuis/salderingsregeling).
- ACM ConsuWijzer, [salderen en terugleveren](https://consument.acm.nl/elektriciteit-en-gas/duurzame-energie/wat-is-salderen), inclusief doorlopende contracten en onderscheid vergoeding/kosten.
- ACM ConsuWijzer, [soorten energiecontract en vergelijken](https://consument.acm.nl/elektriciteit-en-gas/overstappen-vergelijken-en-verhuizen/tips-bij-het-kiezen-van-een-energieleverancier).
- Milieu Centraal, [thuisbatterij en financiële onzekerheid](https://www.milieucentraal.nl/energie-besparen/zonnepanelen/thuisbatterij-zonne-energie-opslaan/).
- [Energy-Charts OpenAPI](https://api.energy-charts.info/openapi.json), [SMARD-gebruiksrechten](https://www.smard.de/en/datennutzung).
- Google Search Central, [noindex vereist crawlbare inlogpagina](https://developers.google.com/search/docs/crawling-indexing/block-indexing).
- Google Search Central, [structured data en zichtbare content](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data).
- Playwright, [geïsoleerde klok](https://playwright.dev/docs/clock) en [CI-browserinstallatie](https://playwright.dev/docs/ci-intro).

## Resterend voor volledige issue #11-acceptatie

1. Exacte commit groen in applicatie-CI én browser-CI; relevante Hostinger-publicatie opnieuw controleren.
2. Fysieke mobiele Safari-toets en beoordeling van de uitgebreide woningplanweergave door eigenaar.
3. Search Console/indexatie en werkelijke Core Web Vitals verifiëren zodra voldoende productiegegevens/toegang bestaan. Aanwezigheid van canonical/sitemap is geen indexatiebewijs of prestatiewaardering.
4. Productielead → NIVO-opvolging → commerciële uitkomst blijft onder de P0-gates en expliciete vrijgave. Lokale fake SMTP is geen inboxbewijs.
5. Werkgebied, diensten, opvolgtermijn en bevoegde medewerkers/fallback blijven bedrijfsbesluiten; er zijn geen extra publieke beloftes of teamaccounts toegevoegd.
