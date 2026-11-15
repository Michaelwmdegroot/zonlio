# Zonlio Release 09 — eigenaarstest na onverwachte 503, mailstatus zichtbaar

**Datum:** 15 november 2026 (Europe/Amsterdam). **Werkelijk geverifieerde status:** codefix [PR #29](https://github.com/Michaelwmdegroot/zonlio/pull/29) **gemerged** in `main` als `cb7af19275b816781b7229fe2a73edc8ed4df796`; release `owner-acceptance-fix-09-20261115` onafhankelijk **LIVE** geverifieerd. Technische acceptatie geslaagd. **Update 15 november 2026:** twee echte transactionele eigenaarstestberichten zijn later onafhankelijk in de Hostinger-inbox bevestigd. De overige P0-gates blijven OPEN.

## Nieuw productie-E2E-bewijs: uitgaande eigen adviesmails werkelijk ontvangen

- **Aanvraagtype:** één afgeschermde eigen NIVO-adviesaanvraag via ingelogd Zonlio Beheer. De eigenaar rapporteerde succesvolle `Wachtrij verwerken` vanuit dezelfde echte Hostinger/Node.js-app; deze handmatige verwerking vervangt geen extra cron/restartbewijs.
- **Werkelijke inboxontvangst, onafhankelijk gelezen:** gekoppelde Hostinger Mail-mailbox `info@zonlio.nl` bevat precies twee nieuwe verschillende `[TEST]`-berichten, **2026-11-15 18:58:46 UTC** (klantbevestiging) en **18:58:47 UTC** (interne NIVO-melding). Beide berichten dragen **dezelfde** interne dossierreferentie; berichttypen zijn onafhankelijk vergeleken zonder de referentie te publiceren. Junk had nul berichten voor dit tijdvenster.
- **Bijkomend bewijs:** eigenaar leverde een privé screenshot van daadwerkelijk ontvangen NIVO-adviesmail en bevestigde dat wachtrijverwerking was geslaagd. In deze eigenaarstest was het beheeradres ook het klantadres; daarom kwamen beide mails in dezelfde mailbox aan.
- **Wat hiermee wél vaststaat:** twee verschillende werkelijke transactionele berichten voor één eigen testaanvraag zijn door de app aangeboden, geaccepteerd en in een echte inbox aangekomen. Dit is **geen** synthetische fake SMTP/CI-waarneming of alleen een SMTP-connectiviteitstest.
- **Niet afgeleid:** exacte effectieve hPanel-envwaarde, automatisch cron-verzenden zonder handmatige actie, daadwerkelijke MySQL-dossier-/Pim-/toestemmingsdetails, contactrevisie/intrekking/wissing, SPF/DKIM/DMARC-authenticatieheaders, bezorging bij een willekeurige andere mailbox of commerciële publieke GO. Geen persoonsgegevens, volledige dossierreferentie of ruwe mailheaders in GitHub.

Dit bewijs vervangt uitsluitend de eerdere **ontbrekende echte eigenaar-/mailinboxproef** hieronder. De overige P0-checkboxes blijven open.

## Aanleiding en diagnose

De eigenaar leverde een korte privé-schermopname van `/admin → Productieacceptatie · eigen test`. Direct na de klik verscheen de fout:

`De veilige acceptatietest vraagt een werkende database en bevestigde NIVO-ontvanger.`

De bijbehorende backend-route `POST /api/admin/acceptance/lead` gaf 503 op `!intakeReady || !operator.confirmed`. `intakeReady` vereist in productie `LEAD_CONTROLLER_CONFIRMED=true`. De openbare Release-08-waarneming [43740641396](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43740641396) had eerder wél `databaseReady=true`, `adminConfigured=true`, `operatorConfigured=true`, `operatorNameMatches=true` en `operatorContactMatches=true`. De exacte effectieve waarde van `LEAD_CONTROLLER_CONFIRMED` is niet openbaar uitgelezen; de weigering is **consistent met** de bewust gesloten activeringsbevestiging. Dit was een **API-afwijzing vóór databaseopslag en outbox**, niet een bewezen SMTP-fout. De gekoppelde interne `info@zonlio.nl`-inbox en spamfolder bevatten op de controledatum geen nieuw eigenaarstestbericht; een afwijzing op deze route zet geen berichten in de wachtrij. Geen persoonsgegevens uit de opname zijn overgenomen.

## Gerichte herstelling

1. Laat publiek `intakeReady` en `LEAD_CONTROLLER_CONFIRMED` voor algemene aanvragen en woningadvies **onveranderd**. Gebruik alleen voor `/api/admin/acceptance/lead` een eigen, strenge private-readinesscheck: werkende DB, canonieke NIVO-naam én -contact en ingericht beheeraccount. Bestaande admin-cookie, Origin+CSRF, uitsluitend eigen beheeradres, expliciete bevestiging, ≤3 pogingen/24h, idempotentie, testisolatie, Pim-label, contactbewijs en Portal-blokkade blijven behouden.
2. Maak in `/admin` de mailpauze of ontbrekende SMTP-configuratie **vóór de klik** zichtbaar. Een pauze blijft van kracht; de test slaat alleen veilig op met uitstaande queue.
3. Toon HTTP- en validatiefouten als contrasterende toegankelijke status onder het formulier én via de admin-notificatie. Bewaar de fout bij een nieuwe UI-render; geen ogenschijnlijk verdwijnende melding.
4. Maak de succesnotificatie precies: een dossier is opgeslagen maar bij `MAIL_SEND_PAUSED=true` is niets verstuurd. Zonder pauze staan twee onafhankelijke berichten in de queue; pas werkelijk geaccepteerde SMTP-status en inbox bewijzen aflevering.
5. Voeg synthetische regressietests toe voor de private test bij `LEAD_CONTROLLER_CONFIRMED=false`, gesloten publieke routes, behoud van mailpauze/queue en het blokkeren van een onjuiste NIVO-ontvanger. Browsertest reproduceert een 503, vereist een blijvend zichtbare fout en controleert een daarna geslaagde eigenaarstest met **fake SMTP**.

## Validatiepoort

- [x] PR-check Node.js 24, tests, echte MySQL 8, build en audit — [run 43747260528](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43747260528) SUCCESS.
- [x] Chromium en WebKit inclusief 503→zichtbare fout→eigen test retry — [run 43747260512](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43747260512) SUCCESS; [main-browsercheck 43747496835](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43747496835) ook SUCCESS.
- [x] PR #29 gecontroleerd gemerged als [commit cb7af192](https://github.com/Michaelwmdegroot/zonlio/commit/cb7af19275b816781b7229fe2a73edc8ed4df796), geen force-push.
- [x] Onafhankelijke publieke Hostinger-GET-observatie [run 43747577700](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43747577700), 2026-11-15 18:35:14 UTC: `expectedRelease=observedRelease=owner-acceptance-fix-09-20261115`; 23/23 GETs PASS, `databaseReady=true`, `adminConfigured=true`, `mailConfigured=true`, `operatorNameMatches=true`, `operatorContactMatches=true`. `leadEnabled`, `housingAdviceEnabled`, `accountsEnabled`, `subscriptionsEnabled`, `dailySendEnabled`, `portalExportEnabled` **allemaal false**.
- [x] Onafhankelijke operations-watch [run 43747604830](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43747604830) SUCCESS: `databaseReady=true`, `heartbeatFresh=true`, `monitoredCronStatus=current`, `sourcesReady=true`, laatste persistente onderhoudstick `2026-11-15T18:30:04.025Z`. Deze controlestaat bewijst **geen bewuste appherstart**.
- [x] **Echt ontvangen eigenaarstestmails:** interne NIVO-notificatie én aparte klantbevestiging, beide `[TEST]`, dezelfde dossierreferentie, rechtstreeks gezien in de gekoppelde Hostinger Mail-inbox. Zie ontvangen-bewijs hieronder.
- [ ] **Andere productie-P0-bewijzen:** privé verificatie van dossierpersistentie, Pim-taak, contactbewijs, afzonderlijke outbox-eindstatussen, idempotentie, revisie/intrekking en privacyrechten. Werkelijke ontvangst van twee berichten vervangt deze gegevensrecht-/DB-controles niet.
- [ ] Gecontroleerde Hostinger-appherstart + twee ticks + persistentie, echte aparte restore, NIVO privacybesluiten en publieke GO zijn **nog afzonderlijke P0-poorten**.

## Eigenaarstest is uitgevoerd — alleen resterende privécontroles

De eigenaar heeft inmiddels één eigen testaanvraag ingediend en de bestaande wachtrij succesvol verwerkt. **Geen nieuwe aanvraag of losse SMTP-test is nodig om dezelfde ontvangst te herhalen.** Volgende stap is in beveiligd `https://zonlio.nl/admin` dezelfde bestaande referentie bij **Acceptatietests** gebruiken om Pim, contactbewijs, twee outbox-eindstatussen, intrekking/privacy en persistentie vast te leggen; later de gecontroleerde Hostinger-herstart en afzonderlijke database-restore. Alle publieke commerciële flags en Portal blijven OFF.

**Bewijsniveaus:** screencast eigenaar voor zichtbare eerdere 503; onafhankelijke openbare health voor gereedheid van DB/admin/operator; synthetische backend-/browser-CI voor implementatie; onafhankelijke GET pas na merge voor live deploy; twee werkelijk ontvangen eigenaarstestmails **door gebruiker en Hostinger Mail-connector bevestigd**; privé-dossierrechten/DB-restart/restore nog **niet bewezen**. Nooit secret, adres, personal data, raw header of token in het register opnemen.
