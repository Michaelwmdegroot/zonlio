# Actuele release

**Live productiemarker: `owner-qa-07-20261115`.** [Release-07-evidence](RELEASE-07-EVIDENCE-2026-11-15.md) bevestigt de originele MySQL8-/browsercontroles en de live release-/assetcheck; privé Mijn Zonlio-login-eigenaarstest [PR #22](https://github.com/Michaelwmdegroot/zonlio/pull/22) en zelfstandige staleness-watchdog [PR #23](https://github.com/Michaelwmdegroot/zonlio/pull/23). Geen publieke accounts, leads, dagmails of Portal-export. **Echte inboxen, gecontroleerde herstart, restore en commerciële GO zijn open.**

## Historische Release 06 — eigen aanvraagacceptatie

**Destijds extern geverifieerde live marker: `owner-acceptance-06-20261115`.** De [Release-06-evidence](RELEASE-06-EVIDENCE-2026-11-15.md) bewijst actuele main-CI, echte MySQL8-/browseracceptatie, read-only productieasset en meerdere onderhoudsheartbeats. [PR #19](https://github.com/Michaelwmdegroot/zonlio/pull/19) voegde de streng afgeschermde eigenaarstest toe; [PR #20](https://github.com/Michaelwmdegroot/zonlio/pull/20) de twee mailstatussen en de unieke releasecontrole. **Een echte ontvangen klant-/NIVO-mail, productieadviesaanvraag, herstartproef, aparte DB-restore, dagmailacceptatie en commerciële GO zijn nog niet bewezen.** Alle publieke serviceflags en Portal-export blijven uit.

## Historische Release 05 — onderliggende mijlpaal

De destijds live applicatiemarker was **`nivo-workbench-05-20261115`**. De volledige [release-05-evidence](RELEASE-05-EVIDENCE-2026-11-15.md) en [overdracht](HANDOFF-FINALIZATION-2026-11-15.md) zijn vanaf 15 november de actuele bron. Release 05 bracht de **Pim-werkvoorraad** ([PR #15](https://github.com/Michaelwmdegroot/zonlio/pull/15)), asset/releasebewijs ([PR #16](https://github.com/Michaelwmdegroot/zonlio/pull/16)) en de onafhankelijke productie-heartbeatinspectie ([PR #17](https://github.com/Michaelwmdegroot/zonlio/pull/17)). **22/22 productie-GET-probes**, Node/MySQL-CI en Chromium/WebKit waren groen. In de live MySQL-health is **één** maintenance-tick gezien; geplande herhaling na herstart is nog niet bewezen. Release 04 (`autonomy-ready-04-20261114`) blijft het onderliggende historische implementatiebewijs. De NIVO-werkvoorraad creëert geen extra commerciële contactrechten en verstuurt geen extra mail. **Adviesintake, accounts, dagmail en Portal waren bij laatste controle afzonderlijk uit**; commerciële vrijgave blijft HOLD. Zie ook [masterchecklist](COMPLETION-MASTER-CHECKLIST-2026-11-14.md) en [operationsrunbook](AUTONOMOUS-OPERATIONS.md).

## Historisch: technische pilot vóór groei- en afrondingsreleases

De volgende registratie beschrijft uitsluitend de oorspronkelijke fase. Oude ontvanger-/activeringsinstructies zijn vervangen door de actuele documenten hierboven.

# Zonlio 1.0 — actuele release en vervolg

**Status op 14 november 2026: technische pilot afgerond; commerciële adviesroute HOLD.** Bron van waarheid: [pilotoverdracht](PILOT-HANDOFF-2026-11-14.md). Dit document vervangt de vroegere status 'nog geen Hostinger-deployment'.

## Operationeel volgens eigenaar en GitHub

- Eigenaar bevestigde een geslaagde **Hostinger Cloud Professional / Node.js 24 / Express**-deployment van GitHub `main` naar `https://zonlio.nl`.
- Productiescreenshot toont de dashboardweergave met gepubliceerde stroomprijzen, grafiek en planner.
- Laatste door eigenaar gedeelde `/api/health`: `ok:true`, `databaseReady:true`, `adminConfigured:true`, `mailConfigured:true`, `leadEnabled:false`, prijs en weer `ready`.
- Database is MySQL; gebruiker herstelde toegangsrechten na `ER_DBACCESS_DENIED_ERROR`.
- Beheer is geconfigureerd; gebruiker heeft de beheeromgeving getest (geen volledige onafhankelijke beheer- of e-mail-E2E-audit).
- Laatste applicatiecommit vóór overdracht: `328de76891172a5c6f45f07cf47e0c6d6812bbec`, CI [groen](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43547783408).

## In code geïmplementeerd

- Nederlandse kwartierprijzen via Energy-Charts/SMARD met contractgebonden consumentenberekeningen, met bron- en foutstatus.
- Apparaatplanner met door gebruiker gekozen tijdvensters.
- Regionale MET Norway-weercontext.
- 2027- en batterijscenario's, met expliciete beperkingen en aannames.
- Adviesroute per e-mail/telefoon, vrijwillige scenario-overdracht, veilige dubbele inzendingen.
- MySQL-persistentie, outbox, SMTP-koppeling en afgeschermd beheer voor aanvragen, notities, status, statistieken en mailwachtrij.

## Niet afgerond: gates voor leads en definitieve publieke campagne

1. Juridische exploitant en ontvanger over de site, `LEAD_CONTROLLER_NAME`, privacy en contacttekst bevestigen. Huidige webpagina's noemen Thuisbatterij Team B.V.; eerder stond NIVO Groep Holland als mogelijke configuratie.
2. SMTP-authenticatie en echte e-mailbezorging controleren; `mailConfigured:true` is **geen** bezorgbewijs.
3. Periodieke beveiligde verwerking van `npm run maintenance` inrichten en controleren.
4. Login, sessie, statuswijzigingen, mailqueue, opslag na herstart, één gecontroleerde testaanvraag (geen willekeurige klanten) en herstel uit DB-back-up testen.
5. Bewaartermijnen, intrekking, inzage en verwijdering operationeel vastleggen; bestaande code verwijdert geen leads automatisch.
6. Pas dan met toestemming `LEAD_CONTROLLER_CONFIRMED=true` en de contactroute end-to-end activeren.

De technische basis is klaar om verder te bouwen. De eigenaar heeft aangegeven dat **visuele verbeteringen, verdere kwaliteitscontrole, SEO, productfuncties en AI** in de volgende ChatGPT-sessie worden opgepakt. Zie [NEXT-AGENT-STARTPROMPT.md](NEXT-AGENT-STARTPROMPT.md).

## Belangrijke beperking

De hierboven beschreven productiewerking komt uit de screenshots en health-uitvoer van de eigenaar. Rechtstreekse DNS-/HTTPS-verificatie vanuit de huidige assistentomgeving was niet mogelijk. Nooit een onafhankelijke check claimen zonder een daadwerkelijke test. Voor de oorspronkelijke QA en tests zie [QA.md](QA.md).
