# Zonlio — definitieve projectoverdracht en voortgang naar autonome leadmachine

**Peildatum:** 15 november 2026 (Europe/Amsterdam). **Werkelijke laatste geverifieerde appcommit vóór deze documentatie:** `396d19fc8fde5890e043e94624d13e5166b6a096` op `main`. **Live releasemarker:** `nivo-workbench-05-20261115`. **Status:** technische basis en NIVO-werkvoorraad live; automatische onderhoudsuitvoering eenmaal aantoonbaar opgeslagen; **publieke commerciële productvrijgave en volledige E2E nog HOLD**. Dit is de actuele overdracht voor een nieuwe GPT-6 Pro-agent, niet een claim dat Zonlio al volledig zelfstandig verkoopt.

## 1. Productmissie en vaste besluiten

Zonlio.nl wordt een **gratis, premium, helder Nederlands stroom- en woningplanningsplatform** dat organisch relevante bezoekers aantrekt, direct een nuttig resultaat laat zien, en waar passend **vrijwillige kwalitatieve adviesleads voor NIVO** genereert. Geen verplichte accountregistratie om het gratis inzicht te bekijken. De website moet zonder open Mac, ChatGPT-sessie, handmatige mailverwerking of afhankelijke Portal zelfstandig blijven draaien. Menselijke salescontacten door NIVO/Pim blijven uiteraard nodig.

- Website: https://zonlio.nl · GitHub: https://github.com/Michaelwmdegroot/zonlio · productiebranch: `main` (Hostinger kan daar automatisch van deployen).
- Tech: Hostinger Node.js **24**, JavaScript/Express, **MySQL** in productie, mail via Hostinger/`info@zonlio.nl`; tijdelijke SQLite **alleen voor tests**. Geen nieuw framework, betaalde provider, extra hostinglaag of ongevraagde kosten.
- Juridisch exploitant en adviesontvanger: **NIVO Groep Holland BV**, KvK **95227768**, Lireweg 52, 2153 PH Nieuw-Vennep, contact/privacy: **info@zonlio.nl**. Zonlio is geen aparte BV. Herbevestiging niet nodig.
- Opvolging: **Pim** is standaard verantwoordelijkheidslabel voor nieuwe NIVO-aanvragen; dit label geeft geen eigen personeelslogin/autoristatie.
- Later, uitsluitend wanneer ontvanger klaar is: **Zonlio → NIVO Portal → bestaande Odoo-connect → Odoo**. Niet nu koppelen. Zonlio is zelfstandig bruikbaar; Portal-contract v1 is technisch voorbereid en export staat uit.
- Visueel: eigenaar keurde licht **Blue Glass / Apple-Mac**-gevoel en centraal `src/design-system.css` / bestaand SVG-logo goed; behoud consistente stijl.
- Juridisch/doeleinden: **gratis tool ≠ account ≠ dagmailabonnement ≠ adviescontact ≠ marketing ≠ analytics**. Een dagmailabonnee is nooit automatisch een belbare lead. Geen claims over gegarandeerde besparing of fictieve prijsvoorspellingen.
- De eigenaar heeft doorontwikkeling en geteste merges goedgekeurd, niet stilzwijgend publieke commerciële schakelaars of verwerking van willekeurige persoonsgegevens. Geen secrets of klant-NAW in GitHub, issues, logs, prompts of testassets.

## 2. Bewezen mijlpalen (wat NIET opnieuw bouwen)

