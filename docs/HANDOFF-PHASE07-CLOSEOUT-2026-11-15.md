# Zonlio — afsluiting ontwikkelfase 07 en definitieve voortzetting

**Peildatum:** 15 november 2026 (Europe/Amsterdam). **Projectstatus:** fase 07 technisch afgerond en live; volledige productie-E2E en commerciële lancering **HOLD**. Dit document is vanaf deze datum de eerste ingang voor de volgende agent. De eerdere handoffs en releasebestanden blijven historisch bewijs, niet een nieuw bouwverzoek.

## 1. Vaststaande projectgrenzen

- **Website:** https://zonlio.nl · **Repository:** https://github.com/Michaelwmdegroot/zonlio · **productiebranch:** `main` met automatische Hostinger-uitrol.
- **Product:** gratis, premium Nederlandse stroom-/woningplanningsomgeving die bruikbaar blijft zonder account, en na afzonderlijke vrijwillige toestemming kwalitatieve adviesaanvragen voor NIVO ontvangt. Resultaat vóór contactgegevens; geen gegarandeerde besparing of fictieve energietarieven.
- **Stack:** Hostinger Node.js 24, Express, MySQL in productie, SQLite uitsluitend lokaal/synthetische CI, bestaande SMTP en het centrale lichte Blue Glass-design in `src/design-system.css`. Geen nieuwe betaalde diensten, extra stagingfase of frameworkmigratie.
- **Exploitant/ontvanger:** NIVO Groep Holland BV · KvK 95227768 · Lireweg 52, 2153 PH Nieuw-Vennep · contact/privacy `info@zonlio.nl`. **Pim** is opvolglabel, niet een aparte accountrol.
- **Onafhankelijk:** de Hostinger-cron en productiedatabase hebben geen draaiende Mac, Codex, ChatGPT-sessie of NIVO Portal nodig. Menselijke salesopvolging en operationeel privacy-/incidentbeheer blijven verplicht.
- **Latere route:** Zonlio → NIVO Portal → bestaande Odoo-connect → Odoo. Het Zonlio-contract v1 is gebouwd en getest. `PORTAL_EXPORT_ENABLED=false` blijft **ongewijzigd**; geen rechtstreekse Odoo-koppeling.
- **Toestemmingsgrenzen:** gratis rekentool, NIVO-advies, Mijn Zonlio, dagmail-double-opt-in, marketing en statistieken zijn afzonderlijke doelen. Niets aan elkaar koppelen op basis van een account of nieuwsbrief.

## 2. Werkelijk geverifieerde uitgangspositie

| Bewijs / tijd | Verifieerbaar feit | Bewijsgrens |
| --- | --- | --- |
| Laatste `main` vóór deze closeout: `a8773d167a2282eed315a93aa29c907802281112` | Release 07-appcode plus documentatie, geen open functionele PR's. | Bij nieuwe wijzigingen altijd nieuwe SHA controleren. |
| [Main Check application 43661974324](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43661974324) | **SUCCESS** Node24, tests, echte MySQL8-gate, build en dependency-audit. | Geen echte Hostinger-databaseherstelproef. |
| [Main Consumer browser acceptance 43661974364](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43661974364) | **SUCCESS** Chromium en WebKit, synthetische API/SMTP en layoutchecks. | Geen fysieke iPhone/Safari of echte inbox. |
| [Publieke productieobservatie 43662047193](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43662047193) om 2026-11-15 **01:13:55 UTC** | **SUCCESS**, verwachte = werkelijke marker `owner-qa-07-20261115`, 23 read-only GET-checks inclusief beide eigenaarstestassets; MySQL en mail geconfigureerd. | Alleen veilige publieke GET, geen echte testlead/account. |
| [Laatste geplande onafhankelijke operations-watch 43665253403](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43665253403) om 2026-11-15 **01:54:32 UTC** | **SUCCESS**, `databaseReady=true`, `sourcesReady=true`, `heartbeatTracked=true`, `heartbeatFresh=true`, `monitoredCronStatus=current`; laatste duurzaam opgeslagen tick `2026-11-15T01:50:03.548Z` (02:50:03 NL). | Meerdere echte ticks zijn bewezen, maar geen **gecontroleerde appherstart met twee nieuwe ticks** of ontvangen incidentmelding. |
| Productieconfiguratie bij bovenstaande release-observatie | `leadEnabled=false`, `housingAdviceEnabled=false`, `accountsEnabled=false`, `subscriptionsEnabled=false`, `dailySendEnabled=false`, `portalExportEnabled=false`. | `MAIL_SEND_PAUSED` is niet publiek bewezen; niet gokken over effectieve runtimewaarde. |
| Eigenaarbevestiging vóór fase 07 | Hostinger-cron iedere vijf minuten aangemaakt, losse echte SMTP-testmail ontvangen, Hostinger-mailboxplafond 100 uitgaande mails/24 uur. | Geen bewijs dat de volledige lead-/account-/dagmailketen werkelijk in de inbox aankomt. |

