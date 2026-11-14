# Groei-iteratie 2 — publicatiebewijs

14 november 2026. **Code op main, productieactivering en echte aflevering niet bevestigd.**

## Gepubliceerde applicatie

Applicatiecommit: `da5d4c98c155392d6dba82d36e146b1950b42290`.

[GitHub-verificatie vóór de applicatiepublicatie: run 43610800142](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43610800142) is **geslaagd**. De gecontroleerde kandidaat is daarna als één samenhangende applicatiecommit naar main gepusht, zonder force-push. De zeven tijdelijke overdrachtsbestanden zijn verwijderd. Deze afsluitende documentatiecommit verwijdert de eenmalige workflow; de gewone main-CI blijft actief.

- Node 24: **45 JavaScript-modules** syntactisch gecontroleerd.
- Standaardteststap: **100 tests totaal, 99 geslaagd, één MySQL-gate overgeslagen in die stap**, geen fouten.
- Afzonderlijke echte MySQL 8-gate: **8 tests geslaagd, geen overgeslagen tests**. Dit omvat bestaande leadtransacties/rollback, gelijktijdige ontdubbeling, woningadvies/revisies/intrekken en nieuwe accountbevestiging, sessies, quota, afmelden en rollback van een mislukte account-outbox.
- Productiebuild: **26 publieke bestanden**; server, database en geheimen uitgesloten.
- Dependency-audit: **0 kwetsbaarheden gerapporteerd** tijdens deze controle.
- Het teruggehaalde verificatieartifact heeft SHA-256 `03c3a5361e4d2d4b94a43008380a0d00087230280c55832d01004df68c1ff200`. De 31 gewijzigde applicatie-, test- en documentatiebestanden uit het gepubliceerde bronarchief zijn bytegelijk vergeleken met de lokaal beoordeelde versie: **alle gelijk**.

## Wat deze release toevoegt

- NIVO Groep Holland BV als door de eigenaar bevestigde exploitant/ontvanger, met KvK en bedrijfsadres in centrale operatorconfiguratie en publieke informatie. Oude afwijkende hostingconfiguratie wordt niet stilzwijgend genegeerd; historische aanvragen worden niet omgeschreven.
- `/mijn`: optioneel account via eenmalige bevestigde e-maillink, eigen energieprofiel, contractinstellingen, apparaten, persoonlijke dagplannen, voorkeuren, eigen data-export en accountverwijdering.
- Expliciete dagmailinschrijving met e-mailbevestiging, ochtend-/avondeditie, pauze/afmelden en afzonderlijk bewijs; geen automatische verkoopaanvraag of marketingtoestemming.
- Datum-/contractgebonden dagplanengine, gedeelde prijssnapshots, begrensde onderhoudstaken, transactionele wachtrij, verloop-/revisiecontroles en een conservatief rollend verzendbudget.
- Zonlio-kant van de beveiligde NIVO Portal claim/ack-overdracht met stabiele aanvraag-ID, revisie, intrekking en ontvangstbevestiging. De route blijft uitsluitend Zonlio → NIVO Portal → Odoo. Pim is het opvolglabel, niet een nieuw gebruikersaccount.
- Geaggregeerd beheer voor accounts, abonnementen, mailverwerking en Portal-achterstand binnen het bestaande design.

Implementatie en beperkingen: [GROWTH-02-2026-11-14.md](GROWTH-02-2026-11-14.md). Ontvangstcontract voor de Portal: [PORTAL-CONTRACT-v1.md](PORTAL-CONTRACT-v1.md).

## Browserbewijs en grenzen

Chromium: **16 controles** op 320/375/390/768/1440 px, inclusief ingelogd/uitgelogd Mijn Zonlio, opgeslagen contractprofiel, persoonlijke planning, behoud van onopgeslagen invoer, expliciete abonnementskeuze en beheer op mobiel/desktop. Geen horizontale pagina-overflow of JavaScript-fouten.

