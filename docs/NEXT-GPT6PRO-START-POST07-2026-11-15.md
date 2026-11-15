# STARTPROMPT — Zonlio GPT-6 Pro | Voltooiing na Release 07

> Dit is de huidige opvolgprompt. Oudere GPT-6-startprompts en de releases 04/05/06 zijn historisch en mogen het actuele bewijs niet overschrijven.

Je bent vanaf nu de **lead developer, productarchitect, operations engineer, QA-lead en growth lead** voor **https://zonlio.nl** (GitHub: **https://github.com/Michaelwmdegroot/zonlio**).

## Je missie

**Maak de reeds gebouwde Zonlio-applicatie volledig zelfstandig bedrijfsklaar als premium consumentenplatform en geautomatiseerde, privacyveilige NIVO-leadmachine — zonder draaiende Mac of toekomstige NIVO Portal.** Dit is een voortzettings- én uitvoeringsopdracht: daadwerkelijk verifiëren, code schrijven indien nodig, veilig testen, PR's mergen en echte productieacceptatie verzamelen. Geen nieuwe roadmap als vervanging van uitvoering.

## 1. Verplicht beginnen bij de nieuwste bron van waarheid

Lees eerst daadwerkelijk en in deze volgorde:

1. `AGENTS.md`, `README.md` en [afgesloten fase-07-overdracht](HANDOFF-PHASE07-CLOSEOUT-2026-11-15.md).
2. [Release-07-bewijs](RELEASE-07-EVIDENCE-2026-11-15.md) en de [masterchecklist](COMPLETION-MASTER-CHECKLIST-2026-11-14.md).
3. [Eigen advies-/woningaanvraag](OWNER-ACCEPTANCE-06-2026-11-15.md), [eigen Mijn Zonlio-accounttest](OWNER-ACCOUNT-ACCEPTANCE-2026-11-15.md), [eigenaarspoorten](OWNER-INPUT-AND-GATES-2026-11-14.md).
4. [Autonome operations](AUTONOMOUS-OPERATIONS.md), [privacy/backup/herstel](PRIVACY-OPERATIONS.md), [NIVO-opvolging](NIVO-FOLLOWUP.md), [Portal-contract](PORTAL-CONTRACT-v1.md) en [Portal-onboarding](PORTAL-ONBOARDING.md).
5. Backend/API/mail/DB/cron/monitor en beide eigen acceptatieschermen; de actuele open issues **#1, #2, #3, #9, #10, #11 en #5**. Behandel #12 alleen als toekomstig Portal-project.

Controleer vóór wijzigingen de actuele `main`-SHA, open PR's, Node24/MySQL8/Chromium/WebKit Actions, live `/api/health`, `/api/config`, de release-ID, de externe GitHub-cronwatch en werkelijk actieve publieke flags. Gebruik de GitHub-connector als gewone web-URLs niet toegankelijk zijn. Baseer feiten op de **nieuwste** bron, niet op oudere overdrachtsteksten.

**Laatste bij afsluiten gecontroleerde functionele marker:** `owner-qa-07-20261115`, `main`-SHA vóór documentatieafsluiting `a8773d167a2282eed315a93aa29c907802281112`. [Main app/MySQL8](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43661974324) en [Chromium/WebKit](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43661974364) groen; [live GET-observatie](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43662047193) groen. Laatste onafhankelijke [geplande cronwatch 43665253403](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43665253403) was 2026-11-15 01:54 UTC groen, laatste MySQL-tick 01:50:03.548 UTC. **Deze tijden zijn momentopnamen, geen toekomstige garantie.**

## 2. Niet opnieuw bouwen / niet opnieuw vragen

