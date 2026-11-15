# Zonlio Release 09 — eigenaarstest na onverwachte 503, mailstatus zichtbaar

**Datum:** 15 november 2026 (Europe/Amsterdam). **Status bij voorbereiding:** codefix op branch; beoogde release-ID `owner-acceptance-fix-09-20261115`. CI, merge en onafhankelijke Hostinger-productiecontrole zijn afzonderlijke stappen; deze tekst geeft nog geen bewijs van werkelijke SMTP-/inboxbezorging.

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

- [ ] PR-check Node.js 24, tests, MySQL 8, build, audit geslaagd.
- [ ] Chromium en WebKit zijn geslaagd met de nieuwe serverfout- en retry-test.
- [ ] Via geverifieerde PR naar `main` gemerged, geen force-push.
- [ ] Onafhankelijke publieke Hostinger-GET-observatie: exact `owner-acceptance-fix-09-20261115`, 23/23 controles, alle vijf commerciële gates uit en `PORTAL_EXPORT_ENABLED=false`.
- [ ] Onafhankelijke operations-watch na merge groen, opgeslagen MySQL-heartbeat actueel.
- [ ] **Echt productie-P0:** privé testdossier, Pim/consent, twee statusitems en echte NIVO-/aanvragerinboxontvangst **apart** bevestigd. Indien runtime mailpauze actief is, blijft mail-E2E geblokkeerd tot bevoegde eigenaar de normale schakelaar bewust vrijgeeft; nooit omzeilen.
- [ ] Gecontroleerde Hostinger-appherstart + twee ticks + persistentie, echte aparte restore, NIVO privacybesluiten en publieke GO zijn **nog afzonderlijke P0-poorten**.

## Eén kort opnieuw uit te voeren eigen verificatie na live release

Open beveiligd `https://zonlio.nl/admin` en het paneel **Productieacceptatie · eigen test**. Lees eerst de nieuwe mailstatus boven het formulier. Gebruik één eigen aanvraag (geen wachtwoorden of gegevens in GitHub of chat), controleer de teruggegeven referentie bij **Acceptatietests**, beide SMTP-statussen en afzonderlijke werkelijke ontvangst. Bij gepauzeerde mail uitsluitend status **in wachtrij** vastleggen en geen inboxontvangst claimen. De publieke commerciële flags en Portal blijven OFF.

**Bewijsniveaus:** screencast eigenaar voor zichtbare eerdere 503; onafhankelijke openbare health voor gereedheid van DB/admin/operator; synthetische backend-/browser-CI voor implementatie; onafhankelijke GET pas na merge voor live deploy; daadwerkelijke prive-inbox/proef nog **niet bewezen**. Nooit secret, adres, personal data, raw header of token in het register opnemen.
