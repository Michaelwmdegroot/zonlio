# Zonlio — pilotafsluiting en overdracht (14 november 2026)

> **Besluit: technische pilot afgerond / commerciële lead-intake nog HOLD.**
> Deze overdracht is het actuele startpunt. Oudere release- en QA-documenten bewaren de geschiedenis, maar kunnen de toestand van vóór de livegang beschrijven.

## Identiteit en eigenaarschap

- Merk: **Zonlio** · belofte: **Jouw stroom. Helder in beeld.**
- Publiek domein: https://zonlio.nl
- Zakelijk contact: info@zonlio.nl
- GitHub: https://github.com/Michaelwmdegroot/zonlio, branch `main`
- Eigenaar kiest techniek, branding en vervolgrichting; Zonlio is een zelfstandig, gratis consumentenproduct met passend, vrijwillig advies via Thuisbatterij Team B.V. en mogelijk NIVO Groep Holland na een expliciete en juridisch consistente inrichting.
- Visuele richting: licht, premium, Apple/Mac-achtig, verfijnd en mobiel eerst. Rustige typografie, blauw en warme zonaccenten. Zie [BRANDING.md](BRANDING.md).

## Technische pilot — wat daadwerkelijk is bereikt

| Onderdeel | Status en bewijs |
| --- | --- |
| GitHub | Broncode op `main`. Laatste **applicatiecommit** vóór deze documentatieoverdracht: `328de76891172a5c6f45f07cf47e0c6d6812bbec`. |
| CI | [GitHub Actions run 43547783408](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43547783408) groen, inclusief syntax, tests, MySQL 8-integratie, build en dependency-audit. |
| Hosting | Gebruiker bevestigde in hPanel een geslaagde GitHub-implementatie van `main` naar `zonlio.nl` via **Cloud Professional, Node.js 24.x, Express**, root `/`, `npm run build`, entry `server.mjs`. Automatische implementatie ingeschakeld. |
| Live UI | De gebruiker stuurde een **productiescreenshot** van 14 november waarop het complete Overzicht met echte beursprijzen, grafiek en planner zichtbaar was. De eerdere lege hoofdinhoud en 503 zijn opgelost. |
| Health | Laatste door gebruiker verstrekte `/api/health`-uitvoer: `ok:true`, `mode:"live"`, `databaseReady:true`, `adminConfigured:true`, `mailConfigured:true`, `leadEnabled:false`; prijsbron `ready` en weerbron `ready` (bronupdates 2026-11-14 omstreeks 02:54 UTC). |
| Database | Eigen MySQL-database aangemaakt en toegang hersteld na eerdere `ER_DBACCESS_DENIED_ERROR`. Productie-health meldt `databaseReady:true`. |
| Beheer | `/admin` is geconfigureerd. Gebruiker meldt de beheeromgeving te hebben getest, maar er is geen onafhankelijke volledige test van alle ingelogde beheerschermen gedocumenteerd. |
| Mail | `info@zonlio.nl` is via Hostinger Mail in deze ChatGPT-omgeving als verbonden mailbox bevestigd. Productie `mailConfigured:true` betekent **configuratie aanwezig**, niet dat SMTP of daadwerkelijke inboxbezorging is geslaagd. |
| Leads | Code voor formuliervalidatie, optioneel rekenprofiel, vastgelegde contacttekst, MySQL-transactie, ontdubbeling, outbox en opvolgdashboard aanwezig. **Productie-intake staat bewust uit** met `leadEnabled:false`. |
| Externe verificatie | Rechtstreekse HTTP-controle vanuit de huidige assistentomgeving lukte niet door DNS-/webtoegangsbeperking. Een screenshot en health-uitvoer van de eigenaar zijn bewijs van zijn productiebrowser, geen afzonderlijke externe audit. |

## Huidige functies (scope van deze pilot)

