> **Historische fase.** Gebruik voor de huidige flags, cron en acceptatie [release 04](AUTONOMY-04-RELEASE-2026-11-14.md), [DEPLOYMENT.md](DEPLOYMENT.md) en [het operationsrunbook](AUTONOMOUS-OPERATIONS.md). Bedrijfsbevestiging opent algemene intake niet: `LEAD_ENABLED` is apart.

# Hostinger livegang — Zonlio (GitHub `main`)

Laatst bijgewerkt: 14 november 2026. > **Statusupdate 14 november 2026:** De oorspronkelijke stappen hieronder documenteren de installatieprocedure. **De bestaande Node.js-app is inmiddels door de eigenaar succesvol via GitHub `main` op `zonlio.nl` gepubliceerd**, met Cloud Professional / Node 24 / Express. De prijs- en weerdata werken; health toont MySQL en beheer gereed. Er hoeft **geen nieuwe website** te worden aangemaakt. Lees eerst [de pilotoverdracht](PILOT-HANDOFF-2026-11-14.md) vóór nieuwe wijzigingen. Lead-intake blijft uit totdat end-to-end geverifieerd.

De onderstaande stappen zijn **historische installatie-instructies** voor een eerste Hostinger Web App en niet opnieuw uitvoeren voor de bestaande live Zonlio-site.

Voor de bestaande app is de actuele testvolgorde: [Testrelease 03](TEST-RELEASE-2026-11-14.md). De historische installatieprocedure hieronder is geen reden om een tweede site te maken.

## 1. Kies de juiste Hostinger-integratie

Voor Zonlio is de voorkeursroute **Websites → Create site → Web App → Import your Git repository**. Koppel de **bestaande** repository `Michaelwmdegroot/zonlio` en selecteer `main`.

**Gebruik niet** het menu **Geavanceerd → GIT** voor de Node/Express-app. Dat menu is bedoeld voor PHP/HTML-websites en bouwt/host niet automatisch een Node-backend.

Deze keuze maakt een eigen GitHub Actions-SSH-deploysleutel overbodig. Hostinger haalt automatisch nieuwe commits op en bouwt de app zelf. De eerder aangemaakte SSH-sleutel is optioneel bruikbaar voor veilige diagnoses maar is geen vereiste voor deze uitrol.

Bronnen:
- https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/
- https://www.hostinger.com/support/1583302-how-to-deploy-a-git-repository-in-hostinger/
- https://www.hostinger.com/support/hostinger-node-js-limits-for-web-and-cloud-plans/

## 2. Controleer de bestaande website voordat je iets vervangt

In hPanel staat `zonlio.nl` al als website met SSH-toegang. **Controleer eerst het hostingpakket en website-type.**

- Hostinger Business/Unlimited en Cloud ondersteunen de begeleide Node Web App-deployment; andere plannen mogelijk niet.
- Een bestaand domein dat al aan een PHP/HTML-site hangt kan eerst een andere websitekoppeling of tijdelijke test-URL vereisen. Laat eerst de huidige bestanden, mailboxen en DNS-instellingen intact.
- Start desgewenst met de aangeboden **tijdelijke Hostinger-domeinnaam** voor een gecontroleerde proef. Koppel `zonlio.nl` pas als de app, database, HTTPS en contactroute aantoonbaar werken.
- Het wijzigen van een deploymentrepository kan bestaande websitebestanden overschrijven. Bevestig vooraf de locatie en bewaar zo nodig een back-up.
- Maak niet ongepland een tweede betaalde hostingdienst aan of voer geen pakketupgrade uit.

## 3. Selecteer de bron en Node-instellingen

| Instelling | Zonlio |
| --- | --- |
| GitHub-account | Repo-eigenaar die toegang heeft tot `Michaelwmdegroot/zonlio` |
| Repository | `Michaelwmdegroot/zonlio` (**importeren**, geen kopie maken) |
| Branch | `main` |
| Framework | `Express` indien aangeboden; anders `Other` |
| Node.js-versie | `24.x` |
| Root directory | Repositoryroot (`/`) |
| Package manager | `npm` |
| Build command | `npm run build` |
| Entry file | `server.mjs` |
| Start command (indien gevraagd) | `npm start` |
| Output directory | `dist` waar Hostinger expliciet de gegenereerde bestanden vraagt; voor server-side Express **niet als statische website publiceren** |
| Listening port | Hostinger levert `PORT`; geen vaste publieke poort configureren |

