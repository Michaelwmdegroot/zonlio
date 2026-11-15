# Zonlio Release 07 — eigenaaracceptatie accounts + autonome cronbewaking

> **Aanvullende onafhankelijke geplande waarneming:** [GitHub Actions run 43665253403](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43665253403) controleerde op 2026-11-15 **01:54:32.666 UTC** dat `databaseReady=true`, `sourcesReady=true`, `heartbeatTracked=true`, `heartbeatFresh=true`, `monitoredCronStatus=current`; laatste MySQL-onderhoud was **01:50:03.548 UTC**. Dit verlengt het bewijs van autonome, herhaalde cronwerking. Een gecontroleerde **appherstart**, daadwerkelijke ontvangst van een incidentalert, echte lead-/accountinbox en onafhankelijke MySQL-restore blijven onbewezen. Zie [afgesloten fase-07-overdracht](HANDOFF-PHASE07-CLOSEOUT-2026-11-15.md).


**Peildatum:** 15 november 2026 (Europe/Amsterdam). **Productiemarker:** `owner-qa-07-20261115` — onafhankelijk waargenomen. **Oordeel:** release **technisch LIVE**; **commerciële vrijgave HOLD**. Dit is nadrukkelijk geen echte volledige aanvraag-, mailbox-, account-, restore- of dagmail-E2E.

## Werkelijk geverifieerd bewijs