Dit was een geïsoleerde lokale SQLite-backend met synthetische prijsdata en fake SMTP. Vanwege een browserbeleidblokkade zijn de echte bronmodules/styling inline geladen met een expliciete HTTP-testbrug; alleen de URL-opruimactie is aan de about:blank-fixture aangepast. Dit bewijst **niet** fysieke Safari/iPhone-werking, browsercookiegedrag op productie, Hostinger-deployment of echte inboxbezorging. De gewone HTTP-tests controleren de serverroutes en sessieheaders afzonderlijk.

## Eigenaarsbesluiten zijn vastgelegd; operationele controles staan nog open

De eigenaar heeft de exacte NIVO-identiteit, route via de NIVO Portal, Pim als opvolger, de editieopzet en een gecontroleerde test met zijn eigen gegevens toegestaan. Die keuzes hoeven niet opnieuw gevraagd te worden. Zijn persoonlijke testcontactgegevens staan niet in Git, fixtures, issues, screenshots of deze documentatie en zijn in deze ronde niet verstuurd.

Een nieuwe read-only poging naar `https://zonlio.nl/api/health` en `/api/config` was niet toegankelijk; ook DNS-resolutie vanuit de agentomgeving mislukte. Dat is geen bewijs dat de site offline is. De huidige Hostinger-deployment en live flagwaarden zijn hier niet onafhankelijk vastgesteld.

Er is geen hPanel-/hostingbeheeractie beschikbaar via de gevonden koppelingen; de gekoppelde Hostinger Mail-actie is geen toegang tot applicatie-omgevingsvariabelen, cron of de productiedatabase. Deze ronde heeft die instellingen niet gewijzigd en geen mail via echte SMTP verzonden.

Voor de gecontroleerde productiepilot blijven nodig: juiste gedeployde release, databaseback-up/afzonderlijke restoreproef, veilige account-/beheertest, SMTP-verify en inbox/spam, werkelijk uitgaand mailboxquotum, SPF/DKIM/DMARC en ondertekening van afmeldheaders, betrouwbare periodieke onderhoudstaak en rechten-/bewaarproces. De eigenaarstest is geautoriseerd maar nog niet uitgevoerd.

## Afzonderlijke activering

`MEMBER_ACCOUNTS_ENABLED`, `DAYMAIL_SIGNUP_ENABLED`, `DAYMAIL_SEND_ENABLED` en `PORTAL_EXPORT_ENABLED` blijven standaard uit. `SMTP_DAILY_LIMIT` is standaard 0: geen verzendquotum verzonnen. Woningadvies behoudt de eigen `HOUSING_ADVICE_ENABLED`-schakelaar en bestaande voorwaarden. Bevestiging van identiteit alleen is geen bewijs van werkende verzending.

De ontvangende Portal-plugin/cron en de bestaande Odoo-connect zijn **niet** gewijzigd of aangesloten. Volledige asynchrone bounce-/klachtverwerking, multi-user rollen, wekelijkse editie, commerciële campagnes, uitgebreide cohortanalytics en de geavanceerde PV-/batterij-/AI-modellen zijn vervolgwerk. Geen nieuwe betaalde dienst toegevoegd.

## Praktisch volgend uitvoermoment

Controleer de werkelijke Hostinger-release via het niet-geheime healthveld `releaseId: growth-02-20261114`, plus `/api/config`. Lees de productie-instellingen veilig, corrigeer eventuele oude ontvangerconfiguratie naar de bevestigde NIVO-gegevens en stel pas na quota-/SMTP-/restorecontrole de pilotflags in. Stuur geen credentials via chat. Test het reeds toegestane eigenaarsdossier in de echte applicatie en controleer opslag, ontvangen mail, intrekking en onderhoud. Sluit daarna de Portal aan volgens het afzonderlijke contract; dagelijkse mail en Portal-export krijgen elk hun eigen vrijgave.
