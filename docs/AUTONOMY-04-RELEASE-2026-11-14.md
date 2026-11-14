# Afrondingsrelease 04 — bewijs en resterende productiepoorten

**Applicatiemarker:** `autonomy-ready-04-20261114` · **Datum:** 14 november 2026 · **Commerciële status: HOLD.**

Deze ronde bouwt voort op `main` `cb9e943c130761763caa87349a42178f7c154b64`. De drie verplichte overdrachten, actuele broncode, design-/privacy-/Portal-documentatie en issues #1, #2, #3, #5, #9, #10, #11, #12 zijn gelezen. Geen productieflags, echte dossiers of SMTP-berichten zijn door deze ronde gewijzigd/verzonden. De eerdere ontvangen eigenaarstest en bevestigde NIVO-identiteit blijven geldig bewijs binnen hun eigen scope.

## 1. Geleverde wijziging

| Onderdeel | Concreet resultaat | Bewijsgrens |
| --- | --- | --- |
| Activering | Algemene intake heeft eigen `LEAD_ENABLED`; bedrijfsbevestiging opent geen route. Cronsecret moet afzonderlijk zijn. | Geen publieke vrijgave. |
| Onderhoud | Persistente MySQL-locks/ticks, veilige overlapping/herstart, contactverval los van Portal, scheduler/queue-/broncontroles, achterstallige opvolging, metadata-cleanup. | hPanel-cron nog feitelijk installeren/controleren. |
| Gezondheid | Live databaseleesproef, opgeslagen cronheartbeat, veilige operationele beheersamenvatting, onafhankelijke geplande GitHub-GET-check. | Ontvangen storingsnotificatie en productiecontinuïteit nog aantonen. |
| Mail | Gezamenlijk budget maximaal 100/24 uur, voorstel 50; 80% dagmailplafond; globale pauze; actuele lease/rechten vóór verzending; duurzame klacht-/hard-bouncestops. | Geen volledige asynchrone bounce-inname of inboxgarantie. |
| Accounts | Opt-in behoudt opgeslagen contract, past bevestigde apparaten/tijden toe; afmelden stopt nieuwe pending opt-in; malformed data blokkeert dagplan; account-erasureledger. | Werkelijke mailboxbevestiging en productieprofielproef ontbreken. |
| Privacy | Beheerde inzage, correctie, gegevenswissing, minimale audit/stops, retentiepreview, privéherstelregister en aparte read-only MySQL-restorechecker. | Geen echte Hostinger-restore of definitief bewaarbeleid geclaimd. |
| Consument | Samenhangend woningplan vóór NAW, contextuele vervolgstappen, correcte uur-/kwartierafrekening, veiligere async formulieren. | Fysieke mobiele Safari blijft aparte controle. |
| SEO/analytics | Zes HTML-kennislandings, canonical/sitemap/microdata, meaningful consent-events, werkelijk bereikte historische salesmijlpalen. | Geen Search Console-/ranking-/CWV- of campagneattributiebewijs. |
| Portal | `advice.upsert`, `advice.withdrawn`, `advice.closed`, `advice.contact_expired`, `advice.erased`; gevalideerd claim/ack/revision/lease, stop zonder NAW, aansluitrunbook. | Zonlio-zijde testbaar; Portal-export blijft uit, ontvanger nog niet aangesloten. |

## 2. Bewijsregister

### Aanvangscontrole productie

Een opnieuw uitgevoerde GitHub-observatie op 14 november 2026, **21:13:08 UTC**, slaagde voor de toen actuele release `test-ready-03-20261114`: twaalf publieke GET-checks; database, beheer en mail geconfigureerd; bedrijfsnaam/contact passend; alle zes commerciële flags uit. [Run 43640118647](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43640118647), nieuwste poging/job 132590226271. Deze controle was geen inbox-, cron-, rechten- of restoreproef.

De directe netwerkroute uit de werkruimte kon Zonlio niet betrouwbaar ophalen. Die beperking is niet als productie-uitval geïnterpreteerd; de GitHub-observatie gaf het externe bewijs. Hostinger hPanel meldde dat aanmelden vanuit de cloudbrowser niet is toegestaan. De beschikbare mailkoppeling biedt geen hPanel-/database-/crontoegang.

### Lokale kandidaat

- Node 24.22.1; `npm ci` uit lockbestand.
- `npm run check`: **68 modules** syntactisch geldig.
- `npm test`: **178 tests: 177 geslaagd, 1 expliciete MySQL-skip, 0 fouten** in de afsluitende lokale run, inclusief de uitgebreidere publieke smokecheck en de gecorrigeerd-adres/hard-bounce-race.
- `npm run build`: **36 publieke bestanden**; geen server-/database-/geheimkopie.
- `npm audit --omit=dev --audit-level=high`: **0 gevonden kwetsbaarheden** in productiedependencies.
- `git diff --check`: geslaagd.
- Account-/mail-, Portal-/privacy-, maintenance-/operations- en frontend-/SEO-regressies gebruiken uitsluitend synthetische tijdelijke data en fake SMTP.
- Lokale Chromium-start geblokkeerd door `socket() ... Operation not permitted`; geen lokale browseracceptatie geclaimd. Daarom aparte echte Chromium- en WebKit-CI-gate vóór merge.