| Onderdeel | Exacte verificatie | Resultaat |
| --- | --- | --- |
| Veilige leadacceptatie | [PR #19](https://github.com/Michaelwmdegroot/zonlio/pull/19) en [#20](https://github.com/Michaelwmdegroot/zonlio/pull/20) | Admin-only eigen lead, transactionele opslag/mail, testisolatie, twee zichtbare SMTP-statussen |
| Mijn Zonlio eigen loginlink | [PR #22](https://github.com/Michaelwmdegroot/zonlio/pull/22), merge `373517abdd05d45ade0f6f28a762d71ff72fa9c8` | Admin-only, CSRF + bevestiging, alleen bestaand beheeradres, publieke accountgate gesloten, selectieve mailclaim |
| Release07 Node 24 / echte MySQL 8 / npm check, test, build, audit | [main-run 43661192662](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43661192662) | **PASS** |
| Release07 browseracceptatie, inclusief afgeschermde accounttest-UI | [main-run 43661192613](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43661192613) | **PASS** — synthetisch op Chromium/WebKit |
| Externe read-only controle van werkelijk gedeployde release07 | [main-run 43661273936](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43661273936) op 15 nov 01:04:28 UTC | **PASS**: verwacht/waargenomen `owner-qa-07-20261115` gelijk, 23 openbare probes, beide eigenaarstestassets aanwezig |
| Live MySQL/cron, na release07-deploy | [main-run 43661319635](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43661319635) op 15 nov 01:04:42 UTC | **PASS**: DB bereikbaar, bronnen gereed, echt `lastMaintenanceAt=2026-11-15T01:00:03.330Z`; `cronExpected=false` |
| Onafhankelijke alarmverbetering | [PR #23](https://github.com/Michaelwmdegroot/zonlio/pull/23), merge `0e9f0bf2ee48b15f477aecee68b4a909444e22ba` | Verouderde eerder bewezen cronheartbeat (>20 minuten) wordt door de externe GitHub-watch gesignaleerd, zelfs wanneer runtime `OPS_EXPECT_CRON=false` is |
| Werkelijk externe operations-watch na PR #23 | [run 43661638445](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43661638445), 15 nov 01:08:37 UTC | **PASS**: `heartbeatTracked=true`, `heartbeatFresh=true`, `monitoredCronStatus=current`; nieuwe MySQL-tick `01:05:02.682Z`, ondanks `cronExpected=false` |
| Nieuwste main MySQL/Node/browsers na PR #23 | [main check 43661523427](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43661523427), [main browser 43661523399](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43661523399) | **PASS** |
| Publieke release + assets na PR #23 | [observe 43661589822](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43661589822) | **PASS**; dezelfde release 07 marker, geen nieuwe account/lead/dagmailvrijgave |
| Bron van waarheid release06-evidence | [Release 06](RELEASE-06-EVIDENCE-2026-11-15.md) | Vorige algemene P0-acceptatie en cron-tijdreeks blijven geldig |

De nieuwe externe watchdog is uitsluitend **read-only**: hij leest openbare `/api/health`, veroorzaakt geen cronwerk, geen SMTP en geen toegang tot privégegevens. Voor een nieuw systeem zonder opgeslagen tick blijft expliciete cronmonitoring via `OPS_EXPECT_CRON=true` van belang. Het bewijs dat GitHub Actions het alarm zal produceren bij een gesimuleerde verouderde heartbeat komt uit geautomatiseerde tests; een echte productiestoring en daadwerkelijk ontvangen beheerwaarschuwing zijn **niet** veroorzaakt of aangetoond.

## Welke productiepoorten bleven uit?

De onafhankelijke observatie na Release07 zag `leadEnabled=false`, `housingAdviceEnabled=false`, `accountsEnabled=false`, `subscriptionsEnabled=false`, `dailySendEnabled=false` en `portalExportEnabled=false`. Mailconfiguratie en database waren bereikbaar. `MAIL_SEND_PAUSED` is niet in publieke observatie opgenomen; niet speculeren over de effectieve runtimepauze. **De reeds ingestelde Hostinger-cron en eerdere werkende losse SMTP-test hoeven niet opnieuw geïnstalleerd of uitgevoerd te worden.**

## Twee nieuwe privé-eigenaaracceptatieroutes

1. [Algemene/woningadvies-eigenaarstest](OWNER-ACCEPTANCE-06-2026-11-15.md): in `/admin` via eigen NAW/e-mail, werkelijke MySQL/Pim, interne mail + klantbevestiging, intrekking en privacy. Test wordt uitgesloten van commerciële metrics en Portal.
2. [Mijn Zonlio-accounttest](OWNER-ACCOUNT-ACCEPTANCE-2026-11-15.md): in `/admin` uitsluitend een eigen inloglink naar beheeradres aanvragen. Controleer daadwerkelijke inbox, eigen expliciete bevestiging op `/mijn`, eenmaligheid/hergebruik, profiel, export, verwijderen; dit creëert **geen** dagmailabonnement, marketingtoestemming of advieslead.

Alle formulier- en mailtokens, adresgegevens en wachtwoorden blijven uitsluitend in de eigen afgeschermde omgeving. Geen privégegevens in GitHub, screenshots of AI-chat. SMTP-geaccepteerd is niet hetzelfde als aangekomen.

## Werkelijk nog OPEN — nooit op basis van CI afvinken

- [ ] Eén **echte** eigen NIVO-adviesaanvraag in productie met zichtbaar MySQL-dossier, Pim-opvolging, beide werkelijk ontvangen e-mails, status/intrekking/privacy.
- [ ] Eén **echt** ontvangen account-loginlink, bewuste bevestiging, profielpersistentie, verval/hergebruik en privé-rechtenflow.
- [ ] Beheerder voert gecontroleerde appherstart uit; controleer behoud van het testdossier en minimaal twee volgende cron-tijdstempels.
- [ ] Huidige Hostinger-back-up herstellen **naar een afzonderlijke database**, read-only checker draaien en stop-/wissingbewijs toetsen zonder live data te wijzigen.
- [ ] Echte separate double opt-in, dagplanmail, pauze/afmelding en ontvangende headers (SPF/DKIM/DMARC, RFC8058); asynchrone bounces/klachten.
- [ ] Juridische NIVO-goedkeuring definitieve bewaartermijnen, contactprocedures, personeelsrechten/Pim-fallback en operationele alarmontvangst.
- [ ] Technische SEO-indexatie, Search Console en fysieke iPhone/Safari waar beschikbaar, werkelijke kwalitatieve leads/afspraken/offertes; geen fictieve KPI's.
- [ ] Afzonderlijk expliciet commerciële GO per publieke functie. **Portal-export blijft uit.**

**Projectbesturing:** [README](../README.md) · [masterchecklist](COMPLETION-MASTER-CHECKLIST-2026-11-14.md) · [runbook](AUTONOMOUS-OPERATIONS.md) · [Privacy/restore](PRIVACY-OPERATIONS.md) · issues [#1](https://github.com/Michaelwmdegroot/zonlio/issues/1), [#2](https://github.com/Michaelwmdegroot/zonlio/issues/2), [#3](https://github.com/Michaelwmdegroot/zonlio/issues/3), [#9](https://github.com/Michaelwmdegroot/zonlio/issues/9), [#10](https://github.com/Michaelwmdegroot/zonlio/issues/10), [#11](https://github.com/Michaelwmdegroot/zonlio/issues/11).