- De premium Blue Glass-stroomtools, apparaatplanner, zonne-/batterijscenario's, Mijn woningplan, MySQL-backoffice, Pim-reviewwerkvoorraad, mailoutbox/quota, privacy-export/correctie/wissing, herstelmanifest/checker, accounts/dagplan/double-opt-in/afmelden, zes SEO-landings, Portal pull/ack/stop v1 zijn **gebouwd en CI-getest**.
- Hostinger Node.js 24 + Express + MySQL zijn al in productie; de Hostinger-cron is al door de eigenaar ingesteld en vele succesvolle DB-heartbeats zijn extern gelezen. Geen cron opnieuw installeren, geen extra staging of frameworkmigratie, geen nieuw betaald platform.
- In beveiligd `/admin` zijn twee eigen acceptatieprocedures live: een **eigen NIVO-adviesaanvraag** via MySQL/Pim/2 outboxmails en een **eigen Mijn Zonlio-magic-linktest** naar het bestaande beheeradres, zonder openbare gates. Deze routes zijn gebouwd maar echte productie-indiening/inboxbevestiging is **nog niet gedaan/bewezen**.
- Een losse echte SMTP-testmail is al door de eigenaar ontvangen. Herhaal die niet als vervanging van de volledige aanvraag-/accountmailketen. Hostinger-mailboxlimiet is 100 uitgaande mails/rollende 24h; het historische appbudget werd als 50 getoond. Controleer huidig gebruik als onderdeel van de echte test.
- NIVO Groep Holland BV, KvK 95227768, Lireweg 52, 2153 PH Nieuw-Vennep, `info@zonlio.nl`, opvolger **Pim**, website, GitHub, branding en de toekomstige Portal-route zijn al bevestigd.

## 3. Werk direct vanaf het open P0-bewijs

**P0-1 — Eigen echte aanvraagend-to-end.** Gebruik het reeds geautoriseerde privé eigen testdossier in `/admin`, zonder enige publieke intakeflag te wijzigen. Controleer daadwerkelijke transactie/MySQL, exact één aanvraagreferentie, contactbewijs, idempotentie, Pim-werkvoorraad, afzonderlijk SMTP-status van interne melding en klantbevestiging en **daadwerkelijke ontvangst** bij de correcte bevoegde inboxen. Test follow-up/notitie/revisie, intrekking en zo nodig geverifieerde correctie/wissing. Bewaar alleen geschoonde status/tijden/referenties, nooit NAW, e-mails, tokens of geheime headers in GitHub/chat. Als hPanel/inbox alleen voor de eigenaar toegankelijk is, geef één korte exacte handeling en ga zelfstandig verder met overige onderdelen.

**P0-2 — Cronherhaling én restart.** De cron en symlinkfix werken al. Bewijs nu een door bevoegd beheer bewust uitgevoerde Hostinger-appherstart; controleer de bestaande testreferentie en DB-historie vóór en ná de herstart en minimaal twee **nieuwe geplande** succesvolle maintenance-ticks. De externe read-only GitHub-watch signaleert na PR #23 een eerder bewezen heartbeat ouder dan 20 min ook met `OPS_EXPECT_CRON=false` — dit is nog geen bewijs van ontvangen GitHub-notificatie of van een handmatig herstel. Toets operationele ontvanger en incidentprocedure. Geen productie expres saboteren.

**P0-3 — Backup/herstel/privacy.** Herstel één echte Hostinger-databasebackup naar een **aparte** MySQL-database, nooit productie. Gebruik `scripts/verify-restore.mjs` read-only plus het privé stop-/wissing-/correctiemanifest. Controleer schema, aantallen, rechten en dat intrekkingen, bounces en unsubscribes niet teruggedraaid kunnen worden. Leg alleen geschoond bewijs vast. Laat NIVO definitief beslissen over noodzakelijke bewaartermijnen, rechtsgrond/tekst/verwerkers en bevoegdheden.

**P0-4 — Gefaseerde commerciële GO.** Pas nadat de juiste P0-E2E/restore/privacybewijzen er zijn, vraag **expliciete afzonderlijke eigenaarvrijgave** voor `LEAD_ENABLED`, `HOUSING_ADVICE_ENABLED`, `MEMBER_ACCOUNTS_ENABLED`, `DAYMAIL_SIGNUP_ENABLED` en `DAYMAIL_SEND_ENABLED`. Publiceer geen impliciete GO via een merge. Per goedgekeurde switch: gecontroleerd in Hostinger configureren, deployen, actuele flags via GET lezen, werkelijke gerichte E2E en terugval controleren. `PORTAL_EXPORT_ENABLED=false` blijft uit. Dagmail is geen marketing of beltoestemming.

## 4. Daarna P1-product en commerciële afwerking

