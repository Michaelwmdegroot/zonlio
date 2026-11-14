# Zonlio — uitrol en beheer op Hostinger

Deze configuratie is voorbereid voor de eigen repository `Michaelwmdegroot/zonlio`, branch `main`, domein `zonlio.nl`. De stappen beschrijven het werk voor een beschikbare, geautoriseerde hostingkoppeling. De bestaande live site is via publieke GitHub-observatie bereikbaar. hPanel-sign-in is vanuit de cloudbrowser geblokkeerd; er is geen hostingmutatie uitgevoerd. Actuele installatie-/incidentstappen: [AUTONOMOUS-OPERATIONS.md](AUTONOMOUS-OPERATIONS.md).

## Hostingdoel

| Instelling | Waarde |
| --- | --- |
| Runtime | Node.js 24 |
| Type | Node.js / Express |
| Repository | `https://github.com/Michaelwmdegroot/zonlio` |
| Productiebranch | `main` |
| Projectroot | repositoryroot |
| Installatie | `npm ci` |
| Build | `npm run build` |
| Start | `npm start` |
| Ingang | `server.mjs` |
| Poort | Door het platform geleverde `PORT` |
| Database | Eigen MySQL-database, buiten de release-/buildmap |

Hostinger ondersteunt Node-apps op daarvoor geschikte Web- en Cloud-pakketten. Het aanwezige pakket en de juiste bestaande site moeten eerst via de hostingkoppeling worden gelezen. Neem niet aan dat een willekeurig hostingpakket voldoende is. Maak geen tweede site of betaalde upgrade zonder passend mandaat.

GitHub Actions controleert de code bij een push naar `main`. Een directe Hostinger GitHub-trigger kan onafhankelijk van Actions starten. Configureer een deployproces dat pas een geslaagde kandidaat publiceert; neem niet aan dat Hostinger automatisch op de checks wacht. Zodra uitrol werkt, horen branchbescherming en gecontroleerd samenvoegen bij het dagelijkse beheer.

## Serverconfiguratie

Vul waarden via de beveiligde serverconfiguratie in. `.env.example` bevat alleen sleutelnamen en openbare defaults. Geef geheime waarden nooit mee in een URL, chat, commit, issue, log of workflowbestand.

| Variabele | Doel |
| --- | --- |
| `NODE_ENV=production` | Productiegedrag en beveiligde cookies |
| `APP_URL=https://zonlio.nl` | Canonieke origin en links in e-mail |
| `DB_HOST`, `DB_PORT` | Bereikbare MySQL-host; Hostinger beschrijft `127.0.0.1`, standaardpoort 3306 |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Afzonderlijke productiedatabase en bevoegde gebruiker |
| `ADMIN_EMAIL=info@zonlio.nl` | Beheerdersaccount |
| `ADMIN_PASSWORD_HASH` | Scrypt-hash uit `npm run admin:create` |
| `SESSION_SECRET` | Willekeurig geheim van minstens 32 tekens |
| `CRON_SECRET` | Afzonderlijk willekeurig geheim van minstens 32 tekens |
| `LEAD_CONTROLLER_NAME` | Bevestigde juridische adviesontvanger |
| `LEAD_CONTROLLER_CONFIRMED=true` | Afzonderlijke bevestiging ontvanger; opent op zichzelf geen publieke dienst |
| `LEAD_ENABLED`, `HOUSING_ADVICE_ENABLED` | Afzonderlijke standaard uitgeschakelde intakeflags |
| `MEMBER_ACCOUNTS_ENABLED`, `DAYMAIL_SIGNUP_ENABLED`, `DAYMAIL_SEND_ENABLED` | Afzonderlijke accounts-, opt-in- en dagelijkse verzendvrijgave |
| `SMTP_DAILY_LIMIT` | Positief appbudget maximaal 100/24 uur; voorstel 50, geen automatisch recht op activering |
| `MAIL_SEND_PAUSED` | Noodstop voor alle nieuwe SMTP-verzendingen |
| `OPS_EXPECT_CRON`, `OPS_ALERTS_ENABLED`, `OPS_ALERT_TO` | Verwachte cron en expliciete operationele alarmering |
| `ANALYTICS_RETENTION_CONFIRMED` | Alleen na akkoord op 90-dagenbeleid voor pseudonieme interacties |
| `PORTAL_EXPORT_ENABLED=false` | Portal uit tot afzonderlijke aansluitacceptatie |
| `LEAD_NOTIFY_TO=info@zonlio.nl` | Interne notificatieontvanger |
| `SMTP_HOST=smtp.hostinger.com` | Uitgaande mailserver |
| `SMTP_PORT=465` | Directe TLS-verbinding |
| `SMTP_USER=info@zonlio.nl` | Mailboxlogin en afzender |
| `SMTP_PASSWORD` | Mailboxwachtwoord, uitsluitend serverzijdig |
| `MET_USER_AGENT=Zonlio/1.0 info@zonlio.nl` | Herkenbare weer-API-identificatie |