| Fase | Oplevering | Bewijsniveau |
| --- | --- | --- |
| 01 — Technische pilot | Live Hostinger/Node24/Express, MySQL-opslag, afgeschermd beheer, echte stroomprijzen, apparatenplanner, zon-/batterijscenario's en regionale weerdata. | Productie-GitHub GET-observatie + eerder door eigenaar geteste UI. |
| 02 — Visuele kwaliteit | Premium Blue Glass-branding, coherent design en mobiele lay-outs, rekenresultaat vóór optionele NAW. | Eigenaarreview, broncode, synthetische browseracceptatie. |
| 03 — Groeifuncties | Woningintake in 3 stappen, contactbewijs/idempotentie, dossierhistory, revisies/intrekking, mailoutbox, aparte Mijn Zonlio-account/magic links, dagmail met double opt-in/afmelden. | Code, unit-/integratie-/browser-CI; **niet** de volledige echte productie-E2E. |
| 04 — Autonomie/SEO/privacy | Duurzame maintenance-leases en MySQL-ticks, gedeeld mailbudget en bouncesuppressie, mail/bron/queue-controles, privacy-export/correctie/wissen/herstelregister, 6 servergerenderde SEO-landings, Portal claim/ack v1. | [PR #13](https://github.com/Michaelwmdegroot/zonlio/pull/13), MySQL8- en browser-CI, [release04](AUTONOMY-04-RELEASE-2026-11-14.md). |
| 04a — Hostinger-cronfix | Werkelijke terminal liep leeg door `hbuilds/current`-symlink in ESM direct-entry check; code gefixt met regressietest, bestaande cronconfiguratie niet verwijderd. | [PR #14](https://github.com/Michaelwmdegroot/zonlio/pull/14), CI, in latere productie één heartbeat gezien. |
| 05 — NIVO-werkvoorraad | Nieuwe NIVO-aanvragen krijgen transactioneel interne Pim-review met Amsterdamse actiedatum; admin `Nu opvolgen` filtert nieuwe/oningeplande/vervallen acties met geldig contactrecht, naast `Alle aanvragen`. Zonder automatische contactpoging, marketingmail of nieuwe rechten. | [PR #15](https://github.com/Michaelwmdegroot/zonlio/pull/15), [release assetcontrole PR #16](https://github.com/Michaelwmdegroot/zonlio/pull/16), **22/22 live probes**. |
| 05a — Cronwaarneming | De onafhankelijke GitHub-watch toont nu geschoonde `maintenanceRecorded`, `lastMaintenanceAt` en leeftijd, ook met `OPS_EXPECT_CRON=false`. | [PR #17](https://github.com/Michaelwmdegroot/zonlio/pull/17), [operations-run 43656137432, poging 2](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43656137432). |

### Actuele productie- en CI-evidence

- **Applicatie & MySQL:** `main` [Check application](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43655995233) **success**; Node24, tests, MySQL8-integratie, build en productie-dependency-audit in CI.
- **Browsers:** `main` [Consumer browser acceptance](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43655995243) **success**, Chromium en WebKit. Dit zijn synthetische flows met lokale Express en fake SMTP, **geen** fysieke iPhone/Safari of echte inbox.
- **Live uitrol:** [Observe public Zonlio deployment](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43656090276) **success**; releasemarker `nivo-workbench-05-20261115`, 22/22 vaste read-only GET-probes inclusief het nieuwe `/src/admin.mjs`-werkvoorraadbestand, DB/admin/mail geconfigureerd, publieke toegang tot afgeschermde routes geweigerd. Dit bewijst **geen** klant-aanvraag, inbox, cron of restore.
- **Werkelijke maintenance:** in [Observe Zonlio operations 43656137432 — poging 2](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43656137432) werd om **2026-11-15 00:02:45 UTC** `maintenanceRecorded:true` met `lastMaintenanceAt:2026-11-15T00:00:02.878Z`, leeftijd **2 minuten**, `databaseReady:true` en `sourcesReady:true` gelezen. Dit bewijst **ten minste één in productie duurzaam opgeslagen onderhoudsuitvoering**, passend bij de reeds door eigenaar ingestelde Hostinger-cron van elke 5 minuten. Het bewijst **nog geen meerdere geplande ticks / herstartproef**.
- **Monitoringnuance:** de eerste runpoging om ca. 00:01:57/00:02:13 UTC kreeg tweemaal `HEALTH_UNAVAILABLE`; poging 2 slaagde. Niet verbergen, maar ook niet zonder nader bewijs als volledige website-uitval bestempelen.
- **E-mail:** eigenaar bevestigde een **daadwerkelijk ontvangen losse SMTP-testmail** (testcode in oudere privé-/QA-notities), buiten de volledige automatiseringsketen. HPanel-mailboxplafond **100 mails per rollende 24 uur**. Een door eigenaar getoonde beheerstatus vermeldde **1 van 50 pogingen gebruikt, 49 beschikbaar, dagmailplafond 40** op het meetmoment; dit is geen garantie over huidig budgetverbruik of alle Hostinger-apps. De eigenaar meldt `MAIL_SEND_PAUSED=true` in hPanel; de eerdere beheer-UI toonde `Beschikbaar`. De **effectieve runtimepauze blijft daarom onbevestigd**; maak hier geen langdurige ontwikkelblokkade of verzonnen status van. Een werkende SMTP-test is geen bewijs van lead-/account-/dagmailaflevering.

### Huidige publieke runtimegates

In de laatste externe [live controle](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43656090276) waren alle zes **false**:

- `LEAD_ENABLED=false`, `HOUSING_ADVICE_ENABLED=false`;
- `MEMBER_ACCOUNTS_ENABLED=false`, `DAYMAIL_SIGNUP_ENABLED=false`, `DAYMAIL_SEND_ENABLED=false`;
- `PORTAL_EXPORT_ENABLED=false` (bewust; blijft uit).

`LEAD_CONTROLLER_CONFIRMED` bevestigt slechts de NIVO-ontvanger en activeert geen intake. In de laatste operationscontrole was `cronExpected:false / cronStatus:not_required`: één werkelijke tick is gezien, maar actieve stale-cronalarmering is niet bevestigd. **Operationele status ≠ publieke lancering.**

## 3. Waar staan we écht?

**Afgerond:** technische en visuele basis, gratis interactieve tools, privacybewust datamodel, mailinfrastructuur/code, onderhoudscode, SEO-technische basis, dashboards en interne Pim-werkvoorraad. Het product is goed voorbereid om klanten te verwerken en later de Portal te koppelen.

**Deels aangetoond:** echte SMTP-connectie + één losse ontvangen testmail; één echte cronheartbeat; onafhankelijke read-only monitoring; bron-/mailquota en backendstatus. De ingestelde Hostinger-cron is door eigenaar aangemaakt; herhaalde productie-uitvoering is nog niet afzonderlijk bewezen.

**Nog niet afgevinkt:** een echte publieke advies- en account-/dagmailketen inclusief bevestiging en afmelden, zelfstandige operationele incidentafhandeling, bewaarbeleid/restore, organisatiebrede toegangs-/opvolgkeuzes en de daadwerkelijke commerciële GO. Zonder deze laatste stap is de leadmachine **nog niet bedrijfsklaar**, ongeacht hoeveel code er al live staat. Geen subjectief voortgangspercentage als meetbaar feit presenteren.

## 4. Open werk, op volgorde van waarde en afhankelijkheid (GEEN kalenderplanning)

| ID / issue | Nog uit te voeren | Acceptatie en bewijs | Wie? |
| --- | --- | --- | --- |
| A — #2/#10 | **Cron afronden:** na de reeds geziene tick twee volgende **geplande** succesvolle ticks vaststellen, één gecontroleerde appherstart en minimaal twee nieuwe ticks erna; `OPS_EXPECT_CRON=true` pas als betrouwbaar, storingmeldingen bewijzen. | MySQL/admin chronologie, lastSuccessAt, release, succesvolle herhaling na herstart, onafhankelijke watch; geen geheimen. | Agent leest waar mogelijk; eigenaar alleen voor beperkte Hostinger-herstart. |
| B — #1/#2 | **Eén geautoriseerde echte lead-E2E:** vrijwillige woning- of algemene aanvraag veilig opslaan, reference + contactbewijs + Pim-werkvoorraad controleren, binnen quota NIVO-notificatie + klantbevestiging ontvangen, status/revisie/notitie en intrekking testen. **Geen nieuwe publieke gates openen alleen om een test mogelijk te maken.** | Eén echt testdossier met geanonimiseerd bewijs, geen duplicaten, mail-ontvangst aan juiste adressen; privacy stop werkt. | Agent bouwt eventuele strikt admin-afgeschermde testprocedure; eigenaar doet minimale echte UI/ontvangst. |
| C — #1/#3 | **Privacy/restore:** backupbeschikbaarheid en echte restore uitsluitend naar een **afzonderlijke** MySQL-db, read-only herstelchecker en stopregister valideren; bewaartermijnen, verwerkers, rechtenproces en bezoekersteksten bekrachtigen. | Restorecontrole met uitsluitend geschoonde aantallen en geverifieerd privacybeleid; geen productie-restore/wissing. | Agent implementatie/docs; eigenaar Hostinger/beleids-GO. |
| D — #9/#2 | **Mijn Zonlio en dagmail productie-E2E:** magic link, bevestiging, profiel bewaren/relogin, losse double opt-in, ochtend/avond, unsubscribe, ongeldige prijzen, budget, dedup, retries/onderdrukking, echte inbox en e-mail-authenticatie (SPF/DKIM/DMARC). | Synthetische CI + één echte toestemmingsgestuurde keten; gemeten verzendruimte zonder bulk. | Agent + korte eigenaarstest. |
| E — #10 | **Autonome operatie:** alerts, async bounces/klachten of aantoonbaar afgebakende handmatige mailboxcontrole, monitor recovery, juiste ontvanger, incidentrunbook en bereikbaarheids-/herstelbewijs. | Geen verloren dossier bij SMTP-fout; aantoonbaar ontvangen alert, actielijst zonder Mac; geautoriseerde incidentopvolging. | Agent, NIVO-keuze ontvanger. |
| F — #3/#11 | **NIVO-opvolgbeleid:** werkgebied/diensten, realistische reactiesnelheid, max. contactpogingen, geautoriseerde vervanging voor Pim, rol-/privacytoegang. Niet automatisch onbevestigde beloftes publiceren. | Bekrachtigde interne SOP, consistente publiekscopy en terugbelregistratie. | NIVO-eigenaar keurt open proceskeuzes goed. |
| G — #11 | **SEO/growth:** sitemap/canonicals en actualiteit valideren, Search Console/indexatie, Core Web Vitals, echte mobiele Safari, inhoudelijke NL-content en betere contextuele conversie-UX; funnel op werkelijk ontvangen/gekwalificeerde dossiers, geen schijnstatistiek. | Geverifieerde index-/CWV-gegevens waar toegang bestaat, consent-correcte events en leads/afspraken/offertes per bron. | Vooral agent; optioneel Search Console-toegang eigenaar. |
| H — #3/#9/#11 | **Gefaseerde publieke GO:** na noodzakelijke P0-bewijzen **afzonderlijk** advies, woningadvies, accounts, inschrijven, automatisch verzenden laten goedkeuren, activeren, live E2E/rollback controleren. | Eigenaar heeft per live gate expliciet GO gegeven; directe productieobservatie toont effectieve flags en volledige keten; geen onbedoelde bulk. | Eigenaarsbesluit, agent gecontroleerde uitvoering. |
| I — #5 | **Optionele inhoudelijke verdieping:** valideer PV-instraling/dakmodel, batterijintervalsimulatie en brongebonden AI pas met data, licenties en backtests. | Transparante aannames en onzekerheden; geen blokkade voor eerste leadrelease. | Agent later. |
| J — #12 (gesloten) | **NIVO Portal:** contract en onboardingdocument bewaren en compatibiliteit blijven testen; geen echte aansluiting zolang Portal niet klaar is. | Zonlio claim/ack/stop v1 getest; `PORTAL_EXPORT_ENABLED=false`. | Klaar aan Zonlio-zijde, vervolg uitsluitend later. |

**Geen cirkelgesprek:** niet opnieuw vragen om domein, repo, KvK, Pim, stijl, mailbox, algemene bouwtoestemming, de al ontvangen losse testmail of opnieuw de cronjob aanmaken. Er is geen nieuwe staging-/designfase nodig. Bij een echte blocker vraagt de agent **één concrete minimale eigenaarshandeling** en bouwt parallel alle onafhankelijke taken af.

## 5. Technische instappunten en bewijsdiscipline

- Bron start: `AGENTS.md`, `README.md`, dit handoff, [masterchecklist](COMPLETION-MASTER-CHECKLIST-2026-11-14.md), [eigenaarspoorten](OWNER-INPUT-AND-GATES-2026-11-14.md), [runbook](AUTONOMOUS-OPERATIONS.md), [privacy](PRIVACY-OPERATIONS.md), [NIVO-SOP](NIVO-FOLLOWUP.md), [Portal-contract](PORTAL-CONTRACT-v1.md) en [onboarding](PORTAL-ONBOARDING.md).
- Bronnen/app: `server.mjs`; `server/backend.mjs`, `server/store.mjs`, `server/member-store.mjs`, `server/members.mjs`, `server/mail.mjs`, `server/operations*.mjs`, `server/privacy-store.mjs`, `server/portal.mjs`, `server/release.mjs`; `src/app.mjs`, `src/leads.mjs`, `src/housing-advice.mjs`, `src/admin.mjs`, `src/design-system.css`.
- Cron: `scripts/maintenance.mjs` (beveiligde POST naar `/api/tasks/maintenance` met token in header; géén token in URL). Hostinger cron bestaat volgens eigenaarscreenshot, iedere vijf minuten. Symlinkfix is gemerged. Geen handmatig loopje nodig.
- Reproductie: `npm ci`, `npm run check`, `npm test`, `npm run build`; MySQL8-CI in `.github/workflows/check.yml`; synthetische browsers in `browser-qa.yml`; externe GET-checks in `production-observe.yml` en `operations-watch.yml`. Nooit live E2E concluderen uit CI.
- Issues: **#1 #2 #3** (P0), **#9 #10 #11** (autonomie/growth), **#5** (P2). **#12 gesloten** voor de Zonlio-kant; later Portal-team. PR's #13–#17 als recent implementatiebewijs.
- Privacy: geen oude productiedossiers wijzigen in een checklist; geen natuurlijke persoonsgegevens in PR, bestanden, logs of issues. Algemene read-only checks mogen; echte leads, mail en publieke flags alleen met passende toestemming/acceptatie. Gelijkwaardige scripts in een branch, CI groen vóór merge, huidige main controleren, productieobservatie na deploy.
- Gebruik altijd de precieze woorden **gebouwd**, **CI-getest**, **live via GET waargenomen**, **eigenaarbevestigd**, **echte productie-E2E bevestigd** of **nog niet bewezen**. Een groene watch zonder cronverwachting ≠ bewijs van operationele cronherhaling.

## 6. Definition of done — zelfstandige Zonlio zonder Portal

Alleen **GO** als:
1. gratis reken- en planningsproduct betrouwbaar blijft zonder profiel/NAW;
2. geactiveerde, vrijwillige leads binnen MySQL/rechtenmodel en werkvoorraad veilig doorlopen tot NIVO-opvolging, mét echte relevante mails;
3. accounts/dagplan alleen na eigen opt-in, met echte bevestiging, afmelden, budget en correcte dagberekening functioneren;
4. cron en queues aantoonbaar na restart werken, fouten automatisch zichtbaar zijn en verantwoordelijke beheerder kan ingrijpen;
5. privacyrechten, bewaarbeleid en herstel uit afzonderlijke backup daadwerkelijk geaccepteerd zijn;
6. per publiek kanaal de eigenaar expliciet **GO** gaf en geanonimiseerd bewijs in de repo staat;
7. het Portal-contract klaar en getest blijft met export **uit**.

Resterende menselijke rol: NIVO behandelt leads, reageert op uitzonderingen/klachten en keurt commerciële en privacybesluiten goed. **Geen claim van volledig geautomatiseerde sales zonder mensen.**

**Nieuwe GPT-6 Pro-agent:** begin bij [NEXT-GPT6PRO-START-2026-11-15.md](NEXT-GPT6PRO-START-2026-11-15.md). Oude startprompts en 14-november-P0-statussen zijn historisch, niet de actuele kopregel.