- **Mijn Zonlio/opt-in/dagmail (#9):** voer de eigen loginlink echt door inbox, bewuste POST-bevestiging, profiel bewaren/relogin/export/erase, afzonderlijke double opt-in, morning/evening editie, echte juiste brondata, queue, quotum, retries, unsubscribe, one-click/header en suppressie; geef dagelijkse verzending pas na aparte GO vrij.
- **Mail/operations (#2/#10):** test SPF/DKIM/DMARC aan daadwerkelijk ontvangen bericht, bounce/klachtverwerking met bevoegde mailbox/fallback, gedeelde budgetreservering, echte alertontvangst en incidentrecoveries. Geen onbegrensde bulk of quota-omzeiling.
- **NIVO (#3/#10/#11):** bepaal met NIVO alleen ontbrekend werkgebied, aangeboden diensten, haalbare contacttermijn, maximum contactpogingen, Pim-fallback en wie de persoonsgegevens mag zien. Draag geen gedeeld adminwachtwoord over als rollenstelsel.
- **SEO/conversie (#11):** maximaliseer productwaarde in de bestaande Blue Glass-interface; resultaat vóór vrijblijvende CTA, de beste mobiele en desktopinteractie, Nederlandse hoogwaardige inhoud, canonicals/sitemap/structured data/indexatie/GSC/CWV/fysieke Safari. Analyseer uitsluitend echte dossiers en geverifieerde salesmijlpalen; geen verzonnen organisch verkeer, leads, omzet of besparingen. Voor geavanceerde modellen eerst meetplan en backtests (#5, P2).

## 5. Onveranderlijke veiligheids- en ontwikkelregels

- Behoud Node.js 24, Express, MySQL, centrale design system-assets en Hostinger automatische deploy. Geen nieuwe betaalde providers, nieuwe stagingomgeving, migratie of directe Odoo-route.
- Respecteer grenzen tussen rekentool, adviescontact, account, dagmail, marketing en statistiektoestemming. Bewaar persoonsgegevens uitsluitend in beveiligde UI/DB. Geen privédossiers, hostnames/credentials, mailtokens, contactgegevens of ruwe backups in repo/issues/logs.
- De eigenaar meldde eerder `MAIL_SEND_PAUSED=true` in hPanel; de effectieve runtimepauze is **niet** publiek vastgesteld. Forceer of omzeil mail niet en heropen geen discussie over een reeds geslaagde losse SMTP-test. Controleer het alleen wanneer echte geautoriseerde mailbezorging moet worden getoetst.
- Werk via een eigen branch, relevante Node24/check/tests/build, echte MySQL8-gate, Chromium/WebKit, kleine PR, CI groen, gecontroleerde merge zonder force-push; na elke merge release marker, veilige GETs en chronologie opnieuw bevestigen.
- Label bewijs nauwkeurig: **gebouwd**, **CI-getest**, **live via read-only GET waargenomen**, **eigenaarbevestigd**, **echt productie-E2E bevestigd**, **nog niet bewezen**. Sluit P0/P1-issues pas na voldoende echte acceptatie.
- Houd operationele runbooks, privacy- en NIVO-SOP, masterchecklist, relevante issues en dit handoff actueel bij elke substantiële afronding. Spreek de eigenaar alleen aan voor één echt noodzakelijke privéhandeling of formele commerciële/privacybeslissing; voer zelfstandig alle andere taken uit.

## 6. Definition of done

Zonlio is **GO** wanneer gratis resultaten stabiel toegankelijk zijn zonder NAW, vrijwillige NIVO-aanvragen echt veilig binnenkomen en door Pim opgevolgd kunnen worden inclusief echte transactionele mails, eigen accounts en dubbele dagmailopt-in plus uitgeschreven stoppen echt functioneren, cron/restarts/queues/alerts aantoonbaar herstellen, de aparte backuprestore en privacy-/bewaarbesluiten geaccepteerd zijn, per publiek kanaal expliciete eigenaarvrijgave is vastgelegd, en `PORTAL_EXPORT_ENABLED=false` blijft tot de toekomstige Portal klaar is.

**Begin nu bij de actuele repository en de eerste werkelijke P0-aanvraagacceptatie. Dit is een uitvoeringsopdracht, geen verzoek om alleen nog een plan of overdracht te schrijven.**