`PUBLIC_URL` is een compatibele alias voor `APP_URL`; gebruik één consistente waarde. `ALLOWED_ORIGINS` kan aanvullende eigen origins toestaan, maar is niet nodig voor één canoniek domein. `ANALYTICS_ENABLED=false` schakelt opt-in interactiestatistiek serverzijdig uit.

`TRUST_PROXY_HOPS` staat standaard uit. Stel alleen een bevestigd aantal vertrouwde proxyhops (1–3) in nadat de Hostinger-verzoeksketen is onderzocht. Zonder deze instelling kan pogingsbegrenzing op het proxyadres uitkomen; een verkeerd ingestelde waarde kan clientspoofing mogelijk maken. Dit vraagt een concrete controle op de echte host.

## Database en beheer

MySQL wordt bij de eerste verbinding met de applicatietabellen geïnitialiseerd, met InnoDB-transacties. Gebruik een lege, eigen applicatiedatabase. Laat hostback-ups aanstaan en verifieer herstel naar een afzonderlijke database. De code bevat geen destructieve automatische migratie of opschoontaak voor echte aanvragen.

Ontbrekende MySQL-configuratie opent geen tijdelijke productieopslag. De publieke prijs- en rekenmodules kunnen nog werken; productieaanvragen worden niet bevestigd. Ontbrekende beheerconfiguratie geeft geen standaardwachtwoord of beheerstoegang.

De normale start kiest standaard `production`. Alleen de expliciete QA-start kiest bij ontbrekende configuratie `development`. Een onbekende `NODE_ENV`-waarde wordt geweigerd; toegestane waarden zijn `production`, `development` en `test`.

`npm run admin:create` vraagt een nieuw wachtwoord verborgen in een interactieve terminal en maakt een hash. Plaats de hash en een afzonderlijk sessiegeheim in de serverconfiguratie. De beheerroute is `/admin`. Gebruik HTTPS voordat met echte gegevens wordt gewerkt. Een wachtwoordwijziging vraagt een nieuwe hash; wijzig ook het sessiegeheim om bestaande sessies ongeldig te maken.

## E-mail en onderhoud

De webapp verzendt via SMTP. Inkomende gewone e-mail blijft in de Hostinger-mailbox, die de eigenaar heeft opgegeven: IMAP `imap.hostinger.com`, poort 993, TLS. Er is geen IMAP-wachtwoord opgeslagen en geen volledige webmailclient in Zonlio ingebouwd.

De interne melding verwijst naar de aanvraag in `/admin`. Een aanvrager die e-mail heeft opgegeven krijgt een transactionele ontvangstbevestiging. De wachtrij staat in MySQL. Een mislukte verzending raakt de ontvangen aanvraag niet kwijt.

Configureer bij de uitrol een betrouwbare periodieke taak, bijvoorbeeld iedere vijf minuten, met een beveiligde serveromgeving:

```sh
npm run maintenance
```

Het script doet een HTTPS-POST naar `/api/tasks/maintenance` en leest het geheim uit `CRON_SECRET`. Het geheim staat in de Authorization-header, nooit in de URL. De server verwerkt begrensde lead-/accountbatches, scheduler en opschoning onder een persistente lease. Een overgeslagen overlappende run is geen afgeronde onderhoudstick. Gebruik het exacte Node24-pad en expliciete env-file uit [het runbook](AUTONOMOUS-OPERATIONS.md); een losse npm-opdracht erft in hPanel niet vanzelf de Node-appvariabelen. Vergroot geen volumes zonder quota-/capaciteitscontrole.