**Betekenis:** De eerste zelfstandige technische bedrijfsbasis is **gebouwd, CI-bevestigd en in de publieke productie via GET waargenomen**. De volledige commerciële definitie van gereed is **niet** bereikt. Geen subjectief voltooiingspercentage publiceren als bewijs.

## 3. Wat is al af en hoeft niet opnieuw gebouwd?

| Onderdeel | Status, geen overschatting |
| --- | --- |
| Publieke gratis stroomtools, planner, zonnepanelen-2027 en indicatief batterijjaarplan | Gebouwd, visueel eigenaar-goedgekeurd, live productobservatie; echte prijs-/weerbronnen en eerlijke rekenaannames. |
| Lichte premium Blue Glass-stijl, herkenbaar Zonlio-logo, responsive systeem | Gebouwd, centrale styles, desktop/mobiele synthetische browseracceptatie. |
| Mijn woningplan en NIVO-adviesvraag | Gebouwd met woningintake, expliciet contactbewijs, idempotentie, revisies en optionele rekenprofieloverdracht; publieke verwerking staat uit. |
| MySQL-backoffice | Gebouwd met afgeschermde sessie/CSRF, dossierstatussen, notities, privacyexport/wissing, mail- en operationsstatus. |
| Pim-werkvoorraad | Nieuwe NIVO-dossiers krijgen Pim-label en interne taak; `Nu opvolgen`, filters en daadwerkelijk vastgelegde salesmijlpalen. Geen automatisch bellen of gefingeerde afspraken. |
| Leadmail/outbox/quota | Transactionele queues, retries en gedeeld budget gebouwd en CI-/MySQL-getest; eerder is één losse echte SMTP-testmail ontvangen. |
| Mijn Zonlio/dagplan | Magic links, profiel, re-login, accountgegevensrechten, apart dubbel opt-in, ochtend-/avonddagplan en unsubscribe gebouwd en CI-/browsergetest; publieke gates uit. |
| Automatische Hostinger-cron | Reële herhaalde DB-heartbeats zichtbaar, symlinkfix voor `hbuilds/current` al gemerged. Geen tweede cronjob aanmaken. |
| Externe storingswaarneming | GitHub Actions-watch leest alleen health; na PR #23 wordt een eerder waargenomen cron met >20 minuten oude heartbeat als storing gesignaleerd ook bij `OPS_EXPECT_CRON=false`. Periodieke watch is geen realtime garantie of bewezen menselijke melding. |
| SEO/funnelbasis | Zes statische landingspagina's, sitemap, canonicals, structured data, consentbewuste eventtellingen en bronmodule-rapportage. Geen claim van bewezen indexatie/rankings of echte conversie. |
| Privacy/restorevoorbereiding | Verificatie vóór export/correctie/wissing, stopregister, herstelmanifest en read-only restorechecker gebouwd. Formeel bewaarbeleid en echte aparte DB-restore open. |
| Portal | Pull/ack/stop v1 contract en synthetische tests gereed aan Zonlio-kant; export blijft uit. |
| Afgeschermde eigenaarstests | [PR #19](https://github.com/Michaelwmdegroot/zonlio/pull/19), [#20](https://github.com/Michaelwmdegroot/zonlio/pull/20) en [#22](https://github.com/Michaelwmdegroot/zonlio/pull/22): uitsluitend bevoegde admin kan eigen aanvraag/own-email magic link door echte MySQL/SMTP-keten testen zonder publieke gates. [Release 07](RELEASE-07-EVIDENCE-2026-11-15.md). **Echte indiening/ontvangst niet bewezen.** |

## 4. Openstaand P0 — noodzakelijk vóór publieke leadvrijgave

| Stap | Concreet te doen / acceptatiebewijs | Eigenaar alleen waar nodig | Issues |
| --- | --- | --- | --- |
| **P0-A. Echte NIVO-advies-E2E** | Via afgeschermde `/admin` één reeds toegestane **eigen** algemene of woningadvies-testaanvraag; aantoonbare MySQL-opslag, referentie, Pim-taak, toestemming, mailstatus **beide** transactionele mails, echte inboxontvangst NIVO + aanvrager, geen dubbele aanvraag, revisie/intrekking en desgewenst geverifieerde privacywissing. Testdossier is gemarkeerd en gescheiden van gewone KPI's/Portal. | Eigen persoonsgegevens uitsluitend privé in beveiligde UI, testmail in eigen bevoegde inbox bekijken; geen PII in GitHub/chat. | [#1](https://github.com/Michaelwmdegroot/zonlio/issues/1), [#2](https://github.com/Michaelwmdegroot/zonlio/issues/2) |
| **P0-B. Cron na bewuste herstart** | Eén door bevoegd beheer gecontroleerde Hostinger-appherstart; vóór/na vergelijking van opgeslagen testreferentie en minimaal twee **nieuwe, geplande** ticks. Bestaande cronhistorie behouden. Externe watch na herstart groen, later werkelijke ontvanger voor mislukte monitor bevestigen. | Alleen appherstart in Hostinger indien agent geen toegangsrechten heeft; geen secrets of volledige .env delen. | [#2](https://github.com/Michaelwmdegroot/zonlio/issues/2), [#10](https://github.com/Michaelwmdegroot/zonlio/issues/10) |
| **P0-C. Afzonderlijk backupherstel** | Huidige Hostinger-MySQL-backup herstellen naar **andere** DB, daarna bestaande `scripts/verify-restore.mjs` alleen read-only, met privé herstelregister en controleren of contactstops/correcties/wissingen niet kunnen herleven. Productie niet overschrijven en geen oude queue zomaar opnieuw verzenden. | Bevoegde backup-/DB-handeling in Hostinger; agent kan scripts/tests/docs zelfstandig onderhouden. | [#1](https://github.com/Michaelwmdegroot/zonlio/issues/1), [#3](https://github.com/Michaelwmdegroot/zonlio/issues/3) |
| **P0-D. Privacy/operationeel besluit** | NIVO bekrachtigt bewaarschema en AVG-teksten, werkgebied, diensten, realistische reactietermijn, contactpogingen, vervanger Pim, geautoriseerde NAW-inzage en incident-/mailboxbeheer. Geen onbevestigde beloftes. | Alleen definitieve beleids-/bevoegdheidskeuzes, niet opnieuw KvK of bedrijfsnaam. | [#3](https://github.com/Michaelwmdegroot/zonlio/issues/3), [#10](https://github.com/Michaelwmdegroot/zonlio/issues/10) |
| **P0-E. Afzonderlijke commerciële GO** | Na concrete acceptatie krijgt **iedere** publieke vlag apart expliciet GO/HOLD: `LEAD_ENABLED`, `HOUSING_ADVICE_ENABLED`, `MEMBER_ACCOUNTS_ENABLED`, `DAYMAIL_SIGNUP_ENABLED`, `DAYMAIL_SEND_ENABLED`. Check effectieve flags na deploy, gecontroleerde live E2E en terugvaloptie. `PORTAL_EXPORT_ENABLED=false` behouden. | Eigenaar keurt ieder relevant publiek kanaal expliciet goed; gewone PR-merges zijn geen toestemming. | [#3](https://github.com/Michaelwmdegroot/zonlio/issues/3) |

## 5. Openstaand P1 / P2 na of parallel aan P0

- **P1-A Mijn Zonlio echte acceptatie [#9](https://github.com/Michaelwmdegroot/zonlio/issues/9):** privé eigen magic-linktest uit `/admin`, bericht daadwerkelijk ontvangen, bewuste bevestigings-POST, enkelvoudig gebruik/expiratie, profiel bewaren/herlogin/export/verwijderen. Publieke accountflag niet activeren om deze test te kunnen doen. [Eigen accountprotocol](OWNER-ACCOUNT-ACCEPTANCE-2026-11-15.md).
- **P1-B Dagmail volledige keten [#9](https://github.com/Michaelwmdegroot/zonlio/issues/9):** aparte double opt-in, ochtend-/avonddagplan met werkelijk gepubliceerde tariefdata, onbruikbare brondata, dubbele cron, verzendbudget, pauze, unsubscribe en one-click/headerbewijs; pas met specifieke eigenaarvrijgave. Accounttest alleen is geen dagmailproof.
- **P1-C E-mailoperations [#2](https://github.com/Michaelwmdegroot/zonlio/issues/2)/[#10](https://github.com/Michaelwmdegroot/zonlio/issues/10):** werkelijk ontvangen SPF/DKIM/DMARC en RFC8058 headers, uitgaand gedeeld appbudget ≤ bestaand Hostinger-plafond 100/rollende 24h, bounces/klachten en suppressie, backoff en verantwoordelijke inboxcontrole. Geen nieuw betaald platform.
- **P1-D NIVO-werkproces [#10](https://github.com/Michaelwmdegroot/zonlio/issues/10)/[#11](https://github.com/Michaelwmdegroot/zonlio/issues/11):** interne SOP en bevoegdheden/formele toegangsrollen, beheer-alertontvangst, opvolgactie en storingsherstel op een systeem dat geen Mac nodig heeft.
- **P1-E Growth/SEO [#11](https://github.com/Michaelwmdegroot/zonlio/issues/11):** sitemap/canonicals/indexatie/GSC, Core Web Vitals en mobiele Safari, inhoudelijke pagina's en premium interacties, conversion-UX na gratis inzicht, bron→daadwerkelijke lead→kwalificatie→afspraak/offerte/gewonnen per cohort. Geen verzonnen bezoekers/ROI/leadkwaliteitscijfers.
- **P2-A Geavanceerde PV-/batterij-/AI-berekeningen [#5](https://github.com/Michaelwmdegroot/zonlio/issues/5):** pas na P0, meetplan en backtest, bronlicenties/uncertainty. Niet blokkerend voor veilige eerste commerciële vrijgave.
- **Later Portal:** [contract](PORTAL-CONTRACT-v1.md) en [onboarding](PORTAL-ONBOARDING.md) blijven klaar. Portal-uitrol door andere projectfase, **nu geen export**.

## 6. Aanwezige runbooks, code en reproduceerbare controles

- **Begin:** `AGENTS.md`, `README.md`, deze overdracht, `docs/RELEASE-07-EVIDENCE-2026-11-15.md`, [eigen test-advies](OWNER-ACCEPTANCE-06-2026-11-15.md), [eigen account-test](OWNER-ACCOUNT-ACCEPTANCE-2026-11-15.md), [masterchecklist](COMPLETION-MASTER-CHECKLIST-2026-11-14.md), [eigenaarspoorten](OWNER-INPUT-AND-GATES-2026-11-14.md), [NIVO SOP](NIVO-FOLLOWUP.md), [opsrunbook](AUTONOMOUS-OPERATIONS.md), [privacy/restore](PRIVACY-OPERATIONS.md).
- **Backend:** `server.mjs`, `server/backend.mjs`, `server/store.mjs`, `server/member-store.mjs`, `server/members.mjs`, `server/mail.mjs`, `server/operations*.mjs`, `server/privacy-store.mjs`, `server/portal.mjs`, `server/release.mjs`.
- **Browser/UI:** `src/app.mjs`, `src/leads.mjs`, `src/housing-advice.mjs`, `src/member.mjs`, `src/admin.mjs`, `src/admin-acceptance.mjs`, `src/design-system.css`.
- **Ops/scripts:** `scripts/maintenance.mjs`, `scripts/operations-watchdog.mjs`, `scripts/production-smoke.mjs`, `scripts/verify-restore.mjs`, `scripts/mail-dns.mjs`.
- **CI:** `.github/workflows/check.yml`, `browser-qa.yml`, `production-observe.yml`, `operations-watch.yml`.
- **Reproduceer:** `npm ci`, `npm run check`, `npm test`, `npm run build`; MySQL8-gate in GitHub CI met expliciete testdatabase; `npm run test:browser -- chromium`, `npm run test:browser -- webkit`; externe GET-observatie. *Geen productie-E2E concluderen uit synthetische fake SMTP of MySQL8 CI.*

## 7. Bewijs, rechten en commerciële bescherming

- Houd **alle** publieke gates uit tot elk een expliciet apart eigenaar-GO heeft; `PORTAL_EXPORT_ENABLED=false` blijft uit totdat NIVO Portal als ontvanger gereed is. Een technische merge is geen marketing- of privacyvrijgave.
- Huidige externe watch controleert een eerdere werkelijke cron binnen **20 minuten**; de GitHub-workflow zelf draait volgens planning rond minuut **17 en 47 UTC** en op een geslaagde deploymentobservatie. Een storing wordt dus niet gegarandeerd precies na 20 minuten gemeld. Menselijke ontvangst en herstel moeten apart bewezen worden.
- `MAIL_SEND_PAUSED` was door eigenaar als `true` in hPanel beschreven, maar de **effectieve runtimepauze** is niet onafhankelijk bevestigd. Geen langdurig schakelaar-discussiecircuit; toets alleen wanneer een echte geautoriseerde inboxproef plaatsvindt en omzeil de pauze nooit.
- Geen echte persoonsgegevens, test-adressen, volledige cookies/headers, ruwe mailtokens, passwords, server-.env, backupbestanden of mailinboxinhoud in GitHub/docs/chat of screenshots opnemen.
- Werk in kleine branches, open PR, wacht op Node24/MySQL8/Chromium/WebKit, merge zonder force-push, controleer daarna exact de live marker en de operationele herhaling; wijzig geen bestaande goede hostinginstellingen zonder aantoonbare fout.
- Markeer bewijs altijd precies **gebouwd**, **CI-getest**, **live via read-only GET waargenomen**, **door eigenaar in privé bevestigd**, **echt productie-E2E bevestigd** of **nog niet bewezen**. Sluit issues alleen met passend bewijs.

## 8. Echte afhankelijkheden van de eigenaar (alleen wanneer nodig)

De eigenaar heeft **al** bevestigd: domein, hosting, repo, exploitant, Pim, branding, mailadres, bestaande cronjob en één eigen testaanvraag. Vraag deze niet opnieuw. Voor de resterende P0 is alleen de bevoegde privéhandeling nodig: (1) eigen testaanvraag en inbox + eigen accountlink + status/stop/privacy beoordelen; (2) gecontroleerde Hostinger-appherstart; (3) herstel van een actuele backup naar een aparte testdatabase; (4) formeel NIVO privacy-/SOP- en commerciële GO per functie. Als hPanel of privé inbox ontoegankelijk is voor de agent: vraag één exacte minimale actie en werk ondertussen aan onafhankelijke code/SEO/QA. De vier genoemde soorten bewijzen zijn nog **niet** als voltooid geaccepteerd.

## 9. Fase-afsluiting en volgende agent

Release 07 is technisch live en de geplande cron draait aantoonbaar door, zonder Mac. Het [Release-07 bewijsregister](RELEASE-07-EVIDENCE-2026-11-15.md) bevat de eerdere PR's en exact gecontroleerde signalen. Deze closeout documenteert expliciet het **overdrachtspunt**: niet opnieuw een stroomtool, loginarchitectuur, cronjob of losse SMTP-test bouwen, maar de open P0-productieacceptatie naar echte GO/HOLD brengen. Zie [startprompt voor de opvolgende agent](NEXT-GPT6PRO-START-POST07-2026-11-15.md).
