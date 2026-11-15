# Zonlio — zelfstandig onderhoud en storingsbeheer


> **Release 07 — onafhankelijke cronwaarschuwing:** de echte Hostinger-cron is inmiddels in productie **meerdere malen** waargenomen (zie [Release-06-evidence](RELEASE-06-EVIDENCE-2026-11-15.md)). Er is geen herinstallatie nodig. De [externe GitHub-watch](../scripts/operations-watchdog.mjs) gaat vanaf deze wijziging óók waarschuwen als een **eerder opgeslagen** succesvolle heartbeat meer dan **20 minuten** ontbreekt, zelfs wanneer `OPS_EXPECT_CRON=false` in de appconfiguratie staat. Verse installaties zonder enige tick blijven afhankelijk van expliciete `OPS_EXPECT_CRON=true`. De externe watch is **read-only** en raakt de Hostinger-config, mailpauze, taken en publieke gates niet aan. Deze technische alarmering bewijst geen daadwerkelijk ontvangen storingsmail; GitHub Actions-falen moet operationeel worden opgevolgd. De historische installatiestappen hieronder zijn alleen voor herstel, niet opnieuw uitvoeren zolang cron werkt.


**Stand: 14 november 2026.** Dit runbook beschrijft de huidige implementatie en de veilige installatie- en bewijsstappen. Het activeert geen publieke dienst en verklaart productie niet bedrijfsklaar. De beschikbare cloud-aanmelding bij Hostinger hPanel is in deze sessie expliciet geblokkeerd; installatie, herstart en productiecontrole hieronder zijn daarom nog uit te voeren door bevoegd hostingbeheer.

NIVO Groep Holland BV blijft exploitant, `info@zonlio.nl` het bekende beheer-/contactadres en **Pim** de verkoopopvolger. Deze bevestigde gegevens hoeven niet opnieuw te worden aangeleverd. De toekomstige Portal-ontvanger is geen voorwaarde voor zelfstandig onderhoud; `PORTAL_EXPORT_ENABLED=false` blijft staan.

De integrator meldt voor de huidige werkversie **178 lokale tests: 177 geslaagd en één overgeslagen MySQL-integratietest**; daarnaast 68 geslaagde syntaxcontroles, 36 gebouwde publieke bestanden en nul auditbevindingen. Dit is lokaal codebewijs. Hostinger-cron, de complete productie-account-/aanvraag-/dagmailketens, ontvangst van beheerwaarschuwingen en een echte afzonderlijke restoreproef zijn hiermee niet bewezen.

## 1. Wat automatisch wordt uitgevoerd

Een Hostinger-crontaak start iedere vijf minuten [scripts/maintenance.mjs](../scripts/maintenance.mjs). Het script leest alleen de bestaande serverconfiguratie en doet een geauthenticeerde `POST` naar `https://zonlio.nl/api/tasks/maintenance`. Het geheime token staat in de **Authorization-header**, nooit in de URL of de cronopdracht. De Node-app verwerkt vervolgens:

- Verlopen adviescontacten en het bijbehorende stoppen van contact-/wachtrijrechten.
- De mailwachtrij voor aanvragen, de account-/abonnementswachtrij en beschikbare dagplannen binnen hun verzendvenster.
- Het bijwerken van de gedeelde prijs-/weercache via de bestaande bronadapters.
- Technische opruiming en registratie van geslaagde of mislukte onderhoudstaken in MySQL.
- Geaggregeerde storingscontroles en, uitsluitend na afzonderlijke inschakeling, een beheerwaarschuwing.

Er is geen lokale Mac, open browser of doorlopend terminalproces voor deze taken nodig. Het script eindigt na elke aanroep. Verkoopopvolging en het beoordelen van ontvangen klachten blijven werkzaamheden van NIVO.

De technische bronnen zijn [server/backend.mjs](../server/backend.mjs), [server/operations.mjs](../server/operations.mjs), [server/operations-store.mjs](../server/operations-store.mjs), [server/members.mjs](../server/members.mjs) en [.env.example](../.env.example). Een geslaagde onderhoudstaak betekent dat de uitvoering is afgerond; de afzonderlijke bron-/mailstatus kan nog aandacht vragen.

## 2. Hostinger-cron veilig installeren

### Voorbereiding in hPanel