### GitHub-kandidaat en deployment

[PR #13](https://github.com/Michaelwmdegroot/zonlio/pull/13) is vóór main gepubliceerd. De eerste kandidaat `aea435a7a2d30766995711429ba32fded852955b` leverde twee concrete bevindingen op:

- [MySQL-run 43643784952](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43643784952): alle elf voorafgaande subtests slaagden; de restore-inspectie weigerde het prepared protocol voor een transactiestuurstatement (`ER_UNSUPPORTED_PS`). De statische read-only/snapshotstatements gebruiken nu `query()`; parameterqueries blijven prepared.
- [Browser-run 43643784955](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43643784955): Chromium en WebKit passeerden 122 controles en vonden daarna een echte 324px-beheerlayout op een viewport van 320px. De centrale stylesheet geeft operationele statistieken op mobiel één leesbare kolom; geen overflow verbergen of testgrens versoepelen. Foutdiagnostiek bewaart voortaan ook een screenshot.

Deze kandidaat is niet naar main gemerged. De gecorrigeerde kandidaat moet de volledige gates opnieuw doorlopen. Definitieve CI-/deploymentresultaten volgen na waarneming.

## 3. Uitvoerbare beheerprocedures

- [Onderhoud, hPanel-cron, quota, pauze, alarmering en incidenten](AUTONOMOUS-OPERATIONS.md).
- [Privacyrechten, conceptbewaarbeleid en afzonderlijke restoreproef](PRIVACY-OPERATIONS.md).
- [Werkelijke DNS-/headercontrole](MAIL-AUTHENTICATION-QA.md).
- [Account/dagplan-implementatie en testscope](COMPLETION-ACCOUNTS-QA-2026-11-14.md).
- [Consument/SEO/browseracceptatie](COMPLETION-CONSUMER-QA-2026-11-14.md).
- [Portal-ontvangstcontract](PORTAL-CONTRACT-v1.md) en [latere aansluiting](PORTAL-ONBOARDING.md).

Nieuwe tabellen zijn additief. Oude dossiers worden niet door een datamigratie herschreven. Geen automatische leadretentie/wissing; de beoordelingslijst is dry-run. Pseudonieme analytics-cleanup vereist apart beleidsakkoord. De huidige beheerauthenticatie ondersteunt één identiteit; een tweede medewerker krijgt niet stilzwijgend gedeelde credentials.

## 4. Concreet productie-GO/HOLD

| Dienst | Besluit nu | Ontbrekend bewijs/besluit |
| --- | --- | --- |
| Gratis tools en kennis | Technische publicatie toegestaan binnen bestaande opdracht | Nieuwe deployment en browsergate verifiëren; geen registratie vereisen. |
| Algemene adviesvragen / woningadvies | **HOLD**, afzonderlijke flags | Productie-MySQL-/beheer-/rechten-/restoreproef, echte bevestiging én interne ontvangst, NIVO-proces/privacyakkoord, expliciete publieke GO. |
| Mijn Zonlio / dagplaninschrijving | **HOLD**, afzonderlijke flags | Echte login-/double-opt-in-/profiel-/afmeldketen, gegevensrechten en inboxauthenticatie, expliciete GO. |
| Automatische dagmails | **HOLD** | Minstens drie succesvolle cronruns en hervatting na restart; werkelijke dagplanontvangst/afmelding, quota/alerts en bounceafhandeling, eigen GO. |
| Portal-export | **UIT** | Ontvanger later gereed, eigen beveiligde aansluitacceptatie. Blokkeert zelfstandig Zonlio niet. |

De reeds toegestane ene eigenaarstest wordt alleen via een veilige bestaande UI uitgevoerd nadat de betreffende publieke vrijgave of een expliciet goedgekeurde geïsoleerde testroute bestaat. Er is geen verborgen bypass toegevoegd. Privétestgegevens uit eerdere gesprekken zijn niet naar GitHub gekopieerd.

## 5. Nog werkelijk benodigde eigenaarshandelingen

1. **Hostingbeheer:** installeer de concrete cron uit het operationsrunbook; controleer databaseback-up en herstel uitsluitend naar een aparte database volgens het restorehoofdstuk.
2. **Veilige eigen ketentest:** account, profiel, dagplanopt-in/afmelding, één woningdossier, interne/transactionele inbox, contactstop en gegevensrechten. Deel alleen geschoonde uitslagen; geen nieuwe testpersoon of privégegevens in chat/GitHub.
3. **NIVO-besluiten:** werkgebied/diensten, realistische reactietermijn/contactpogingen, Pim-vervanging en bevoegde beheerder; conceptbewaarbeleid en bezoekersinformatie goedkeuren.
4. **Afzonderlijke vrijgave:** pas na bovenstaande bewijs per dienst GO; Portal blijft uit.

Tot deze echte toegangs-/vrijgavepoorten zijn vervuld is “volledig zelfstandig bedrijfsklaar” niet bewezen. Het resterende werk is concreet en vereist geen nieuwe architectuur, logo, bekende bedrijfsgegevens of Portal-ontwikkeling.