1. **Overzicht:** Nederlandse day-ahead beursprijzen per 15 minuten, uuraggregatie, geselecteerde waarden en bronstatus, met expliciete scheiding tussen beursprijzen en persoonlijke contractkosten.
2. **Planner:** voordeligste toekomstig, aaneengesloten tijdvak voor voorbeeldapparaten. **Nog geen** koppeling met echte apparaten of lokale zonneopwek.
3. **Mijn 2027:** persoonlijke jaarrekenscenario's voor eigen gebruik, teruglevering, contractkosten na afloop saldering op 1 januari 2027. Rekenwaarden zijn aannames, geen garantie.
4. **Batterij:** indicatief jaarmodel dat extra waarde bovenop slimmer direct verbruiken berekent. **Nog geen** kwartiersimulatie, batterijvermogen, degradatie of volledige financiële businesscase.
5. **Weer:** regionale MET Norway-verwachting. Geen bewezen eigen-PV-opwekvoorspelling.
6. **Backoffice:** gebundelde weergaven van aanvragendata, opvolgstatus, notities, ruwe pageviews, opt-in statistieken, databronstatus en SMTP-wachtrij.
7. **Adviesroute:** keuze voor e-mail/telefoon en apart delen van rekenprofiel; géén nieuwsbriefinschrijving of algemene marketingtoestemming. In productie momenteel uitgeschakeld.

Bronnen: [DATA-SOURCES.md](DATA-SOURCES.md), [MODEL.md](MODEL.md), [LEADS-PRIVACY.md](LEADS-PRIVACY.md), [BRANDING.md](BRANDING.md).

## Productieproblemen opgelost tijdens de pilot

- Aanvankelijk werd de repository als onvolledige statische site gepubliceerd: alleen navigatie/footer zichtbaar. Correcte Hostinger Node.js Web App-deployment herstelde server/API.
- 503: Hostinger verwacht `listen()` binnen drie seconden, terwijl de oorspronkelijke ESM-entryguard en database-initialisatie dit konden vertragen. Opgelost met vroeg luisteren en beveiligde 503 totdat de app gereed is; regressietest `tests/hostinger-start.test.mjs`.
- Na de 503 gaf de UI nog kort geen hoofdinhoud; de gebruiker bevestigde daarna een volledig werkende versie.
- MySQL `ER_DBACCESS_DENIED_ERROR` bleek door database-/gebruikersrechten veroorzaakt; eigenaar herstelde deze. Laatste health meldde `databaseReady:true`.
- Een onschuldige logregel `luistert op poort undefined` kwam voor, hoewel de werkelijke site draaide; dit is logkwaliteit, geen vrijgaveblokkade. Niet de runtime wijzigen enkel om dit cosmetische probleem.
- Een tijdelijke melding `GitHub account komt niet overeen` verscheen in hPanel; latere screenshots tonen `Verbonden met GitHub` en automatische implementatie. Controleer dit opnieuw bij een volgende uitrol.

## Openstaande vrijgavepunten: NIET overslaan

**P0 — betrouwbaar adviesverzoek (commerciële livegang nog niet goedgekeurd)**

1. Bevestig juridische exploitant en adviesontvanger. **De huidige `/privacy` en `/contact` noemen Thuisbatterij Team B.V.**; de eigenaar heeft eerder ook `NIVO Groep Holland` ingevuld in hPanel. We weten niet welke waarde op dit moment live staat. Controleer `/api/config` en beveiligde hostingconfiguratie; maak website, tekst en ontvangende onderneming consistent. Documenteer de grondslag voor een gerichte terugbelactie en géén algemene marketing.
2. Test `/admin` echt: login, statuswijziging, notitie, uitloggen, opnieuw inloggen en toegangsweigering zonder sessie. Geen credentials in de chat.
3. Gebruik `Verbinding controleren` in het beheerdashboard en noteer de SMTP-authenticatie-uitkomst. Doe daarna **met eigen, expliciet toegestane testgegevens** één einde-tot-einde aanvraagtest (DB, notitie, outbox, serveracceptatie, inbox/spam). Nooit echte ongevraagde klantdata of fictieve contactgegevens gebruiken.
4. Configureer en verifieer een betrouwbare periodieke taak: `npm run maintenance` via een **beveiligde** scheduler, zonder `CRON_SECRET` in chat, commit, URL of publieke log. Controleer retries, failover en achterstand.
5. Controleer DNS voor SPF/DKIM/DMARC zonder bestaande mailrecords ongecontroleerd te overschrijven.
6. Bevestig verwerkingsovereenkomsten, bewaartermijn/verwijdering, recht op inzage/intrekking en databaseback-up plus **restoretest**. De huidige code ruimt echte leads niet automatisch op.
7. Pas na aantoonbare controles: `LEAD_CONTROLLER_CONFIRMED=true` instellen met expliciete toestemming van de eigenaar en gecontroleerde herimplementatie/herstart. Zorg dat `/api/health` `leadEnabled:true` meldt en verifieer opnieuw formulier + e-mail.