1. Open het dashboard van **zonlio.nl** en controleer dat de bedoelde geteste release op Node.js **24** draait. Noteer de release-ID en huidige `main`-commit zonder configuratiewaarden te kopiëren.
2. Controleer privé in de appconfiguratie: `NODE_ENV=production`; `APP_URL` en eventueel `PUBLIC_URL` verwijzen naar `https://zonlio.nl`; `CRON_SECRET` bestaat, is ten minste 32 tekens en verschilt van `SESSION_SECRET`. Een bestaande juiste configuratie niet vervangen door het volledige ontwikkelvoorbeeld.
3. Controleer dat productie MySQL gebruikt en dat de app de database kan lezen. `databaseReady=true` in de openbare healthcontrole is een actuele leesproef; het is geen back-up- of schrijftest.
4. Houd voor de installatie **`MAIL_SEND_PAUSED=true`**, **`OPS_ALERTS_ENABLED=false`** en alle nog niet vrijgegeven publieksvlaggen uit. Houd ook `PORTAL_EXPORT_ENABLED=false`. Hiermee kan cronbewijs worden verzameld zonder echte mails te verzenden of een testdossier aan te maken.
5. Gebruik de echte hostingaccountnaam uit hPanel uitsluitend om de twee onderstaande `ACCOUNT`-plaatsaanduidingen te vervangen. Controleer dat het configuratiebestand en het deploymentscript op deze paden aanwezig zijn. Toon of download de inhoud van `.env` niet voor een bewijsrapport.

De afzonderlijke publieksgates zijn `LEAD_ENABLED`, `HOUSING_ADVICE_ENABLED`, `MEMBER_ACCOUNTS_ENABLED`, `DAYMAIL_SIGNUP_ENABLED` en `DAYMAIL_SEND_ENABLED`. Deze installatie geeft geen van die gates vrij. Verander de al bevestigde exploitantgegevens of de juridische bevestiging niet om cron te testen.

### Opdracht en planning

Ga in het websitedashboard naar **Advanced → Cron Jobs**. Gebruik deze volledige opdracht, op één regel:

```sh
/opt/alt/alt-nodejs24/root/bin/node --env-file=/home/ACCOUNT/domains/zonlio.nl/hbuilds/config/.env /home/ACCOUNT/domains/zonlio.nl/hbuilds/current/nodejs/scripts/maintenance.mjs
```

Als hPanel de Node-opdracht al vooraf invult, pas die aan tot precies deze ene opdracht; voeg niet nog een tweede Node-prefix toe. De Node-binary moet versie **24** aanwijzen. De opdracht heeft met de plaatsaanduiding 177 tekens; controleer na vervanging dat zij binnen Hostingers limiet van 255 tekens blijft. Voeg geen token, wachtwoord, `curl`-queryparameter of eigen logbestand met configuratiedump toe.

| Cronveld | Waarde |
| --- | --- |
| Minuut | `*/5` |
| Uur | `*` |
| Dag van de maand | `*` |
| Maand | `*` |
| Dag van de week | `*` |

