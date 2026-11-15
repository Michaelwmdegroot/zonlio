# Zonlio

> **Actuele overdracht na Release 07 (15-11-2026):** [Fase-07-eindstand, uitgevoerde werkpakketten, open P0/P1/P2 en bewijsgrenzen](docs/HANDOFF-PHASE07-CLOSEOUT-2026-11-15.md) · [uitvoerprompt voor volgende GPT-6 Pro-agent](docs/NEXT-GPT6PRO-START-POST07-2026-11-15.md). Deze documenten hebben voorrang boven alle oudere startprompts. Nieuwste geverifieerde geplande GitHub-watch: [43665253403](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43665253403), gezond op 15 november 01:54 UTC, MySQL-onderhoudstick 01:50:03 UTC. Herstart-E2E, echte inboxen, aparte backuprestore, privacy-/commerciële GO blijven open.


**Jouw stroom. Helder in beeld.** Nederlands consumentenplatform met gratis stroomtools, een persoonlijk dagplan en vrijwillig woningadvies voor **NIVO Groep Holland BV**. Website: [zonlio.nl](https://zonlio.nl). Contact: **info@zonlio.nl**.

## Actuele stand — 15 november 2026: Release 07 LIVE, commercieel HOLD

**Actuele productiemarker:** `owner-qa-07-20261115`, onafhankelijk live geverifieerd via [productieobservatie 43661273936](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43661273936). De beveiligde Zonlio-admin bevat nu twee **uitsluitend eigen** acceptatietools: een test-NIVO-adviesaanvraag door de echte MySQL/Pim/outbox en een eenmalige Mijn Zonlio-loginlink voor het eigen beheeradres. Geen publieke leads of accounts geactiveerd. [PR #22](https://github.com/Michaelwmdegroot/zonlio/pull/22) heeft MySQL8- en Chromium/WebKit-acceptatie; [PR #23](https://github.com/Michaelwmdegroot/zonlio/pull/23) heeft een externe GitHub-waarschuwing toegevoegd als een reeds bewezen cronheartbeat >20 minuten oud wordt.

**Cron:** verschillende echte geslaagde onderhoudstijdstempels zijn uit MySQL gelezen, recent [01:00:03 UTC](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43661319635), zonder draaiende Mac. Nog géén gecontroleerde Hostinger-appherstart met twee nieuwe ticks, **echte** aanvraag-/account-/dagmailinbox, aparte backupherstelproef of formele NIVO/AVG-goedkeuring. `cronExpected=false` bleef een runtime-instelling; de nieuwe externe watchdog kan desondanks een gestopte eerder waargenomen cron herkennen. **Alle zes publieke/Portal-flags zijn uit.** Een code-merge is geen commerciële vrijgave.

**Actuele bewijsstukken:** [Release 07](docs/RELEASE-07-EVIDENCE-2026-11-15.md) · [eigen adviesaanvraag](docs/OWNER-ACCEPTANCE-06-2026-11-15.md) · [eigen accountlogin](docs/OWNER-ACCOUNT-ACCEPTANCE-2026-11-15.md) · [historische Release 06](docs/RELEASE-06-EVIDENCE-2026-11-15.md).

**Nieuwe agent begint bij:** [definitieve projectoverdracht](docs/HANDOFF-FINALIZATION-2026-11-15.md), [Release-07-bewijs](docs/RELEASE-07-EVIDENCE-2026-11-15.md) en de [nieuwe GPT-6 Pro-startprompt](docs/NEXT-GPT6PRO-START-2026-11-15.md). De [masterchecklist](docs/COMPLETION-MASTER-CHECKLIST-2026-11-14.md), [eigenaarspoorten](docs/OWNER-INPUT-AND-GATES-2026-11-14.md), [operationsrunbook](docs/AUTONOMOUS-OPERATIONS.md) en [privacyrunbook](docs/PRIVACY-OPERATIONS.md) blijven uitvoeringsdocumenten. Oude pilot-/groeiprompts en release 04 zijn historische context, geen actuele status.

## Product en grenzen

| Onderdeel | Gedrag |
| --- | --- |
| Gratis tools | Stroomprijzen, apparatenplanner, 2027-scenario en indicatief batterijjaarplan zonder registratie. Werkelijke data, bron, datum en aannames blijven zichtbaar. |
| Contract | Expliciete uur- of kwartierafrekening; kwartierweergave verandert een uurcontract niet in kwartierafrekening. Vast tarief krijgt geen fictieve timingwinst. |
| Mijn woningplan | Rekensamenvatting en vervolgstappen verschijnen vóór een vrijwillig contactformulier. |
| Mijn Zonlio | Bevestigde eenmalige toegang, profiel, dashboard, voorkeuren, inzage/export/verwijderen. Account en verkoopaanvraag zijn afzonderlijk. |
| Dagplan | Losse double opt-in, ochtend/avond, pauzeren en afmelden. Eén berekenbasis voor dashboard en mail; geen verzonnen plan bij onbruikbare data. |
| NIVO-advies | Woningintake met noodzakelijke NAW/telefoon, vast contactbewijs, optionele scenariodeling en opvolglabel Pim. Een abonnee is geen belbare lead. |
| Beheer | Dossiers, werkvoorraad, actieplanning, notities, revisies, intrekking, gegevensrechten, mail- en onderhoudsstatus. |
| Rapportage | Werkelijk opgeslagen aanvragen en historische contact-/kwalificatie-/afspraak-/offerte-/resultaatmijlpalen per bronmodule. Geen verzonnen unieke bezoekers of conversieratio. |
| Kennis | Zes zelfstandige HTML-landingspagina’s met eigen metadata en bronvermelding. Geen indexatie- of rankinggarantie. |
| Portal | Testbaar claim/ack-contract; **export uit**. Route later Zonlio → NIVO Portal → bestaande Odoo-connect. Geen directe Odoo-koppeling. |

De prijsfeed gebruikt Energy-Charts/SMARD met bronvermelding; regionale weercontext komt van MET Norway. De weerdata zijn geen berekende dakopbrengst. Het batterijmodel is een transparant jaarmodel, geen gevalideerde intervalscheduler of rendementsbelofte. Zie [databronnen](docs/DATA-SOURCES.md) en [modelgrenzen](docs/MODEL.md).

## Zelfstandig onderhoud

MySQL bewaart aanvragen, contactbewijs en outboxtaken transactioneel. SMTP-uitval wist geen aanvraag. De eigenaar heeft een afzonderlijke Hostinger-crontaak met een schema van elke vijf minuten aangemaakt. Er is inmiddels één werkelijk opgeslagen succesvolle onderhoudstick gezien; herhaling over een gecontroleerde herstart is nog niet bewezen. De taak is bedoeld voor onderhoud, verlopen contactrechten, queues, dagplannen en metadata. Duurzame locks voorkomen overlap; de geschiedenis is ontworpen om over een procesherstart te blijven bestaan. De app start geen permanente worker en vraagt geen draaiende Mac.

Het gedeelde rollende appbudget geldt voor alle verzendpogingen. Het bevestigde mailboxplafond is 100/24 uur; voorstel appbudget 50, met maximaal 80% voor dagmails. Handmatige webmail telt buiten de app en vraagt eigen ruimte. `MAIL_SEND_PAUSED=true` is de noodstop. Directe harde bounces en beheerde klachten zetten een duurzame verzendstop; asynchrone retourmails moeten nog via een bevoegde mailboxcontrole worden afgehandeld.

Operationele e-mailalerts zijn expliciet opt-in. Een onafhankelijke GitHub-workflow leest publieke health en de opgeslagen cronheartbeat. Het ontvangen van storingsmeldingen moet nog door de verantwoordelijke worden bewezen. Exacte installatie, incidenten en beperkingen: [operationsrunbook](docs/AUTONOMOUS-OPERATIONS.md).

## Ontwikkelen en verifiëren

Vereist **Node.js 24**. Stack: Express, JavaScript, MySQL in productie; tijdelijke SQLite alleen voor ontwikkeling/tests.

```sh
npm ci
cp .env.example .env
npm run dev
npm run check
npm test
npm run build
```

Gebruik `npm run admin:create` interactief voor een eigen wachtwoordhash. Geheimen en persoonsgegevens horen uitsluitend in afgeschermde configuratie/opslag; nooit in Git, issues, screenshots of testfixtures. De publieke build bevat geen servercode of database.

Aanvullende controles:

```sh
node --test tests/mysql.integration.test.mjs
npm run test:browser -- chromium
npm run test:browser -- webkit
npm run test:live
```

De MySQL-test vereist een afzonderlijke expliciete testdatabase en `MYSQL_TEST=1`. GitHub CI levert MySQL 8. Browsertests gebruiken een lokale echte Express-API met uitsluitend synthetische data en fake SMTP. WebKit-CI is geen fysieke iPhone-test. De livecontrole gebruikt alleen publieke GET-routes; geen login, aanvraag, verzending of cronmutatie.

## Productie en afzonderlijke vrijgave

Hostinger: Node 24, root `/`, build `npm run build`, start `npm start`, `server.mjs`, automatische deployment van `main`. Test kandidaten op een branch/PR vóór samenvoegen; Hostinger wacht niet aantoonbaar op main-CI. Productie accepteert nooit SQLite als MySQL ontbreekt.

`LEAD_CONTROLLER_CONFIRMED` bevestigt de ontvanger; daarnaast bepalen **aparte** flags `LEAD_ENABLED`, `HOUSING_ADVICE_ENABLED`, `MEMBER_ACCOUNTS_ENABLED`, `DAYMAIL_SIGNUP_ENABLED`, `DAYMAIL_SEND_ENABLED` en `PORTAL_EXPORT_ENABLED` de diensten. Alle staan standaard uit. Een publieke flag is geen eigenaar-testallowlist. `/admin#testen` toont de effectieve toestand zonder geheimen bloot te geven.

De code levert privacyexport, geverifieerde correctie, gegevenswissing met minimale stops, bewaarbeoordeling en een read-only restorechecker. Bewaarbeleid en echte afzonderlijke Hostinger-restore blijven expliciete acceptatievoorwaarden. De bestaande beheerlogin is geen medewerkersrollenstelsel; deel geen wachtwoord als teamoplossing.

## Documentatie

- [**Nieuwe agent — start hier**](docs/NEXT-GPT6PRO-START-2026-11-15.md) · [**Volledige overdracht en open werk**](docs/HANDOFF-FINALIZATION-2026-11-15.md) · [**Release 05 en bewijs**](docs/RELEASE-05-EVIDENCE-2026-11-15.md)
- [Historische release 04 en bewijsgrenzen](docs/AUTONOMY-04-RELEASE-2026-11-14.md) · [QA-register](docs/QA.md)
- [Uitrol](docs/DEPLOYMENT.md) · [Onderhoud en incidenten](docs/AUTONOMOUS-OPERATIONS.md)
- [Intake, toestemming en meting](docs/LEADS-PRIVACY.md) · [Privacyrechten en restore](docs/PRIVACY-OPERATIONS.md)
- [Account-/mail-QA](docs/COMPLETION-ACCOUNTS-QA-2026-11-14.md) · [Mailauthenticatie](docs/MAIL-AUTHENTICATION-QA.md)
- [Consument/SEO-QA](docs/COMPLETION-CONSUMER-QA-2026-11-14.md) · [Centraal design system](docs/DESIGN-SYSTEM.md)
- [Portal-contract](docs/PORTAL-CONTRACT-v1.md) · [Latere aansluiting](docs/PORTAL-ONBOARDING.md)