**P1 — betere ervaring en conversie (volgende agent)**

- Visuele premium redesign, in de bestaande lichte Zonlio-branding, zonder generieke AI-look. Sterke mobiele UX (320/375/390px), Safari en echte telefoon, details in grafiek, micro-interacties en toegankelijkheid. De huidige basis is bruikbaar, niet het eindontwerp.
- SEO met relevante, feitelijke inhoud (2027, terugleverkosten, stroomprijs, zon, batterij); snelheid, metadata, structured data waar toepasselijk. Geen honderden dunne AI-pagina's.
- Backofficefunnel: meet wat bron/scan/opt-in/aanvraag/kwalificatie echt betekent; geen bezoekersstatistieken zonder juiste toestemmingsbasis.
- Verdere productverfijning van contractinvoer, e-mailflow en rapporten. Meet gerealiseerde funnel op privacybewuste manier.

**P2 — uitbreidingen na meetbare pilots**

- PV-prognose met stralingsdata, oriëntatie/helling/verliezen, huisverbruik; gevalideerde persoonlijke optimalisatie.
- Battery dispatch model per kwartier met opslagvermogen, capaciteit, kosten, degradatie en werkelijke contractvoorwaarden.
- AI-uitleg uitsluitend gebaseerd op betrouwbare rekenresultaten en brondata; prijsvoorspellingen pas na backtesting, onzekerheidsbanden en baselinevergelijking.
- Eventuele NED-API voor productie/energiemix, **niet** als primaire stroomprijsfeed; voorwaarden voor publieke data-publicatie eerst toetsen.

## Beheer en veiligheid

- Hosting: Cloud Professional; automatische deployment direct vanaf `main`. **Let op:** Hostinger wacht niet aantoonbaar op groene GitHub Actions; zet risicoverhogende wijzigingen eerst op een testbranch, test vóór merge en houd herstel naar vorige commit mogelijk.
- Runtime: Node 24, Express, ES modules; `npm ci`, `npm run check`, `npm test`, `npm run build`. Productie vereist MySQL. CI gebruikt een aparte MySQL 8-testservice.
- Gebruikers-SSH-sleutel bestaat op zijn eigen Mac, maar is **niet nodig** voor de native Hostinger-GitHub-deployment. Geen privésleutel, SQL-/SMTP-wachtwoord, API-token, `.env` met ingevulde secrets of persoonsgegevens in de publieke GitHub-repo.
- Alle reken- en prijscijfers tonen het verschil tussen gepubliceerde data, contractinvoer en hypothese. Bewaar bronvermelding en licenties.
- Beheeradres `info@zonlio.nl`; IMAP `imap.hostinger.com:993`, SMTP `smtp.hostinger.com:465`. Deze servergegevens zijn publiek, authenticatie niet.
- Pas geen nieuwe betaalde dienst toe zonder toestemming eigenaar.

## Startpunt voor nieuwe agent

**Lees eerst [NEXT-AGENT-STARTPROMPT.md](NEXT-AGENT-STARTPROMPT.md).** Begin met een samenvatting van gerealiseerd/open en bevestig de live-status. Open daarna de P0-gates als checklist voordat visuele of functionele wijzigingen automatisch naar `main` worden gepubliceerd. De gebruiker wil in de volgende chat de visuals naar premium appniveau tillen en daarna verder bouwen, maar de lead-intake niet voortijdig openzetten.
