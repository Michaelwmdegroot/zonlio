# Zonlio

**Jouw stroom. Helder in beeld.** Een lichte, mobiele Nederlandse stroomapp voor zonnepaneelbezitters, met gepubliceerde kwartierprijzen, een verbruiksplanner, scenario's voor 2027 en een thuisbatterij, plus een afgeschermde backoffice voor adviesaanvragen.

Eigenaar van de repository: [Michaelwmdegroot](https://github.com/Michaelwmdegroot). Beoogd domein: **https://zonlio.nl**. Contact: **info@zonlio.nl**.

## Pilotstatus (14 november 2026)

**Technische pilot voltooid; commerciële adviesaanvragen nog HOLD.** De eigenaar heeft de productie-UI op `https://zonlio.nl` en de live health-uitvoer getoond. Hostinger draait de Node.js 24/Express-app met GitHub `main`, MySQL en beheerconfiguratie. De laatste door de eigenaar gedeelde health liet `databaseReady:true`, `adminConfigured:true`, `mailConfigured:true`, prijs- en weerbronnen `ready` en `leadEnabled:false` zien. Mailconfiguratie bewijst geen SMTP-acceptatie of inboxbezorging. De cron-taak en één echte end-to-end aanvraag zijn nog niet als geslaagd vastgelegd. Visuele screenshots van de eerdere lokale QA staan hieronder; productie is door de eigenaar via eigen browser bevestigd.

**Lees eerst de actuele [pilotoverdracht](docs/PILOT-HANDOFF-2026-11-14.md) en [startprompt voor de volgende agent](docs/NEXT-AGENT-STARTPROMPT.md).** Historische [QA](docs/QA.md) en [release](docs/RELEASE.md) documentatie is aangevuld om deze stand te onderscheiden van de aanvankelijke bouwfase.

## Zonlio 2.0 — designreview

De eigenaar heeft de visuele basis vóór de resterende productie-issues geprioriteerd. De implementatie op `feat/zonlio-design-system` gebruikt het aangeleverde Zonlio-logo en de lichte Apple/Mac-referentie. `src/design-system.css` is de gedeelde visuele laag voor alle bestaande schermen.

- [Ontwerpafspraken en tokens](docs/DESIGN-SYSTEM.md)
- [Componentkaart](docs/design-system.html)
- [Design-QA en beperkingen](docs/DESIGN-QA-2026-11-14.md)

Maak een offline, interactieve ontwerpversie met `node scripts/design-preview.mjs`. De bestanden verschijnen in `.artifacts/design/`. Ze gebruiken **uitsluitend herkenbare voorbeeldgegevens**; er worden geen aanvragen of e-mails verstuurd. Deze previewadapter wordt niet naar `dist` gekopieerd.

Een designreview is geen productie- of commerciële vrijgave. De P0-issues blijven open en leadactivatie vereist afzonderlijk bewijs en eigenaarakkoord.

## Groei-iteratie 1 — woningadvies en opvolging

De eigenaar heeft de vervolgbouw op `main` aangevraagd. De eerste afgebakende implementatie voegt een drie-stappen-woningadviesformulier, volledige woningadresopslag, opvolgacties, revisiebescherming en intrekking toe. De bestaande algemene adviesroute blijft werken; nieuwe woningaanvragen hebben de **aparte standaard uitgeschakelde** vlag `HOUSING_ADVICE_ENABLED`. Het dashboard toont deze status en de effectieve ontvanger. Geen abonnementen, accounts, dagmailer of Odoo-koppeling worden door deze release geactiveerd.

Lees [implementatie, QA en vrijgavegrenzen](docs/GROWTH-01-2026-11-14.md). De juridische entiteit voor NIVO, SMTP/inbox, cron, bewaarbeleid en productieherstel blijven P0. De publieke privacy- en contactpagina gebruiken dezelfde geconfigureerde bedrijfsnaam als de API; die technische consistentie is geen juridische bevestiging.

## Wat de applicatie doet

| Onderdeel | Gedrag |
| --- | --- |
| Stroomprijzen | Nederlandse day-aheadprijzen in echte kwartieren, met bron, datum, licentie en actualiteit. Uurweergave gebruikt een gewogen gemiddelde. |
| Persoonlijke tarieven | De app begint bij de beursprijs. Afname en terugleverwaarde gebruiken uitsluitend expliciet bevestigde contractinvoer. |
| Planner | Zoekt een passend toekomstig verbruiksblok binnen de beschikbare gepubliceerde prijsdag. Apparaatverbruik is een zichtbare aanname. |
| Weer | Regionale temperatuur, bewolking en neerslag uit MET Norway, met eigen actualiteitslabel. Geen fictieve dakopbrengst. |
| Mijn 2027 | Vergelijkt eigen verbruik en teruglevering met afzonderlijke, aanpasbare tariefaannames. |
| Batterij | Toont extra jaarwaarde boven op slimmer direct verbruik, inclusief verlies, investering en overige jaarkosten. |
| Advies | Een bezoeker kiest e-mail of telefoon, ziet de ontvanger en kan vrijwillig zijn rekenprofiel delen. |
| Backoffice | `/admin`: inloggen, instroom, aanvragen, details, opvolgstatus, notities, bronstatus en mailwachtrij. |
| Gebruiksmeting | Ruwe paginaweergaven apart; beperkte interactiestatistiek alleen na een actieve keuze. Geen verzonnen conversiepercentage. |

De prijsfeed gebruikt Energy-Charts met de Nederlandse SMARD-dataset en CC BY 4.0-bronvermelding. Voor deze feed en de regionale weerfeed is geen API-sleutel nodig. De NED-accountpagina wordt niet uitgelezen. Bronnen, gebruiksvoorwaarden en cachegedrag staan in [DATA-SOURCES.md](docs/DATA-SOURCES.md).

## Rekenen en verwachtingen

De ingevoerde jaarprijzen en het verhoogde eigen verbruik zijn scenarioaannames. Een actuele beursdag wordt niet geëxtrapoleerd naar een gegarandeerde jaarbesparing. Het batterijmodel is een jaarmodel: het simuleert geen laadstrategie, batterijvermogen of capaciteit uit meetdata. Rente, degradatie, vervanging, arbitrage en onbalanshandel zijn niet opgenomen.

De interface geeft uitleg op basis van de beschikbare data en controleerbare berekeningen. Deze release bevat geen aangesloten taalmodel of gevalideerde prijsvoorspelling. Verdere AI-uitleg kan later aansluiten op dezelfde brongegevens en rekenuitkomsten. Zie [MODEL.md](docs/MODEL.md).

## Ontwikkelen

Vereist **Node.js 24** en npm. Installeer vanuit het lockbestand:

```sh
npm ci
cp .env.example .env
npm run dev
```

Ontwikkeling gebruikt een SQLite-bestand in `.data/`; dat staat buiten Git en de publieke build. Vul voor beheer een eigen wachtwoordhash en een willekeurig sessiegeheim in de lokale, genegeerde `.env` in. `npm run admin:create` vraagt het wachtwoord verborgen in een interactieve terminal. Zet nooit een echt wachtwoord, API-sleutel, databasebestand of klantgegevens in de repository.

De server gebruikt poort 3000 tenzij `PORT` anders is ingesteld. In een omgeving met een beheerde preview gebruikt de previewbeheerder zijn eigen poort; start daar geen tweede previewserver naast.

```sh
npm run check
npm test
npm run build
```

De build bevat uitsluitend publieke HTML, CSS, modules en beeldbestanden. De Node-server draait de API en serveert `dist` wanneer die bestaat. Bouw opnieuw na een bronwijziging als je de gebouwde versie bekijkt.

## Productie

Hostinger-configuratie: Node.js 24, projectroot `/`, build `npm run build`, start `npm start`, ingang `server.mjs`, productiebranch `main`. Het platform levert `PORT`. Productie gebruikt **MySQL**, zodat een nieuwe build de aanvragen niet vervangt of wist. SQLite wordt in productiemodus geweigerd.

De applicatie bewaart de aanvraag, het contactbewijs en de verzendopdrachten in één transactie. Succes wordt pas teruggegeven nadat deze is vastgelegd. Een mailstoring laat de aanvraag in de backoffice staan. Een periodieke, beveiligde onderhoudsaanroep verwerkt achterstallige verzending; dit moet bij uitrol worden ingericht.

`LEAD_CONTROLLER_CONFIRMED=true` activeert productieaanvragen pas samen met werkende opslag en geconfigureerd beheer. De standaardontvanger is Thuisbatterij Team B.V.; de exploitant moet de bedrijfsgegevens en privacytekst bevestigen voordat dit wordt aangezet. De aanvraag geeft geen algemene marketingtoestemming of automatische toestemming voor overdracht aan andere bedrijven.

De volledige serverinstellingen, verificatie en herstelprocedure staan in [DEPLOYMENT.md](docs/DEPLOYMENT.md). `npm run readiness` controleert alleen de aanwezigheid van configuratie, zonder geheimen af te drukken; een geslaagde configuratiecheck bewijst geen netwerkverbinding of e-mailontvangst.

## Code en documentatie

| Pad | Verantwoordelijkheid |
| --- | --- |
| `src/app.mjs`, `src/style.css` | Publieke app en responsive interface |
| `src/api.mjs`, `src/chart.mjs` | Datacontracten, tijdweergave en interactieve grafiek |
| `src/domain.mjs` | Pure, geteste rekenfuncties |
| `src/leads.mjs` | Contactkeuze, aanvraagformulier en betrouwbare herhaling |
| `src/admin.mjs`, `src/admin.css` | Beheerdashboard |
| `server.mjs` | HTTP-server, beveiligingsheaders en begrensde publieke routes |
| `server/market.mjs`, `server/weather.mjs` | Gevalideerde externe databronnen en caches |
| `server/store.mjs`, `server/backend.mjs` | Persistente aanvragen, bewijs, status en statistieken |
| `server/auth.mjs`, `server/mail.mjs` | Beheersessies en mailwachtrij |
| `pages` | Contact- en privacyinformatie |
| `.github/workflows/check.yml` | Automatische controles bij push en pull request |

- [Merk en interface](docs/BRANDING.md)
- [Gekozen naam](docs/NAMING.md)
- [Databronnen](docs/DATA-SOURCES.md)
- [Rekenmodel](docs/MODEL.md)
- [Aanvragen en gegevens](docs/LEADS-PRIVACY.md)
- [Uitrol en beheer](docs/DEPLOYMENT.md)
- [Release en vervolg](docs/RELEASE.md)
- [Uitgevoerde verificatie](docs/QA.md)
