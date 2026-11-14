> **Historische fase.** Gebruik voor de huidige flags, cron en acceptatie [release 04](AUTONOMY-04-RELEASE-2026-11-14.md), [DEPLOYMENT.md](DEPLOYMENT.md) en [het operationsrunbook](AUTONOMOUS-OPERATIONS.md). Bedrijfsbevestiging opent algemene intake niet: `LEAD_ENABLED` is apart.

# Testrelease 03 — testen en activering

14 november 2026. De eigenaar heeft de omgevingsvariabelen gecontroleerd en gevraagd de huidige bouwfase op main klaar te zetten om te testen. **Geen opdracht om zonder controles commerciële functies te activeren.**

Applicatierelease: `test-ready-03-20261114`. De bestaande account-, dagmail- en adviesfuncties uit groei-iteratie 2 blijven behouden. De ontvangende NIVO Portal-koppeling, volledige bounce-/klachtverwerking, medewerkersrollen, wekelijkse mail en verdere model-/AI-functies zijn niet ineens voltooid door deze testrelease.

## Wat er nu is toegevoegd

- `/admin#testen`: uitklapbare, afgeschermde controle van de daadwerkelijk draaiende backend. Naam en contactadres worden afzonderlijk gecontroleerd. Geen rauwe hostingwaarden, wachtwoorden, tokens of klantgegevens in de uitkomst.
- Databaseleesproef, origin-/aliascontrole, mailconfiguratie, werkelijk ingestelde appbudgetvoorwaarde, aparte functieschakelaars en onderhoudssleutel zijn gescheiden zichtbaar.
- De bestaande SMTP-verificatie verstuurt geen mail. De uitslag en datum worden alleen in het huidige proces onthouden; na herstart is de uitslag weer onbekend. Een geslaagde verbinding wordt nooit als inboxbezorging benoemd.
- Verversen van het dashboard haalt ook publieke configuratie opnieuw op; geen oude configuratiestatus uit alleen de eerste paginalading blijven tonen.
- `npm run test:live`: twaalf uitsluitend openbare GET-controles op de release, pagina's, stylesheets/modules en toegangsweigering tot beheercontrole en een privéprofiel. Geen authenticatie, testlead, mail, mutatie of onderhoudstaak.
- De publieke observatieworkflow draait na een geslaagde main-CI (of handmatig), met een begrensd herprobeervenster voor Hostinger. Een ontbrekende release of kapotte route geeft nu een mislukte controle, niet alleen een groene workflow met waarschuwing. Uitgeschakelde functies zijn wel toegestaan: publicatiecontrole is geen commerciële vrijgave.

## Belangrijk vóór de eigenaarstest

De eigenaar gaf eerder de exacte NIVO-identiteit, route Zonlio → NIVO Portal → Odoo, Pim als opvolger, mailvoorkeuren en toestemming voor een eigen testdossier. Die informatie niet opnieuw vragen en de persoonlijke testcontactgegevens niet in Git, logs of screenshots plaatsen.

Een read-only hercontrole vanuit GitHub op **14 november 2026 om 17:02:58 Europe/Amsterdam** zag nog `operatorConfigured:false` op de vorige release, naast uitgeschakelde intake, accounts en dagmail. Dat is een runtimewaarneming, geen verklaring dat de eigenaar niets gewijzigd heeft. Een opgeslagen instelling kan nog niet in het actieve proces zijn geladen. Na de nieuwe deployment opnieuw controleren; de nieuwe losse booleans `operatorNameMatches` en `operatorContactMatches` wijzen de betreffende sleutel aan zonder de ingestelde waarde bloot te geven.

## Testvolgorde voor de eigenaar

### 1. Controleer eerst zonder iets te activeren

Open `/admin#testen` en log in met het bestaande beheeraccount. Klik **Controle verversen**. De marker moet `test-ready-03-20261114` zijn. Controleer bedrijfsnaam, contactadres, database en origin.

Bij een rode naam/contactcontrole: controleer de variabele van de **bestaande Zonlio Node.js-app**, eventuele dubbele/oude waarden en de actieve deployment. Sla op en herstart/herimplementeer. De verwachte openbare waarden zijn:

```dotenv
LEAD_CONTROLLER_NAME=NIVO Groep Holland BV
LEAD_CONTROLLER_EMAIL=info@zonlio.nl
APP_URL=https://zonlio.nl
```

Als PUBLIC_URL ook bestaat, mag deze niet naar een andere origin wijzen. Deel geen geheimen. `LEAD_CONTROLLER_CONFIRMED` is een aparte activeringsbevestiging, niet dezelfde controle als de bedrijfsnaam.

### 2. Controleer mail en herstel

Klik **SMTP-verbinding testen**. Dit controleert alleen verbinding/authenticatie, niet aflevering. Controleer in hPanel het daadwerkelijke uitgaande mailboxquotum en beschikbare ruimte voor de app, SPF/DKIM/DMARC en een databaseback-up plus restore naar een aparte database. Geen productiegegevens wissen of terugzetten voor een test.