Hostinger voert de planning in UTC uit. Iedere vijf minuten werkt hetzelfde bij zomer- en wintertijd; de applicatie bepaalt dagmails zelf in `Europe/Amsterdam`. Hostinger geeft cron niet automatisch de Node-appomgeving mee: daarom is `--env-file` noodzakelijk. Deze paden en werkwijze volgen de [officiële Hostinger-instructie voor Node.js-crontaken](https://www.hostinger.com/support/how-to-run-cron-jobs-for-node-js-websites-at-hostinger/), gecontroleerd op 14 november 2026.

Sla **één** crontaak op. Controleer bestaande taken op doublures; vervang een bekende oude Zonlio-maintenance-taak gecontroleerd. Verwijder geen onbekende taken voor andere websites. Stel na installatie in de appconfiguratie `OPS_EXPECT_CRON=true` in en laat de app die configuratie opnieuw laden via de normale hPanel-herstart/deploy. Dit verwacht een recente heartbeat, maar geeft geen account, adviesformulier of dagmail vrij.

### Diagnose: direct script eindigt stil via `hbuilds/current` (14 november 2026)

Tijdens de werkelijke eigenaarstest werd de Hostinger-terminalopdracht met `.../hbuilds/current/nodejs/scripts/maintenance.mjs` gestart, maar er verscheen geen JSON en geen fout; tegelijk toonde Zonlio Beheer **0 geslaagde ticks en geen onderhoudsregels**. Dit is **geen** succesbewijs. De eerdere directe-startvoorwaarde vergeleek de module-URL letterlijk met `process.argv[1]`. Als `current` een symbolische link is, resolveert Node de module-URL naar de fysieke deployment maar behoudt het commandlinepad; de voorwaarde kon dan onterecht `false` zijn en de taak stil overslaan.

De code vergelijkt nu ook het fysieke pad van de opdracht via `realpathSync`, terwijl module-importen door tests het onderhoud niet starten. Een synthetische regressietest voert de echte CLI via een tijdelijke `current`-symlink uit met bewust ongeldig cronsecret: **de CLI moet nu veilig stoppen met niet-nul exitstatus en een geschoonde fout**, in plaats van zonder output exitstatus 0 terug te geven. Deze test benadert géén productie-API en verstuurt geen e-mail.

**Hercontrole na groene CI en deployment:** verifieer privé dat `MAIL_SEND_PAUSED=true` staat (in de eerste eigenaarswaarneming stond globale mailverwerking nog op **Beschikbaar**), houd alle publieke gates en Portal-export uit, voer dan één keer de exacte bestaande terminalopdracht uit. Verwacht JSON met `status: "completed"` of een geschoonde fout, niet een lege prompt. Controleer tegelijkertijd `Laatste onderhoudscontroles` in Zonlio Beheer. Als nog steeds geen ticks volgen, controleer het bestaande `.env`-pad/`CRON_SECRET` en het resultaat, zonder secrets te delen; pas na bewezen ticks `OPS_EXPECT_CRON=true` en doe de herstartproef. De fix levert op zichzelf **geen** productiecron- of inboxbewijs.

### Output begrijpen

Bekijk de uitvoer van de geplande taak in hPanel. Voorbeelden hieronder zijn **voorbeeldvormen**, geen productieobservaties:

```json
{"ok":true,"status":"completed","processed":0,"sent":0,"failed":0,"memberAccepted":0,"expiredContactRequests":0}
```

De tellingen kunnen anders zijn, bijvoorbeeld als een oud contactverzoek vervalt. Bij ingestelde mailpauze horen geen nieuwe verzendacceptaties bij deze taak.

```json
{"ok":true,"status":"busy"}
```

`busy` betekent dat een andere uitvoering de lease bezit. Dit is veilig overgeslagen werk en **geen nieuwe geslaagde tick**. Een globale maintenance-lease duurt maximaal vier minuten. Wis bij een overlap geen locks of wachtrijregels; controleer de volgende geplande uitvoering en de taakgeschiedenis. Bij herhaalde `busy`-uitvoer, fouten of ontbrekende uitvoer volgt de incidenttabel hieronder.

Het script accepteert alleen een afgeronde maintenance-response, weigert redirects, heeft een timeout van 55 seconden en geeft bij een fout een geschoonde melding met exitcode 1. Een timeout bewijst niet dat de server niets heeft gedaan: controleer eerst de opgeslagen taakstatus voordat iemand handmatig herhaalt.

## 3. Bewijs van herhaling en herstel na appherstart

Open via de bestaande bevoegde login `https://zonlio.nl/admin`, onderdeel **Zelfstandig beheer → Laatste onderhoudscontroles**. De gegevens komen uit MySQL, niet uit alleen het procesgeheugen. Voor aanvullende geaggregeerde velden is dezelfde informatie beschikbaar via de ingelogde route `GET /api/admin/operations`; deel geen sessiecookie of kopie van de volledige browsernetwerkgegevens.

Verzamel minimaal **drie werkelijk geplande, geslaagde ticks**, waaronder minimaal **twee na één gecontroleerde appherstart**:

1. Leg vóór herstart minstens één geplande `success` vast met start-/eindtijd en release-ID. Noteer `lastSuccessAt`, `successfulTicks24h` en `observedInstances24h` uit het geautoriseerde overzicht.
2. Herstart de app eenmaal via de normale Hostinger-bediening, met mailpauze en bestaande publieke gates behouden. Verander geen database of wachtwoord om een storing te simuleren.
3. Laat twee volgende geplande ticks lopen, normaal vijf minuten uit elkaar. Leg vast dat eerdere taakregels nog aanwezig zijn, `lastSuccessAt` vooruitgaat en nieuwe regels `success` tonen.
4. Controleer binnen dezelfde 24 uur dat `observedInstances24h` ten minste twee toont. Dit ondersteunt dat successen vanuit meer dan één appinstantie zijn opgeslagen; samen met de vastgelegde herstart maakt het de herstartproef controleerbaar. Het getal op zichzelf bewijst geen specifieke herstart.
5. Controleer dat `/api/health` een werkende database en bij ingeschakelde cronverwachting `cronStatus: "current"` toont. Na meer dan vijftien minuten zonder succesvolle afronding wordt de status `overdue`; zonder enige geslaagde tick is deze `never_run`.

Bewaar uitsluitend geschoonde tijden, tellingen, status en release-ID in issue #2/#10 en het releasebewijs. Noteer of een getoonde tijd UTC of Amsterdamtijd is. De beheer-UI toont tijden in Amsterdamtijd; de API gebruikt ISO-tijdstempels. Een handmatige uitvoering kan diagnose helpen, maar vervangt het bewijs van de geplande cron niet.

Deze proef bewijst onderhoud en persistentie over een herstart. Zij bewijst geen echte SMTP-ontvangst, accountbevestiging, woningadviesopslag of back-upherstel. Die blijven de afzonderlijke E2E-/restoregates.

## 4. Twee niveaus van storingssignalering

### Applicatiecontroles en optionele beheeralerts

De maintenance-route registreert vaste incidentcodes zonder namen, adressen of aanvraaginhoud. De huidige controles zijn:

| Controle | Signaal in de huidige code |
| --- | --- |
| Prijsbron | Bron niet gereed of laatste succesvolle broncontrole ouder dan 45 minuten. |
| Weerbron | Bron niet gereed of laatste succesvolle controle ouder dan 24 uur. |
| Cron | Verwachte succesvolle onderhoudstaak ontbreekt of is ouder dan 15 minuten. |
| Aanvraag-/account-/dagmailqueue | Oudste wachtende mail ouder dan 30 minuten. |
| Mailfouten | Eén of meer gefaalde aanvraag- of ledenmails. |
| Mailbudget | Bij verwachte cron: budget ongeldig/niet ingesteld of minstens 80% gereserveerd. |
| Adviesopvolging | Onbehandelde, niet toegewezen of achterstallige vervolgacties. |
| Portal | Alleen bij afzonderlijk geactiveerde export: overdracht langer dan één uur achter. Een bewust uitgeschakelde Portal is geen incident. |

`OPS_ALERTS_ENABLED=false` is de uitgangsstand. Alleen na goedkeuring van operationele waarschuwingen en de beheerontvanger kan deze opt-in worden ingeschakeld; `OPS_ALERT_TO=info@zonlio.nl` gebruikt het al bekende adres. Controleer vervolgens afzonderlijk de ontvangen waarschuwing. Geen commerciële mailing en geen nieuwe ontvanger zijn nodig voor dit proces.

Een beheeralert groepeert open afwijkingen in één mail met een link naar beheer. Dezelfde incidentcode wordt na SMTP-acceptatie niet vaker dan eens per zes uur opnieuw gemeld; een niet geaccepteerde poging wordt ten minste vijftien minuten uitgesteld. Alerts gebruiken hetzelfde mailbudget als andere Zonlio-mails. Ze worden niet verzonden tijdens `MAIL_SEND_PAUSED=true`, zonder werkende SMTP-configuratie of zonder geldige verzendruimte. `notifiedAt` en `notified:true` betekenen **SMTP-acceptatie**, geen bewezen inboxontvangst.

### Onafhankelijke GitHub-watch voor stilgevallen cron of app

[Observe Zonlio operations](../.github/workflows/operations-watch.yml) draait via GitHub Actions op minuut **17 en 47 van elk uur, UTC**, en ook na iedere geslaagde openbare main-deploymentobservatie. De controle kan daarnaast via `workflow_dispatch` handmatig worden gestart. Het voert [scripts/operations-watchdog.mjs](../scripts/operations-watchdog.mjs) uit: uitsluitend een openbare `GET /api/health`, zonder secrets en zonder een maintenance-taak te starten. Eén mislukte controle krijgt na vijftien seconden een tweede poging.

De watch controleert bereikbaarheid, de actuele databaseleesproef en, wanneer cron wordt verwacht, recente onderhoudsafronding en gereedheid van de bronadapters. Daardoor kan hij ook een geheel gestopte app of cron signaleren, terwijl de app dan zelf geen waarschuwing kan mailen. Hij inspecteert geen persoonlijke dossiers en vervangt geen inbox-/E2E-/restoreproef.

Sinds release 05 geeft de onafhankelijke watch in zijn geschoonde uitvoer ook `maintenanceRecorded`, `lastMaintenanceAt` en `maintenanceAgeMinutes` door vanuit de openbare health-endpoint. Dit is een **werkelijk opgeslagen laatste tick** als de waarde bestaat, óók wanneer `OPS_EXPECT_CRON=false`. Het is geen bewijs van drie geplande ticks na een herstart, geen nieuwe databasequery met rechten en geen activering van cron of mail. Controleer het onderscheid `maintenanceRecorded:false` versus `true` in de eerste echte GitHub-run.

**Nog te bewijzen:** Actions moet op de repository daadwerkelijk actief zijn, geplande runs moeten terugkeren en de bedoelde beheerder moet GitHub-meldingen over mislukte workflowruns daadwerkelijk ontvangen. Een groen handmatig workflowresultaat bewijst die foutmeldingontvangst niet. Leg dit afzonderlijk vast zonder productie expres stuk te maken. GitHub-planningen en notificaties zijn geen gegarandeerde realtime alarmering; controleer bij twijfel ook de runhistorie. Er is geen betaalde monitor aangeschaft.

## 5. Gedeeld mailbudget en dagplanvensters

De eigenaar heeft **100 uitgaande mails per rollende 24 uur** voor de Hostinger-mailbox bevestigd. De applicatie accepteert daarom alleen een geheel `SMTP_DAILY_LIMIT` van **1 tot en met 100**; `0` is geen vrijgegeven budget. Lees de feitelijke waarde privé in beheer/hPanel uit. De bekende bevestiging dat het appbudget `Correct` is, bewijst niet welk getal daadwerkelijk is ingesteld.

**50 is een eerder voorgesteld conservatief appbudget, geen in dit werk ingestelde waarde.** Bij een appbudget van 50 stopt nieuwe dagmailreservering zodra in totaal 40 app-pogingen in de afgelopen 24 uur zijn gereserveerd. De resterende ruimte kan onder meer nodig zijn voor accountlinks, inschrijfbevestigingen, aanvraagmails, beheeralerts en beheertests. Dit betekent niet dat 40 dagmails altijd beschikbaar zijn: andere pogingen tellen al mee in diezelfde 40.

Elke verzendpoging reserveert capaciteit vóór SMTP, ook bij een mislukte of onzekere aflevering. Retries gebruiken opnieuw capaciteit. De gedeelde MySQL-reservering voorkomt dat parallelle Zonlio-taken samen het ingestelde appplafond overschrijden. Verwijder deze reserveringen niet om een vol budget te omzeilen.

De app ziet **geen** handmatig verzonden webmail of gebruik vanuit andere apps op dezelfde mailbox. NIVO moet dat verbruik meewegen in het appbudget. Een rollend venster wordt geleidelijk vrij, niet in één keer om middernacht. Een budgetmelding kan zelf niet meer per SMTP verstuurd worden wanneer alle ruimte al verbruikt is; gebruik daarom ook beheer en de onafhankelijke watch. Capaciteitsgroei vraagt een apart besluit en geen automatische aankoop.

De dagplanner werkt alleen met een geverifieerd actief abonnement, beschikbare passende prijzen en expliciet vrijgegeven dagmailverzending. Ochtendplanning loopt van **07:00 tot vóór 09:00 Amsterdamtijd** voor vandaag; avondplanning van **18:00 tot vóór 21:00** voor morgen. `outside_window`, `nothing_due` of een gepauzeerde scheduler kunnen dus normale uitkomsten zijn. Bij ontbrekende/verouderde prijzen wordt geen verzonnen plan verstuurd. Controleer bij een gemiste editie de schedulerstatus, bronstatus, profielgeschiktheid, afmelding/suppressie en budget voordat een retry wordt overwogen. Stuur een verlopen plan niet handmatig alsnog als actueel advies.

## 6. Bounces, klachten en contactstops verwerken

Directe bevestigde SMTP-fouten voor een niet bestaande mailbox (`5.1.0`/`5.1.1`) kunnen een verzendsuppressie vastleggen. Een willekeurige beleidsweigering zoals `5.7.1` wordt niet automatisch als onbestaand adres behandeld. De huidige code verwerkt **geen later binnenkomende bounceberichten of klachtfeeds automatisch**.

Daarom moet een bevoegde NIVO-beheerder de bestaande operationele inbox blijven bewaken op bounces en bezwaren, met een vastgelegde vervanger en controlefrequentie. Dit eigenaarschap en de daadwerkelijke signalering horen vóór vrijgave vast te staan; het bekende bestaan van `info@zonlio.nl` is hiervoor nog geen uitvoeringsbewijs. Er is geen dagelijks handmatig cronwerk nodig, maar zonder dit inboxproces is de afhandeling van asynchrone bezorgproblemen niet zelfstandig geborgd.

Na een gecontroleerde bounce, klacht of verzoek:

1. Open **Zelfstandig beheer → Bezorgprobleem of bezwaar verwerken** via de bevoegde beheersessie.
2. Controleer het juiste adres in de beveiligde bron. Kies **Bevestigde onbestelbaarheid**, **Klacht over e-mail** of **Verzoek van de ontvanger** en bevestig de stop.
3. Controleer het resultaat in beheer. De registratie stopt nieuwe account-, inschrijf-, dagplan- en aanvraagbevestigingsmails naar dat adres en annuleert bijbehorend nog niet afgehandeld ledenmailwerk. Het minimale hashregister blijft bestaan bij accountverwijdering; opnieuw aanmelden heft deze stop niet op.
4. Beoordeel een breder contact- of wisverzoek ook in het woningadviesdossier. Een mailstop trekt een afzonderlijk telefonisch adviesverzoek niet vanzelf in en blokkeert niet de interne dossiermelding. Volg daarvoor [PRIVACY-OPERATIONS.md](PRIVACY-OPERATIONS.md).

Er is bewust geen gewone beheerknop om een suppressie automatisch terug te draaien. Een al door SMTP geaccepteerd bericht kan niet worden teruggehaald. Leg geen adres, bounce-inhoud of volledige headers in GitHub vast; noteer alleen de geaggregeerde status en betrokken testcategorie. Voor authenticatiebewijs en de grens tussen DNS en echte ontvangen headers: [MAIL-AUTHENTICATION-QA.md](MAIL-AUTHENTICATION-QA.md).

## 7. Incidenten: eerste veilige handeling

| Observatie | Controle en eerste handeling |
| --- | --- |
| `never_run` / geen cronuitvoer | Controleer taak opgeslagen/actief, pad, Node 24 en `--env-file`. Controleer privé of app en cron dezelfde juiste `CRON_SECRET` gebruiken. Geen secret in de URL zetten. |
| `overdue`, app wel bereikbaar | Controleer hPanel-uitvoer, laatste taakstatus en GitHub-watch. Bij `failed` of `interrupted` oorzaak oplossen; niet handmatig locks/wachtrijen leegmaken. |
| Herhaalde `busy` / timeout | Controleer overlap, dubbele crontaken en langlopende taak. Eén overlap is geen storing; een blijvend ontbrekende succesregistratie wel. Verifieer afhandeling in beheer vóór een extra uitvoering. |
| App onbereikbaar / health faalt | Controleer Hostinger-appstatus, actieve deployment en DB-beschikbaarheid. De app kan nu geen eigen alert leveren; gebruik externe workflow/runhistorie. Herstel proces/configuratie of voer gecontroleerde code-rollback uit. |
| `databaseReady=false` | Controleer de databaseverbinding en Hostinger-databasestatus privé. Geen SQLite-fallback in een vluchtige buildmap en geen database opnieuw aanmaken als herstelstap. |
| Mails blijven wachten / SMTP-fout | Controleer mailpauze, budget, veilige foutcode, SMTP-status en suppressie. Bij onzekere aflevering eerst het bevoegde inboxbewijs bekijken; een retry kan een duplicaat opleveren. |
| Budget bijna of helemaal op | Controleer appverbruik én ander mailboxgebruik. Laat de rollende reserveringen verlopen; beperk zo nodig dagmail. Verhoog niet boven de bevestigde providerlimiet en koop geen provider zonder besluit. |
| Prijzen/weer ontbreken | Controleer bronstatus en ouderdom. Laat ingebouwde herpogingen/cooldowns werken; geen agressieve polling, gefingeerde prijzen of oude dagmail handmatig verzenden. |
| Verkeerde verzending / privacy-incident | Zet globale mailpauze aan, stop zo nodig de betrokken nieuwe publieke intake en gebruik dossierintrekking/suppressie voor de juiste scope. Bewaar bewijs privé en handel het rechten-/incidentproces bevoegd af. |
| Aanvraag niet opgevolgd | Open de werkvoorraad, controleer Pim-label, bereikbaarheid, volgende actie en actiedatum. Gebruik de nog te bekrachtigen vervangings-/terugbelafspraken; verzin geen afgeronde contactpoging. |
| Portal uitgeschakeld | Verwacht gedrag. Geen export activeren als oplossing voor andere storingen; zelfstandige opvolging blijft in Zonlio. |

Werk een incident pas af nadat de oorzaak is opgelost, een nieuwe geslaagde tick is opgeslagen en de betrokken service weer de verwachte status toont. Een storing in één service mag niet worden weggeschreven als opgelost uitsluitend omdat HTTP 200 terugkomt.

## 8. Mailpauze, code-rollback en dataherstel zijn aparte handelingen

### Globale mailpauze

Zet in de bestaande Hostinger-appconfiguratie **`MAIL_SEND_PAUSED=true`** en laat de app de wijziging via de normale herstart/deploy laden. Controleer in **Zelfstandig beheer** dat globale mailverwerking **Gepauzeerd** toont. Dit stopt nieuwe automatische verzendpogingen, dagmailplanning, beheeralerts en beheertestmails. Reeds begonnen externe SMTP-aflevering kan niet worden ingetrokken.

De pauze verwijdert geen dossiers en sluit een adviesformulier of accountintake niet op zichzelf. Stop bij een intake-incident alleen de betrokken publieke dienst via haar eigen gate. Laat cron bij een mailincident doorlopen zodat contactverval, technische opruiming en DB-heartbeats blijven werken. Een ontbrekende cron is een andere storing dan bewust gepauzeerde mail.

Bij hervatten eerst oorzaak, wachtrij, budget, verlopen plannen, stops en onzekere verzendresultaten beoordelen. Herstel uitsluitend een eerder expliciet vrijgegeven dienst naar haar toegestane stand. Een eerste publieke vrijgave of Portal-activatie volgt niet uit het opheffen van de noodstop.

### Code-rollback

Leg de actuele en laatste aantoonbaar werkende release vast. Pauzeer verzending bij twijfel over wachtrij-/contactgedrag. Publiceer alleen een gecontroleerde terugdraaiing naar een **schema- en privacycompatibele** versie via de normale GitHub-/Hostingerroute; geen force-push en geen productiegegevens terugzetten voor een uitsluitend codeprobleem.

Controleer vóór teruggaan dat de gekozen versie de huidige gates, suppressies, intrekkingen en additieve MySQL-tabellen respecteert. Een oude versie die nieuwere rechten negeert is geen veilige rollback. Houd MySQL, budgetregistraties en stopregisters intact. Controleer na deploy de bedoelde release, health, ingelogd beheer en geplande cron opnieuw. De instellingen in hPanel en de database zijn afzonderlijk van de Git-commit; leg hun gecontroleerde stand apart vast zonder waarden openbaar te maken.

### Back-up en afzonderlijke restoreproef

Gebruik de volledige procedure in [PRIVACY-OPERATIONS.md, niet-destructieve restoreproef](PRIVACY-OPERATIONS.md#5-niet-destructieve-restoreproef). Controleer de werkelijk beschikbare Hostinger-back-up, importeer alleen naar een **aparte** restore-/testdatabase en gebruik [scripts/verify-restore.mjs](../scripts/verify-restore.mjs) met privé `RESTORE_*`-configuratie. De checker leest alleen en stuurt geen mail; hij voert geen productieherstel uit.

Een actuele herstelmanifestvergelijking moet aantonen dat intrekkingen, correcties, afmeldingen, suppressies en gewiste accounts niet door een oudere back-up worden teruggedraaid. Beoordeel ook oude sessies en al eerder verzonden mails in de kopie. Houd de kopie geïsoleerd en mail/Portal uit. Het activeren van een restoredatabase vereist een afzonderlijk gecontroleerde omschakeling, inclusief wijzigingen sinds de manifestopname. **Deze productieback-up-/restoreproef is nog niet uitgevoerd.**

## 9. Opruiming en menselijke bedrijfsvoering

De automatische technische opruiming verwijdert onder meer verlopen sessies en oude operationele taakregels; de operationshistorie heeft een venster van dertig dagen. De ledenmodule ruimt eigen verlopen/verbruikte technische records volgens haar bestaande voorwaarden op. Dit is geen toestemming om actieve of gesloten klantdossiers automatisch te wissen.

Analytics ouder dan negentig dagen worden uitsluitend automatisch opgeschoond bij `ANALYTICS_RETENTION_CONFIRMED=true`. Laat deze gate uit totdat NIVO dat bewaarbeleid heeft goedgekeurd. Voor inhoudelijke dossierbewaring en uitzonderingen geldt het afzonderlijke privacyrunbook; het verstrijken van een contactvenster is geen volledige dossierverwijdering.

Pim houdt de werkvoorraad bij met contactpoging, bereikt/niet bereikt, afspraak, offerte en uitkomst. Volgende actie en datum maken achterstallige opvolging zichtbaar. Terugbeltermijn, maximaal aantal contactpogingen en vervanging bij afwezigheid zijn nog te bekrachtigen bedrijfsafspraken in E4; een opsalert vervangt deze afspraken of het gesprek met de consument niet.

## 10. Opleverbewijs en resterende gates

Werk na feitelijke uitvoering issue #1, #2, #9 en #10 en de [masterchecklist](COMPLETION-MASTER-CHECKLIST-2026-11-14.md) bij. Gebruik de [eigenaar-/vrijgavegates](OWNER-INPUT-AND-GATES-2026-11-14.md) en markeer alleen het aantoonbaar afgeronde onderdeel.

| Bewijs | Huidige grens / veilig vast te leggen resultaat |
| --- | --- |
| Geïnstalleerde cron | Nog hPanel-uitvoering nodig; opdracht zonder secrets, planning en geschoonde uitvoerstatus. |
| Drie geplande DB-ticks over herstart | Nog productieproef nodig; tijden, release-ID, succesregistraties, behouden historie en geaggregeerd instantieaantal. |
| GitHub-watch en storingsmelding | Code aanwezig; herhaalde echte runs en ontvangst van foutnotificaties afzonderlijk bewijzen. |
| Operationele mailwaarschuwing | Opt-in/werkelijk ontvangen waarschuwing nog aantonen; SMTP-acceptatie is onvoldoende. |
| Async bounces/klachten | Beheersuppressie gebouwd; bevoegde inboxbewaking en vervanging operationeel vastleggen. |
| Appbudget / providergebruik | Providerlimiet 100 bekend; exact runtime-appbudget en ruimte voor overig mailboxgebruik privé controleren. 50 blijft voorstel. |
| Volledige eigen account-/aanvraag-/dagmailproef | Nog apart uit te voeren binnen de reeds toegestane eigen testscope en per dienst vereiste veiligheidsvrijgave. Geen nieuw publiek verkeer voor een bewijsproef. |
| Back-up-/restoreproef | Nog aparte Hostinger-kopie en rechtenvergelijking nodig; geen echte productie-restore gedaan. |
| Publieke GO per dienst | Blijft een apart expliciet besluit na de bijbehorende bewijzen. Portal-export blijft uit. |

Een bewijsrecord bevat datum/tijd, commit/release, geteste stap, waargenomen status/tellingen, uitkomst en resterende beperking. Geen `.env`, SMTP-wachtwoord, cronsecret, sessiecookie, complete SQL-export, NAW, persoonlijk testadres of ongeschoonde e-mailheaders in de repository of een openbaar issue.