Hostinger documenteert beperkingen voor doorlopende achtergrondprocessen. De webapp start daarom geen permanente mailworker. De periodieke taak moet buiten het webverzoek om aantoonbaar blijven draaien, ook na een deployment. Een externe scheduler moet de Authorization-header veilig kunnen beheren. Schakel geen algemene marketing in via deze transactionele wachtrij.

De beheerknop **Verbinding controleren** verifieert SMTP-authenticatie zonder e-mail te sturen. Voor een daadwerkelijke afleveringstest is een expliciet gekozen testontvanger nodig. Controleer dan SMTP-resultaat, inbox/spam en de bijbehorende aanvraag. `sent` betekent dat SMTP de boodschap heeft geaccepteerd, niet dat een ontvanger deze heeft gelezen of ontvangen.

SPF, DKIM en DMARC worden op de werkelijke domeinconfiguratie gecontroleerd voordat betrouwbare bezorging wordt geclaimd. De alleen-lezen DNS-observatie en bewijsgrenzen staan in [MAIL-AUTHENTICATION-QA.md](MAIL-AUTHENTICATION-QA.md). DNS alleen bewijst nog geen ontvangen berichtauthenticatie. Vervang bestaande records niet zonder eerst de huidige instellingen te lezen.

## Concrete controles na verbinden

1. De juiste commit is gebouwd; `/api/health` meldt de verwachte versie en actuele servicestatussen.
2. `npm run readiness` slaagt zonder geheime waarden af te drukken. Controleer daarna daadwerkelijk MySQL en SMTP.
3. De echte prijsdag, morgenstatus, weerbron en alle vier modules werken op mobiel en desktop.
4. Beheer-login, uitloggen, cookies en statuswijzigingen werken via HTTPS op de canonieke origin.
5. Een gecontroleerde testaanvraag verschijnt één keer in beheer, inclusief contacttekst en gekozen kanaal. Test ook zonder gedeeld rekenprofiel.
6. De ontvangst blijft bij een tijdelijke mailstoring bestaan. De periodieke taak verwerkt de achterstand na herstel.
7. Een herstart/deployment houdt de aanvraag behouden in MySQL. Back-up en herstel zijn beproefd.
8. De bevestigde privacytekst, contactgegevens en operationele bewaartermijnen sluiten aan op de exploitant.

De gezondheidsroute is een diagnose, geen automatische vrijgave van alle productievoorzieningen. De prijs- en weercaches zijn procesgebonden; meerdere applicatie-instanties vragen een gedeelde limiter/cache voordat wordt opgeschaald.

## Herstel en dagelijks beheer

Bij een frontendreleaseprobleem kan de hostingkoppeling de vorige geslaagde commit opnieuw uitrollen. MySQL blijft buiten de releasebestanden. Rol een toekomstige schemaverandering alleen terug met een passende migratie- en back-upstrategie.

Controleer dagelijks nieuwe aanvragen en mislukte meldingen. Beperk interne notities tot noodzakelijke informatie. Een contactverzoek van 30 dagen is geen bewaartermijn. Leg een uitvoerbaar proces vast voor intrekking, inzage, verwijdering en periodieke beoordeling van oude leads; retentiepreview verwijdert niets. Geautoriseerde individuele correctie/wissing en de afzonderlijke restorechecker staan in [PRIVACY-OPERATIONS.md](PRIVACY-OPERATIONS.md).

## Officiële documentatie

- [Hostinger: Node.js-deployment](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/)
- [Hostinger: MySQL verbinden met Node.js](https://www.hostinger.com/support/connecting-a-hostinger-mysql-database-to-a-node-js-application/)
- [Hostinger: servervariabelen](https://www.hostinger.com/support/how-to-add-environment-variables-during-node-js-application-deployment/)
- [Hostinger: Node.js-limieten en achtergrondtaken](https://www.hostinger.com/support/hostinger-node-js-limits-for-web-and-cloud-plans/)
- [Hostinger: e-mailinstellingen](https://www.hostinger.com/support/4305847-set-up-hostinger-email-on-your-applications-and-devices/)
- [ChatGPT: websites die cloudbrowsertoegang blokkeren](https://help.openai.com/articles/20001280-using-cloud-browser-in-chatgpt#when-a-website-blocks-the-task)