`SMTP_DAILY_LIMIT` blijft een conservatief werkelijk vastgesteld appbudget, geen willekeurige voorbeeldwaarde. De beheermodule toont alleen of het voldoet aan de technische voorwaarde; hij bewijst niet welk pakketquotum Hostinger heeft toegekend.

### 3. Gerichte activering na de checks

Technische schakelaars voor de eerste gecontroleerde account-/adviesproef:

| Sleutel | Bedoeling |
| --- | --- |
| `LEAD_CONTROLLER_CONFIRMED=true` | Expliciete vrijgave van de bevestigde ontvanger, na de operationele checks |
| `HOUSING_ADVICE_ENABLED=true` | Nieuwe woningadviesroute beschikbaar |
| `MEMBER_ACCOUNTS_ENABLED=true` | Mijn Zonlio-toegang aanvragen en bevestigen |
| `DAYMAIL_SIGNUP_ENABLED=true` | Dagplaninschrijving met bevestiging testen |
| `SMTP_DAILY_LIMIT` | Zelf vastgesteld positief appbudget binnen het werkelijke mailboxquotum |
| `DAYMAIL_SEND_ENABLED=false` | Automatische dagverzending nog uit tijdens de eerste proef |
| `PORTAL_EXPORT_ENABLED=false` | Uit totdat de ontvangende Portal echt aangesloten en getest is |

**Deze schakelaars zijn publieke functieschakelaars, geen technische eigenaar-allowlist.** Zet ze niet aan onder de aanname dat uitsluitend de eigenaar toegang krijgt. Er is in deze release geen nieuwe verborgen bypass of testlogin toegevoegd. Een codepublicatie verandert de waarden niet.

### 4. Doorloop de echte routes

Gebruik het reeds toegestane testdossier buiten Git:

- Maak vanuit Mijn 2027 of Batterij een woningadviesaanvraag. Controleer één aanvraagnummer, NAW, gekozen onderwerp, optionele scenariodeling en Pim als opvolglabel in `/admin`.
- Controleer bevestiging/notificatie in de daadwerkelijke inbox én spam. Een geslaagde SMTP-status alleen is onvoldoende. Bij uitval moet de aanvraag bewaard blijven.
- Vraag op `/mijn` toegang aan, bevestig de eenmalige link bewust, sla een profiel op, log uit/in en controleer dat het profiel bewaard blijft. Test een al gebruikte link en een niet-ingelogde toegang.
- Schrijf expliciet in voor een dagplan en bevestig de e-mail. Controleer dat dit geen nieuwe verkoopaanvraag maakt. Test pauzeren/afmelden.
- Trek de testaanvraag in via beheer. Controleer dat vervolgacties en wachtende meldingen worden gestopt. Een test kan in operationele totalen zichtbaar blijven; voer geen handmatige SQL-verwijdering uit om aantallen op te poetsen.

### 5. Daarna pas periodieke mail en Portal

Richt `npm run maintenance` in via een beveiligde periodieke servertaak. De sleutel gaat in de Authorization-header, nooit in de URL. Controleer herhaalde uitvoering na herstart, daadwerkelijk bezorgde dagplannen, afmelding en de queue. De afmeldheaders vereisen ook verificatie op de echte SMTP-route.

Zet `DAYMAIL_SEND_ENABLED` pas na de afzonderlijke dagmailproef aan. Sluit de Portal aan volgens `docs/PORTAL-CONTRACT-v1.md`; pas daarna Portal-export testen en vrijgeven. Geen directe Odoo-route in Zonlio.

## Bewijsgrenzen van deze ronde

Lokaal: Node 24, syntaxcheck, **113 tests waarvan 112 geslaagd en één afzonderlijke MySQL-gate lokaal overgeslagen**, build met 27 publieke bestanden. Bestaande integratiechecks testen de HTTP-authenticatie, CSRF, SMTP-verify zonder verzending en uitblijven van gegevensmutaties door de diagnose.

De twaalf read-only probes slaagden tegen de lokale testbackend. De nieuwe component is met werkelijke stylesheet en lokale backendrespons op 320/375/390/768/1440 px beoordeeld, zonder horizontale pagina-overflow; details openen/sluiten werkt met toetsenbord. Dit was een statische componentfixture omdat browsernavigatie naar localhost door de omgeving werd geblokkeerd. Geen volledige browser-E2E, fysieke Safari-test of productiecookiecontrole claimen.

GitHub-MySQL, definitieve main-commit en productieobservatie worden na uitvoering als afzonderlijk bewijs vastgelegd. Geen echte SMTP-mail of eigenaarstest is in deze lokale ronde verstuurd. Het controlescherm houdt operationele bewijsstukken bewust op ‘afzonderlijk te bevestigen’; het is geen compleet auditregistratiesysteem.
