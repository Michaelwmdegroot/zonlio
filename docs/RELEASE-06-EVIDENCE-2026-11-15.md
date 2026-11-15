# Zonlio Release 06 — bewijsregister eigen productieacceptatie

**Datum:** 15 november 2026 (Europe/Amsterdam). **Actieve, extern bevestigde applicatiemarker:** `owner-acceptance-06-20261115`. **Status:** technische oplevering **LIVE**, maar echte end-to-end aanvraag, twee inboxberichten, gecontroleerde herstart, databaseherstel en commerciële vrijgave **OPEN**. Dit is geen GO voor bezoekers.

## GitHub-mutaties en gescheiden bewijslagen

| Onderdeel | Werkelijk bewijs | Status |
| --- | --- | --- |
| Veilige eigenaarstest zonder publieke flags | [PR #19](https://github.com/Michaelwmdegroot/zonlio/pull/19), squash `da4694964f2725d62971583a223c95df16ec136a` | Geïmplementeerd |
| Twee mailstatussen per dossier, unieke release-ID en echte productieassetcontrole | [PR #20](https://github.com/Michaelwmdegroot/zonlio/pull/20), squash `928ad4fa0c7b7018e600fce79068be7c6e856606` | Geïmplementeerd |
| Release 06 Node.js24, unit-, contract- en MySQL8-gate, dependency-audit en build | [main Actions 43659735608](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43659735608) | **PASS** |
| Release 06 Chromium + WebKit, 320/375/390/1440px synthetische browserflows | [main Actions 43659735523](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43659735523) | **PASS** |
| Live productieversie en statische assets, publieke routes, private routebescherming | [Observatie 43659814682](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43659814682), 15 november **00:46:34 UTC** | **PASS: verwachte = waargenomen marker 06, nieuw acceptatie-JS aanwezig** |
| Werkelijke DB-/cron-heartbeat, bronnen en huidige cronverwachtingsvlag | [Operations 43659859906](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43659859906), 15 november **00:46:55 UTC** | **PASS: databaseReady=true; lastMaintenanceAt=00:45:02.604Z; sourcesReady=true** |
| Herhaalde echte ticks | [Operations 43657748765](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43657748765) (00:20:02.212Z); [43659268224](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43659268224) (00:35:01.847Z); 43659859906 (00:45:02.604Z) | **Bevestigd: verschillende opeenvolgende onderhoudstijdstempels; nog geen restartbewijs** |
| Werkelijk intern klantdossier via privé admin | Eigen acceptatieprocedure [hier](OWNER-ACCEPTANCE-06-2026-11-15.md) | **OPEN: nog niet uitgevoerd in deze overdracht** |
| MySQL-persistentie **na gecontroleerde Hostinger-appherstart** | Minimaal twee nieuwe ticks en één ongewijzigde testreferentie na herstart | **OPEN** |
| SMTP-acceptatie van beide dossiermails én ontvangst in afzonderlijke echte inbox | Privé dossier / Apple Mail, zonder PII in GitHub | **OPEN** |
| Privacycorrectie/intrekking/wissing, herstelregister en onafhankelijke DB-restore | Privé beheer en een herstelproef naar andere database | **OPEN** |
| Magic link, double opt-in, dagplan en echte afmelding | [Issue #9](https://github.com/Michaelwmdegroot/zonlio/issues/9) | **CI-getest, echte productie-E2E OPEN** |
| Publieke leads, accounts, dagmail, marketing en Portal | NIVO/eigenaar beslispoort per dienst | **HOLD / GEEN GO** |

## Exacte actieve productiesignalen

De onafhankelijke **read-only** productiecontrole van marker 06 rapporteerde op 15 november 00:46:34 UTC:

- `releaseMatches=true`, `publicChecksPassed=true` en `ownerAcceptanceAssetPresent=true`.
- `databaseReady=true`, `adminConfigured=true`, `mailConfigured=true` en NIVO-identiteitschecks passend.
- `leadEnabled=false`, `housingAdviceEnabled=false`, `accountsEnabled=false`, `subscriptionsEnabled=false`, `dailySendEnabled=false`, `portalExportEnabled=false`.
- `productionEndToEndVerified=false` **zoals het hoort totdat een echte eigenaarstest voltooid is**.
- De externe cronwatch zag `cronExpected=false`, `cronStatus=not_required`: er is wel herhaald onderhoud, maar **een missende-cronalarm is daarmee niet actief bewezen**. Zet de alarmgate pas met passende goedkeuring en controle aan.

Dit zijn geen credentials, geen testpersoonsgegevens, geen bewijs van mailboxbezorging en geen claim dat een technische merge automatisch een commerciële release is.

## Nieuw functioneel bewijs: wat betekent de veilige eigenaarstest?

1. De ingelogde eigenaar kan in `/admin` de **Productieacceptatie · eigen test** openen en één eigen algemene aanvraag of woningadvies doen, zonder `LEAD_ENABLED` of `HOUSING_ADVICE_ENABLED` aan te zetten. Alle testgegevens blijven in de afgeschermde website.
2. Backend vereist adminsessie, CSRF, eigen beheer-e-mailadres en uitdrukkelijke eigen-testbevestiging; werkelijke inputvalidatie, transactionele MySQL-opslag, unieke aanvraagreferentie, Pim-registratie, history en bestaande outbox worden hergebruikt.
3. De extra tabel `zonlio_acceptance_leads` is **additief**. Acceptatiedossiers zijn apart opvraagbaar en vervuilen gewone lead-KPI's, NIVO-`Nu opvolgen` en latere Portal-export niet; ook wijziging/privacywissing creëert geen Portal-event.
4. De normale outbox maakt maximaal twee relevante dossierberichten aan. Testberichten dragen `[TEST]`, geven geen fictief contactmoment en blijven gebonden aan mailpauze/budget. **Een wachtend bericht is niet verstuurd.**
5. In het afgeschermde dossier staat nu per bericht **in behandeling / wachtend / mislukt / geannuleerd / SMTP-geaccepteerd**, het tijdstip en alleen een technische foutcode. **SMTP-geaccepteerd is geen inboxontvangst**, die moet apart worden vastgesteld.

## Veilig noodzakelijke eigenaaracceptatie

- Via een **privé beheerlogin**, niet hier of in GitHub: voer één woningadvies-eigenaarstest uit met uitsluitend eigen gegevens, bevestig, kopieer alleen het `ZON-...`-referentienummer naar een *privé* verificatienotitie, controleer Pim, twee mailregels en of gewone publieke aanvragen gesloten blijven.
- Controleer in de eigen mailbox twee werkelijk ontvangen testberichten plus spam en authenticatieresultaten. `MAIL_SEND_PAUSED` is niet publiek zichtbaar; als de effectieve pauze aanstaat, claim geen bezorging. Een change aan die pauze of andere live mailinstelling vereist een bewuste beheerdershandeling, geen geautomatiseerde bypass.
- Test intrekking/wissing en **ná een gecontroleerde Hostinger-herstart** opslagpersistentie en twee volgende onderhoudstijdstempels. Daarna een bestaande backup naar een **andere** MySQL-database herstellen, leesbaar valideren en tegen het privé herstelregister controleren; nooit productie overschrijven. Documenteer resultaat alleen geanonimiseerd.
- Formele NIVO-controle op privacy, retentie en SOP, plus afzonderlijke commerciële vrijgave voor leads/account/dagmail, blijven vereist; **Portal blijft uit**.

## Nog te valideren vóór opschaling

- `OPS_EXPECT_CRON` is runtime nog niet ingeschakeld; alarmbewijs en werkelijk ontvangen operationele alerts ontbreken.
- SPF/DKIM/DMARC en RFC8058 eenklikafmeldheaders op werkelijk ontvangen transactie- en dagmail ontbreken, hoewel broncode/DNS-readonly tests bestaan.
- Verwerking van vertraagde bounces/klachten, concrete retentietermijnen, salesverantwoordelijkheden, fysieke Safari en Search Console/indexatie blijven open.
- Geen A/B-winst of SEO-verkeer claimen zonder echte metingen.

**Onderliggende eisen:** [masterchecklist](COMPLETION-MASTER-CHECKLIST-2026-11-14.md), [eigenaaracceptatie](OWNER-ACCEPTANCE-06-2026-11-15.md), [operations](AUTONOMOUS-OPERATIONS.md), [privacy/herstel](PRIVACY-OPERATIONS.md), [issues #1](https://github.com/Michaelwmdegroot/zonlio/issues/1), [#2](https://github.com/Michaelwmdegroot/zonlio/issues/2), [#3](https://github.com/Michaelwmdegroot/zonlio/issues/3), [#9](https://github.com/Michaelwmdegroot/zonlio/issues/9), [#10](https://github.com/Michaelwmdegroot/zonlio/issues/10), [#11](https://github.com/Michaelwmdegroot/zonlio/issues/11).