Hostinger biedt automatische deployment op commits naar de gekozen branch. De aparte GitHub Action `check.yml` controleert tests en MySQL, maar Hostinger wacht **niet noodzakelijk** op een groene Action voordat het een nieuwe commit uitrolt. Voor wijzigingsbeheer: gebruik geteste branches en bescherm `main` waar mogelijk.

## 4. Beveiligde configuratie

Zet de waarden in **Node.js Web App → Environment Variables**. Plaats ze **nooit** in `.env` in de publieke repo, een chatbericht, website-url of GitHub Actions-log.

Minimaal voor productie:

```text
NODE_ENV=production
APP_URL=https://zonlio.nl
DB_HOST=[Hostinger-databasehost]
DB_PORT=3306
DB_NAME=[eigen lege Zonlio-database]
DB_USER=[databasegebruiker]
DB_PASSWORD=[geheim]
ADMIN_EMAIL=info@zonlio.nl
ADMIN_PASSWORD_HASH=[geheime scrypt-hash uit admin:create]
SESSION_SECRET=[eigen willekeurig geheim, 32+ tekens]
CRON_SECRET=[ander willekeurig geheim, 32+ tekens]
LEAD_CONTROLLER_NAME=NIVO Groep Holland BV
LEAD_CONTROLLER_EMAIL=info@zonlio.nl
LEAD_CONTROLLER_CONFIRMED=false
LEAD_NOTIFY_TO=info@zonlio.nl
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=info@zonlio.nl
SMTP_PASSWORD=[mailboxgeheim]
MET_USER_AGENT=Zonlio/1.0 info@zonlio.nl
```

**Aanvragen blijven uit** zolang de juridische ontvanger/privacytekst niet bevestigd is (`LEAD_CONTROLLER_CONFIRMED=false`). De publieke prijs- en rekentool kan wel werken. Production gebruikt uitsluitend een echte MySQL-database. Maak eerst de database aan en controleer een werkende verbinding. Zet nooit een lokaal SQLite-bestand in een tijdelijke releasefolder als productieopslag.

Wanneer de app aanvankelijk op een tijdelijke preview draait, gebruik `APP_URL` dat exact bij die HTTPS-URL past en wijzig het pas bij de domeinwissel.

## 5. Cron en mail

De aanvraag gaat eerst samen met het contactbewijs en de mailopdrachten in MySQL. Vervolgens verwerkt `npm run maintenance` de verzendwachtrij. Hostinger Node-hosting ondersteunt geen permanent draaiende achtergrondworker; configureer een ondersteunde periodieke Node.js-taak via hPanel en verifieer de uitvoering.

Een succesvolle SMTP-aanmelding is geen bewijs dat een bericht in de inbox is afgeleverd. Test één uitdrukkelijk toegestane ontvanger en controleer inbox, spam en SPF/DKIM/DMARC zonder bestaande DNS-records te overschrijven.

## 6. Vrijgavecontroles vóór publiek verkeer

1. Hostinger toont **deployment succeeded** met een commit op `main`.
2. `/api/health` toont `ok:true` op het beoogde HTTPS-domein; geen wachtwoorden of geheimen verschijnen.
3. `/api/prices` geeft een bronvermelde werkelijke prijsdag; morgenstatus en bronstoringen zijn begrijpelijk.
4. De vier modules en mobiel scherm werken; inloggen en uitloggen bij `/admin` werken via HTTPS.
5. Een expliciet toegestane testaanvraag komt éénmaal binnen en blijft aanwezig na herstart.
6. De mailwachtrij en cron draaien; een echte bevestiging komt in de gekozen inbox aan.
7. Een recente databaseback-up en herstelroute zijn bekend.
8. Privacy-/contactpagina, juridische ontvanger en onderhoudsprocedure zijn bevestigd vóór `LEAD_CONTROLLER_CONFIRMED=true`.

Zie ook [DEPLOYMENT.md](DEPLOYMENT.md), [RELEASE.md](RELEASE.md) en [QA.md](QA.md).
