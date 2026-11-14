# Mijn Zonlio en dagmail — afrondingscorrecties en bewijs

**Datum:** 14 november 2026. **Scope:** account-/abonnement-/dagplanlogica en mailwachtrij, issue #9 en delen van #2/#10. Dit document is code- en lokaal testbewijs; echte productieaccount-, inbox-, cron- en restoreproeven blijven afzonderlijke acceptatiepunten.

## Verholpen problemen

1. **Bestaand account kon actief abonnement zonder apparaten krijgen.** Na bevestigde publieke inschrijving worden bij een niet-actief abonnement nu de bewust gekozen apparaten en tijden opgeslagen. Eerder opgeslagen contracttarieven en rekenscenario blijven behouden. Een reeds actief abonnement wordt door een losse herinschrijving niet overschreven. De bevestigingsmail beschrijft de gekozen editie, apparaten en tijden en deze werking.
2. **Herhaald afmelden kon een nieuw openstaande opt-in laten bestaan.** Ook een tweede klik op de stoplink annuleert alle nog open inschrijfbevestigingen en dagmails. De stopactie blijft idempotent: er verschijnt geen tweede identieke toestemmingswijziging.
3. **Een verlopen maillease kon nog door de oude worker worden gebruikt.** De laatste verzendcontrole vereist nu een geldige lease én de juiste claimtoken. Een oude worker kan een vervangende claim niet afronden.
4. **Een bezorgstop kon verdwijnen bij accountverwijdering.** Een additieve tabel `zonlio_delivery_suppressions` bewaart een SHA-256-code van het genormaliseerde e-mailadres, een beperkte reden en tijd. Klachten, bevestigde niet-bestaande adressen en een expliciete beheerstop annuleren openstaande mail/challenges en blokkeren nieuwe aanmeld-/inlogmails. Er is geen automatische opheffing. De hash is een pseudoniem, geen anonieme statistiek. De eigenaar moet dit beperkte stopbewijs opnemen in het bewaarbeleid en de herstelprocedure.
5. **Directe hard-bounce vóór eerste accountcreatie werd niet gestopt.** Een daadwerkelijke SMTP-fout met enhanced status `5.1.0` of `5.1.1` legt nu ook voor een eerste login-/inschrijfmail een verzendstop vast. Een `5.7.1` beleidsafwijzing wordt niet als onbekende mailbox behandeld. Dit verwerkt directe SMTP-feedback; asynchrone bounces en klachten vereisen een werkelijk aangesloten feedbackbron of gecontroleerde beheerhandeling.
6. **Schedulerresultaat in opslag was onvolledig.** `nothing_due`, `source_unavailable`, `complete` en `failed` worden nu als werkelijk resultaat opgeslagen. Geaggregeerde status bevat geblokkeerde adressen, oudste wachtende mail, laatste SMTP-acceptatie en schedulerresultaat zonder adressen.
7. **Onbruikbare prijsrespons kon de dagmailtaak laten crashen.** Lege, ongeldige, niet-aaneengesloten, gemengde of verschoven prijsintervallen leveren nu `unavailable` op. Alleen volledige, regelmatige kwartier-/uurdagen worden gebruikt. 23- en 25-uurdagen blijven geldig; vaste tarieven beloven geen tijdsvoordeel.

Een tweede additieve tabel `zonlio_member_erasure` bewaart bij verwijderen atomisch alleen de oude account-ID, de e-mailcode en de verwijdertijd. Het herstelmanifest kan hierdoor een oudere backup tegen actuele verwijderkeuzes controleren. Opnieuw inschrijven blijft mogelijk via een nieuwe expliciet bevestigde identiteit; een bestaande klacht-/bezorgstop blijft daarbij gelden. Ook dit beperkte verwijderbewijs hoort bij het door de eigenaar goed te keuren bewaarbeleid.

Voor transacties die challenge-, account- en abonnementsrechten combineren is de bestaande databasevolgorde gelijkgetrokken: eerst de gedeelde state-lock, daarna dossier-/challengemutaties. Dit voorkomt omgekeerde lockvolgorde tussen bevestigen en intrekken.

## Mijn Zonlio-ervaring

Het persoonlijke scherm vraagt na inloggen meteen het dagplan op: voor vandaag, of vanaf 18:00 Amsterdam voor morgen. Het gebruikt dezelfde serverfunctie als de mail. Een wijziging van mailvoorkeuren ververst alleen die voorkeuren en wist geen onopgeslagen energieprofiel. Enter-indiening werkt ook zonder expliciete browser-`submitter`.

Bij een bezorgstop wordt duidelijk waarom geen dagmail wordt verstuurd en blijft bestaande ingelogde toegang voor profiel, inzage/export en verwijdering beschikbaar. Activeren is dan zowel in de UI als server/database geblokkeerd. De eigen gegevensuitvoer vermeldt de reden/datum van de verzendstop zonder geheime tokens of hashes. De verwijderbevestiging legt uit dat minimaal verwijderbewijs en een eventuele verzendstop behouden blijven om de keuze na herstel te respecteren.

