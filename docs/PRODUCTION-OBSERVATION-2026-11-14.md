# Productieobservatie — 14 november 2026

**Actuele aanvulling op GROWTH-02-RELEASE-2026-11-14.md.** De eerdere directe DNS-/webcontrole vanuit de agentomgeving mislukte. Een daaropvolgende publieke controle vanuit GitHub Actions is wel gelukt. De nieuwe applicatierelease wordt daadwerkelijk op `zonlio.nl` geserveerd; commerciële activering en volledige end-to-end werking blijven afzonderlijke controles.

## Herkomst en reikwijdte

[Observatierun 43611644386](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43611644386), job `132497767889`, op broncommit `dc3902d523006176e973410a2b34e186058f0918`.

Controle gestart op **14 november 2026, 15:42:52 UTC / 16:42:52 Europe/Amsterdam**. Alleen twee openbare HTTPS-GET-verzoeken: `/api/health` en `/api/config`. Geen authenticatie, persoonlijke testgegevens, formulierinzending, e-mailverzending, databasewijziging of cron-aanroep.

De workflow `production-observe.yml` is handmatig opnieuw te starten en bevat geen periodieke planning. Hij verzamelt een beperkte waarneming; een groene workflow is op zichzelf geen productie-vrijgave. Het daadwerkelijke resultaat hieronder is uit de joblog gelezen.

## Waargenomen live resultaat

Beide routes: **HTTP 200**.

```json
{
  "ok": true,
  "version": "1.0.0",
  "releaseId": "growth-02-20261114",
  "databaseReady": true,
  "adminConfigured": true,
  "mailConfigured": true,
  "leadEnabled": false,
  "housingAdviceEnabled": false,
  "operatorConfigured": false,
  "controllerName": "NIVO Groep Holland BV",
  "accountsEnabled": false,
  "subscriptionsEnabled": false,
  "dailySendEnabled": false
}
```

Dit is een samengevoegde, geselecteerde weergave van health en config, geen letterlijke response van één route. De marker identificeert de applicatierelease; hij bewijst niet welke latere documentatiecommit Hostinger heeft gebouwd.

## Concreet resterend configuratiepunt

`operatorConfigured:false` betekent volgens `server/operator.mjs` dat de huidige expliciete `LEAD_CONTROLLER_NAME` en/of `LEAD_CONTROLLER_EMAIL` niet overeenkomt met de bevestigde centrale operator. Het is **niet** alleen het ontbreken van `LEAD_CONTROLLER_CONFIRMED=true`. De openbare `controllerName` komt uit de centrale bron en onthult niet welke oude environmentwaarde afwijkt.

Veilig in Hostinger controleren/corrigeren:

```dotenv
LEAD_CONTROLLER_NAME=NIVO Groep Holland BV
LEAD_CONTROLLER_EMAIL=info@zonlio.nl
```

Deze twee waarden zijn openbaar. Geen wachtwoorden of geheimen in chat plaatsen. Deze agent heeft de Hostinger-variabelen niet aangepast. Laat commerciële flags en `LEAD_CONTROLLER_CONFIRMED` uit totdat de operationele checks zijn afgerond; alleen de identiteit corrigeren is geen SMTP-, cron- of restorebewijs.

Voor accounts en inschrijving moet ook het echte beschikbare mailboxquotum worden vastgesteld en het conservatieve `SMTP_DAILY_LIMIT` daarop worden gebaseerd. Dat quotum is niet via deze publieke observatie vastgesteld.

## Wat nu wel/niet bevestigd is

**Wel:** bereikbare openbare API via een extern netwerk, verwachte applicatierelease, database-readinessmelding, aanwezige beheer/mailconfiguratie, NIVO als publieke operator en niet-geactiveerde intake/account-/dagmailfuncties.

**Niet:** volledige browserweergave, ingelogde productiebeheer-/accountsessie, SMTP-authenticatie, werkelijke inbox/spam, DNS-mailauthenticatie, afmeldheaderondertekening, betrouwbare cron-uitvoering, werkelijk mailquotum, productiebackup/restore, een eigenaarstest of ontvangst in de NIVO Portal/Odoo.

De eigenaar heeft de benodigde bedrijfskeuzes en toestemming voor zijn eigen gecontroleerde test al gegeven. Die hoeven niet opnieuw te worden gevraagd. Zijn persoonlijke testgegevens zijn nog niet gebruikt of gepubliceerd.

## Codekwaliteit

Applicatiecommit `da5d4c98c155392d6dba82d36e146b1950b42290`; vooraf gecontroleerd in run `43610800142`. De gewone main-CI op afsluitende commit `a87629c26863360a4de898cc5284f990ef941c8f` slaagde ook in [run 43611199157](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43611199157). Latere observatie-/documentatiewijzigingen veranderen de applicatie niet. Definitieve testdetails staan in `GROWTH-02-RELEASE-2026-11-14.md`.

Eerstvolgende operationele stap: bovenstaande ontvangerinstellingen in hPanel gelijkzetten, daarna met behoud van aparte activeringsschakelaars SMTP/quota/cron/restore en het reeds toegestane eigenaarstestdossier doorlopen. Portal-export pas na ontvangsttest volgens `PORTAL-CONTRACT-v1.md`; geen directe Odoo-route toevoegen.
