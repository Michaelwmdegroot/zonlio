# Zonlio Release 09 — eigenaarstest na onverwachte 503, mailstatus zichtbaar

**Datum:** 15 november 2026 (Europe/Amsterdam). **Werkelijk geverifieerde status:** codefix [PR #29](https://github.com/Michaelwmdegroot/zonlio/pull/29) **gemerged** in `main` als `cb7af19275b816781b7229fe2a73edc8ed4df796`; release `owner-acceptance-fix-09-20261115` onafhankelijk **LIVE** geverifieerd. Technische acceptatie geslaagd, echte eigenaar-/SMTP-inbox-acceptatie **OPEN**.

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
- [ ] **Echt productie-P0:** privé testdossier, Pim/consent, twee statusitems en echte NIVO-/aanvragerinboxontvangst **apart** bevestigd. Indien runtime mailpauze actief is, blijft mail-E2E geblokkeerd tot bevoegde eigenaar de normale schakelaar bewust vrijgeeft; nooit omzeilen.
- [ ] Gecontroleerde Hostinger-appherstart + twee ticks + persistentie, echte aparte restore, NIVO privacybesluiten en publieke GO zijn **nog afzonderlijke P0-poorten**.

## Eén kort opnieuw uit te voeren eigen verificatie na live release

Open beveiligd `https://zonlio.nl/admin` en het paneel **Productieacceptatie · eigen test**. Lees eerst de nieuwe mailstatus boven het formulier. Gebruik één eigen aanvraag (geen wachtwoorden of gegevens in GitHub of chat), controleer de teruggegeven referentie bij **Acceptatietests**, beide SMTP-statussen en afzonderlijke werkelijke ontvangst. Bij gepauzeerde mail uitsluitend status **in wachtrij** vastleggen en geen inboxontvangst claimen. De publieke commerciële flags en Portal blijven OFF.

**Bewijsniveaus:** screencast eigenaar voor zichtbare eerdere 503; onafhankelijke openbare health voor gereedheid van DB/admin/operator; synthetische backend-/browser-CI voor implementatie; onafhankelijke GET pas na merge voor live deploy; daadwerkelijke prive-inbox/proef nog **niet bewezen**. Nooit secret, adres, personal data, raw header of token in het register opnemen.