De centrale Blue Glass-stylesheet is ongewijzigd door deze accountcorrecties. Gratis publieke tools blijven zonder account beschikbaar.

## Noodstop en onafhankelijke vrijgave

Het ingestelde appbudget moet een geheel getal van 1 tot en met **100** zijn, de door de eigenaar bevestigde Hostinger-limiet per rollende 24 uur. Een waarde 101 wordt geweigerd voor configuratie en reserveringen. Dagmails gebruiken maximaal 80% van het ingestelde totaal; andere Zonlio-mails delen datzelfde budget. 50 blijft een voorgesteld conservatief appbudget, geen door deze wijziging ingestelde productiewaarde. Webmail/andere apps vallen buiten de appmeting en vragen ruimte onder het providerplafond.

`MAIL_SEND_PAUSED=true` is de globale noodstop van de operationsrelease. Accountmailverwerking neemt dan geen nieuwe claims; de dagplanscheduler maakt geen extra dagmailtaken. Open bevestigingen blijven in de wachtrij tot hervatten of hun eigen vervaldatum. Verlopen links worden niet alsnog verstuurd. Het pauzeren van mail verwijdert geen opgeslagen aanvraag.

De rootrelease scheidt algemene leadvrijgave met `LEAD_ENABLED` van de bevestiging van de exploitant. Daarmee kan een account/dagmailpoort afzonderlijk worden beoordeeld. Dit accountwerk zet geen enkele productieflag aan.

## Interne interfaces voor beheer en mail

- `store.members.suppressEmail(email, reason)` registreert een stop. Toegestane redenen: `hard_bounce`, `complaint`, `owner_request`. Alleen vanuit een geautoriseerde beheeractie of bevestigde directe mailfout aanroepen; geen publieke endpoint zonder sessie/CSRF.
- `store.members.suppressionForEmail(email)` geeft `{ reason, createdAt }` of `null`. Normaliseert hoofdletters/witruimte; de opslag bevat geen leesbaar adres.
- `store.members.blockDelivery(memberId, reason = 'hard_bounce')` gebruikt dezelfde duurzame stop.
- `stats()` bevat `deliveryBlocked`, `suppressedAddresses`, `oldestPendingAt`, `latestAcceptedAt`, `scheduler` naast bestaande tellingen. `latestAcceptedAt` betekent SMTP-acceptatie, geen inboxbewijs.

De stop behoort ook bij eventuele klantbevestiging in de algemene leadmailroute te worden gecontroleerd. Interne notificaties aan NIVO zijn een afzonderlijke ontvanger en blijven mogelijk. Herstel vanuit backup mag oude toestemmingen of verzendbare adressen niet opnieuw activeren: de actuele suppressielijst moet vóór hervatten worden toegepast.

## Uitgevoerd bewijs

| Controle | Resultaat | Reikwijdte |
| --- | --- | --- |
| `node --test tests/members.test.mjs tests/dayplan.test.mjs` | 27 tests geslaagd | Echte lokale HTTP-routes, geïsoleerde SQLite, synthetische gegevens, fake SMTP |
| `node --check src/member.mjs` | Geslaagd | Syntax, geen volledige browser-/Safari-validatie |
| `git diff --check` | Geslaagd | Geen patchwhitespacefouten bij controle |
| Extra echte-MySQL-subtest in `tests/mysql.integration.test.mjs` | Gebouwd; CI-resultaat volgt in algemene releasebewijs | Suppressieschema, claimannulering, stop na verwijdering, veilige opschoning synthetische testdata |

De 27 gerichte tests omvatten: standaard gesloten flags; identiteitcontrole; loginlink/hergebruik/expiry; expliciete POST; sessieverval; HttpOnly/SameSite-cookie; logout en echt opnieuw inloggen; eigendom/CSRF/revisie; aparte double opt-in zonder lead; wijzigingen van profiel; één logisch dagplan; verlopen plannen; herhaald intrekken; eenklik-POST; rollend gelijktijdig budget; retry; export/verwijdering; stop na accountverwijdering; foutcodeclassificatie; noodstop; ontbrekende prijsbron; volledige Amsterdamse klokwisseldagen en onuitvoerbare tijdvensters.

## Nog geen productieclaim

Geen echte e-mail verstuurd, geen eigenaarstestdossier aangemaakt, geen productiegegevens aangepast en geen vrijgave verleend door deze testset. De reeds ontvangen losse SMTP-testmail blijft bestaand eigenaarsbewijs. Voor issue #9 blijven vereist: eigen productieaccount en ontvangen login-/inschrijfmail; eigen profielwijziging/relogin/export; ontvangen dagplan; opt-out op de echte route; meerdere cronruns na herstart; daadwerkelijke mailauthenticatie en providerquota; restore en expliciete eigenaar-GO per dienst. Mobiele Safari en ontvangen afmeldheaders zijn niet bewezen door lokale Node-tests.
