# Actuele release

De huidige codeversie is `nivo-workbench-05-20261115`. Release 05 voegt de Pim-werkvoorraad toe (PR #15) en een afzonderlijke read-only productiecheck die ook het nieuwe beheer-JavaScript controleert. Release 04 (`autonomy-ready-04-20261114`) blijft het onderliggende technische afrondingsbewijs. Zie [het volledige releasebewijs en GO/HOLD per dienst](AUTONOMY-04-RELEASE-2026-11-14.md), de [masterchecklist](COMPLETION-MASTER-CHECKLIST-2026-11-14.md) en het [operationsrunbook](AUTONOMOUS-OPERATIONS.md). De bevestigde exploitant is NIVO Groep Holland BV. De nieuwe werkvoorraad bevat geen extra commerciële contactrechten en verstuurt geen e-mails. Publieke adviesintake, accounts, dagmail en Portal blijven afzonderlijk vrij te geven. De live versie en feitelijke Hostinger-cron moeten opnieuw onafhankelijk worden vastgesteld; een groene code-PR is daarvoor geen bewijs.

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
