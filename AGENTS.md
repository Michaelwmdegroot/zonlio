**15 NOVEMBER 2026 — START MET DE NIEUWE OVERDRACHT:** lees `docs/HANDOFF-FINALIZATION-2026-11-15.md`, `docs/RELEASE-05-EVIDENCE-2026-11-15.md` en `docs/NEXT-GPT6PRO-START-2026-11-15.md` **vóór** de oudere masterchecklist, eigenaarspoorten en runbooks. Laat oude 14-november-instructies de actuele feiten niet overschrijven. Vraag bevestigde NIVO-bedrijfsgegevens, de ontvangen SMTP-testmail of de reeds ingestelde Hostinger-cron **niet opnieuw**. Eén echte maintenance-tick is aangetoond; herhaling/restart en productie-E2E staan nog open. Houd de Portal uit en publieke commerciële activering apart.

# Zonlio — afspraken voor verdere ontwikkeling

Lees daarna `docs/AUTONOMY-04-RELEASE-2026-11-14.md`, `docs/AUTONOMOUS-OPERATIONS.md` en `docs/PRIVACY-OPERATIONS.md`; pilotnotities zijn historisch. Bestaande Node 24 / Express / MySQL-architectuur behouden. `main` kan automatisch naar Hostinger deployen. De eigenaar heeft op 14 november 2026 expliciet gevraagd op `main` verder te bouwen. Werk vanaf de actuele main-commit, test een afgebakende wijziging vóór publicatie, gebruik een atomische commit en nooit een force-push. Een ontwikkelopdracht is geen toestemming voor commerciële activering.

## Design is een gedeeld contract

- De eigenaar koos op 14 november 2026 voor de aangeleverde lichte Apple/Mac-referentie en Zonlio Brand Kit. Lees `docs/DESIGN-SYSTEM.md`.
- `src/design-system.css` is de visuele bron van waarheid. Gebruik semantische tokens, bestaande kaart-/knop-/formuliercomponenten en het goedgekeurde SVG-logo. Geen onafhankelijke thema's per scherm.
- Elke pagina laadt de centrale stylesheet na de eigen structurele stylesheets. Controleer desktop en minimaal 320/375/390 px.
- Houd prijsdata, contractaannames en scenario's uit elkaar. Een ontwerp is geen excuus voor verzonnen prijzen, automatische apparaatsturing of gegarandeerde opbrengsten.
- Previewdata horen uitsluitend in de offline reviewgenerator onder `scripts/`, nooit in `src/`, `public/` of productieresponses.

## Veilig blijven

Geen geheimen of persoonsgegevens in Git, screenshots of issues. Geen nieuwe betaalde diensten. Leadopvang blijft uit tot de P0-controles én expliciet eigenaarakkoord; een visuele goedkeuring is geen akkoord voor commerciële activatie.

Voer `npm run check`, `npm test`, `npm run build` en relevante MySQL-integratietests uit. Noteer of bewijs lokaal, gesimuleerd, CI, eigenaargerapporteerd of daadwerkelijk productie is. Werk documentatie bij na iedere substantiële fase.

## Bevestigd na groei-iteratie 2

Lees `docs/GROWTH-02-2026-11-14.md` en `docs/PORTAL-CONTRACT-v1.md`. Exploitant/ontvanger is NIVO Groep Holland BV; persoonlijke eigenaar-testdata nooit in Git. Route uitsluitend Zonlio → NIVO Portal → Odoo; geen directe Odoo-export. Abonnement, account, adviesverzoek en marketing zijn afzonderlijk. Geen functies automatisch activeren op basis van codepublicatie. Databron-/mail-/Portal- en rolgrenzen blijven expliciet.

## Afrondingsrelease 04

Algemene intake heeft nu een eigen `LEAD_ENABLED` naast `HOUSING_ADVICE_ENABLED`; bedrijfsbevestiging activeert geen intake. Alle commerciële flags blijven afzonderlijk. Nieuwe schema’s zijn additief. Test code op PR met MySQL 8 én Chromium/WebKit voordat main automatisch naar Hostinger gaat. Beoordeel daarna actuele publieke observatie en effectieve flags. Geen bewijs van productiecron, inboxketens of echte restore afleiden uit CI. Hostinger hPanel-sign-in was vanuit de cloudbrowser geblokkeerd; exacte eigenaarstappen staan in de runbooks. De bestaande enkele beheeridentiteit is geen medewerkersrollenstelsel.

## Release 05 en overdracht naar de volgende agent

- Huidige laatste functionele productieversie: `nivo-workbench-05-20261115`; werkvoorraad van Pim met serverfilter en datumplanning **live als statisch admin-JavaScript**. [Release-05 bewijs](docs/RELEASE-05-EVIDENCE-2026-11-15.md). Laatste functionele appcommit vóór documentatie: `396d19fc8fde5890e043e94624d13e5166b6a096`.
- CI (Node24, echte MySQL8, Chromium, WebKit) en 22 read-only productieprobes waren groen. Externe watch zag `lastMaintenanceAt=2026-11-15T00:00:02.878Z`, maar `cronExpected:false`. Geen volledige cron-/mail-/leads-/restore-E2E claimen.
- Beheertaak `Nu opvolgen` is geen commerciële toestemming of gefingeerd telefonisch contact. Werkgebied, terugbeltermijn, fallback en toegangsrechten vragen nog beleidskeuzes. De uitvoeringsprioriteiten, eigenaarminimale afhankelijkheden en actuele issues staan in de nieuwe overdracht.
- **Werksnelheid is gewenst:** bouw concrete geblokkeerde P0-functies, test en merge veilig; geen nieuwe stagingfase, frameworkmigratie of lang mailpauzecircuit. Veiligheids- en publieke vrijgavepoorten blijven wel gelden. Geen nieuwe betaalde diensten of secrets in repository.
