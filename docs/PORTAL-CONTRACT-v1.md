# Zonlio → NIVO Portal — intakecontract v1

**Status:** Zonlio-zijde geïmplementeerd en synthetisch toetsbaar. NIVO Portal is niet aangesloten; `PORTAL_EXPORT_ENABLED=false` blijft de productie-instelling. De enige toekomstige route is **Zonlio → NIVO Portal → bestaande Odoo-connect → Odoo**. Zonlio bevat geen Odoo-client, gedeelde database of vrij instelbare aflever-URL.

Dit contract beschrijft een duurzame **pull-wachtrij** met ontvangstbevestiging. De Portal beheert later een eigen periodieke taak. De Zonlio-backoffice blijft onafhankelijk beschikbaar voor opvolging door Pim. Een HTTP 200 of `accepted` event bewijst uitsluitend wat hieronder staat; het bewijst geen succesvolle Odoo-synchronisatie.

## 1. Grenzen en authenticatie

Beide endpoints vereisen:

- De afzonderlijke `PORTAL_EXPORT_ENABLED=true`-vrijgave, een beschikbare database en bevestigde, overeenkomende NIVO-operatorconfiguratie.
- Het afzonderlijke `PORTAL_EXPORT_TOKEN` met minimaal 32 willekeurige tekens. Gebruik niet het beheerwachtwoord, sessiegeheim of cronsecret.
- HTTPS naar de vooraf vastgelegde Zonlio-origin; de Portal mag het bearer-token niet volgen naar redirects of willekeurige hosts.
- `Authorization: Bearer <secret>` en `Content-Type: application/json`. Tokens in URL's, cookies of JSON gelden niet als authenticatie.

Het token verleent alleen toegang tot deze claim-/ack-routes. Het verleent geen algemene beheersessie, database-, account- of verwijderrechten. Tokenwaarden, claimtokens en eventpayloads blijven buiten logs, analytics, GitHub, foutmeldingen en screenshots. De responses hebben `Cache-Control: no-store`. Per afzender worden maximaal 60 geauthenticeerde requests per minuut verwerkt.

Een beheerde tokenrotatie staat in [PORTAL-ONBOARDING.md](PORTAL-ONBOARDING.md). Er is geen automatische publicatie of tokencreatie door het publiceren van deze code.

## 2. Claim — actuele dossierstaat ophalen

`POST /api/portal/claim`

Body: `{ "limit": 5 }`. Een leeg object gebruikt vijf; een opgegeven `limit` moet een geheel getal van 1 tot en met 10 zijn. Onbekende velden, arrays en `null` als limiet worden geweigerd.

Response: `{ "events": [...], "note": "..." }`. Een lege lijst is een geldige response. Elk event heeft een lease van **120 seconden**. Het volgende request kan andere events ophalen; dezelfde lease is pas na verval opnieuw beschikbaar. Een reclaim heeft dezelfde event-ID en een nieuw claimtoken.

De wachtrij bevat signalen dat een dossier is veranderd, **geen opgeslagen kopieën van vroegere persoonsgegevens**. Bij iedere claim wordt opnieuw de actuele lead gelezen en het actuele contactrecht gecontroleerd. Daardoor kunnen meerdere queue-events dezelfde recente revisie bevatten. Ook een vroeger aangemaakt queue-event geeft na intrekking geen oude naam/adresgegevens terug.

De maintenance-taak en de claimroute verwerken contactverval in begrensde batches. Verval trekt het contactrecht in, wist open contactacties, annuleert nog wachtende/verwerkende/gefaalde aanvraagmails en maakt voor passende woningaanvragen één nieuwe revisie en één stop-event. Dat gebeurt ook als de eerdere upsert al was bevestigd. Portal moet de meegestuurde vervaldatum bovendien zelf handhaven; wachten op een stop-event is geen reden om te blijven bellen.

### Gemeenschappelijke velden

| Veld | Type | Betekenis |
| --- | --- | --- |
| `id` | UUID-string | Duurzame queue-event-ID; voor ontdubbeling van ontvangst. |
| `claimToken` | UUID-string | Tijdelijke lease-identificatie; uitsluitend bijbehorende ack, nooit loggen. |
| `leaseExpiresAt` | ISO 8601 UTC-string | Exacte vervaltijd van deze lease. |
| `schema` | vaste string | `zonlio.portal.advice.v1`. Onbekende hoofdversie niet verwerken. |
| `source` | vaste string | `zonlio`. |
| `type` | enum | Zie eventtypen hieronder. |
| `requestId` | UUID-string | Vaste dossier-ID; unieke upsert-sleutel samen met `source`. |
| `reference` | string | Publieke Zonlio-aanvraagreferentie; niet gebruiken als autorisatietoken. |
| `revision` | niet-negatief geheel getal | Actuele, monotoon toenemende dossier-/contactrevisie. |
| `createdAt`, `updatedAt` | ISO 8601 UTC-string | Ontvangst en laatste dossierwijziging. |
| `observedAt` | ISO 8601 UTC-string | Tijd waarop Zonlio deze actuele staat serialiseerde. |
| `erasedAt` | ISO 8601 UTC-string, alleen bij erasure | Tijd waarop directe persoonsgegevens uit het Zonlio-dossier zijn gewist. |
| `status` | enum | `new`, `assigned`, `attempted`, `contacted`, `qualified`, `appointment`, `quoted`, `won`, `lost`, `closed`, `withdrawn`. |
| `controller` | object | `{name,email}`; bevestigde NIVO-entiteit en publiek Zonlio-contact. |
| `assignmentHint` | string | Verantwoordelijkheidslabel uit Zonlio, standaard `Pim`; geen autorisatie of nieuw medewerkersaccount. |
| `contact` | object | `{requested,expiresAt,version,text}`; actueel recht, einde contactperiode en opgeslagen formulierbewijs. |

Tijden zijn UTC; presentatie mag Europe/Amsterdam gebruiken. `contact.requested` betekent alleen het specifieke adviescontact binnen doel en termijn. Het verleent geen marketingtoestemming. De oorspronkelijke bewijstekst wordt niet achteraf herschreven.

### Eventtypen

| `type` | Betekenis | Extra persoonsgegevens |
| --- | --- | --- |
| `advice.upsert` | Actief woningadvies met geldig contactrecht. | Ja, uitsluitend onderstaande velden. |
| `advice.withdrawn` | Contactverzoek ingetrokken. | Geen. |
| `advice.closed` | Dossier `won`, `lost` of `closed`. Stop verdere leadopvolging binnen dit verzoek. | Geen. |
| `advice.contact_expired` | Contactperiode verstreken of geen actief contactrecht. | Geen. |
| `advice.erased` | Directe persoonsgegevens gewist; ontvanger moet de eigen kopieën volgens de afgehandelde rechtenopdracht wissen. | Geen. |

De pre-integratiecode gebruikte voor een upsert de afwijkende naam `advice.snapshot`. Dat is vóór aansluiting gecorrigeerd naar de reeds gedocumenteerde `advice.upsert`. Er is nog geen actieve ontvanger die moet worden gemigreerd. Een toekomstige ontvanger moet de exacte bovenstaande enum gebruiken.

Alleen `advice.upsert` bevat:

| Veld | Inhoud |
| --- | --- |
| `person` | `name`, `phone`, `email` (een optioneel e-mailadres kan leeg zijn). |
| `housing` | `street`, `houseNumber`, `addition`, `city`, `postcode`. |
| `topic` | `battery`, `solar`, `charging`, `heatpump` of `other`. |
| `message` | Vrijwillig ingevulde hulpvraag. Niet naar technische logs kopiëren. |
| `sourcePath` | Module: `overzicht`, `planner`, `2027` of `batterij`. |
| `scenario` | `null` of uitsluitend het expliciet gedeelde numerieke rekenprofiel. |
| `contactPreference` | `any`, `morning`, `afternoon` of `evening`; geen bevestigde afspraak. |

Stop-events laten al deze velden geheel weg, ook `message` en `scenario`. Ze bevatten alleen de noodzakelijke identificatie, revisie, zakelijke ontvanger en contactstatus. Een algemene adviesvraag zonder woningintake, een andere controller en een dagmailabonnee worden niet als woningadvies geëxporteerd. De huidige serializer is toetsbaar als `portalEvent()` in `server/portal.mjs`.

## 3. Ack — duurzame Portal-ontvangst bevestigen

`POST /api/portal/ack`

```json
{
  "id": "00000000-0000-4000-8000-000000000001",
  "claimToken": "00000000-0000-4000-8000-000000000002",
  "portalReference": "portal.synthetic-example-1"
}
```

Dit is een volledig synthetisch vormvoorbeeld. `portalReference` is een intern, niet-persoonlijk dossierkenmerk met 1–120 tekens uit `A-Z a-z 0-9 . _ : -`. Geen naam, telefoonnummer of e-mailadres.

Portal bevestigt uitsluitend **na commit** van de eigen ontvangsttransactie: eventreceipt, dossierstaat en de nodige downstream-opdracht moeten duurzaam bestaan. Een tijdelijke in-memory ontvangst of alvast geplande achtergrondtaak voldoet niet.

| Situatie | Uitkomst |
| --- | --- |
| Geldige lease, duurzame ontvangst | HTTP 200, `{ "ok": true }`. |
| Identieke ack nogmaals, zelfde event/token/Portal-referentie | HTTP 200, ook wanneer de eerdere HTTP-response verloren ging. |
| Onbekend event, fout/oude lease, vervallen lease vóór acceptatie | HTTP 409; opnieuw claimen. |
| Geaccepteerd event met andere Portal-referentie of ander token | HTTP 409; bestaande ontvangst niet overschrijven. |
| Ongeldig requestcontract | HTTP 422. |

Een transport-ack verandert nooit de zakelijke dossierstatus of het contactrecht in Zonlio. Na intrekking kan een oude, nog geldige lease worden bevestigd; dat opent het ingetrokken dossier niet opnieuw. De Portal moet de revisieregel ook toepassen als een oudere upsert **na** een nieuwer stop-event arriveert.

## 4. Verplicht ontvangergedrag

1. **Upsert op `(source, requestId)`** en ontdubbel ontvangst op event-ID; geen automatische samenvoeging van verschillende bewoners op een adres.
2. Verwerk eventreceipt, hoogste ontvangen revisie, contactstatus en downstream-opdracht in één transactie. Ack pas na commit.
3. Een lagere revisie mag nooit een hogere overschrijven. Een gelijke revisie is een herhaalde actuele snapshot, geen nieuwe lead. Een stop en een verstreken `expiresAt` mogen nooit door replay worden teruggedraaid.
4. Controleer voor ieder contact dat `contact.requested=true`, het verzoek niet gesloten/ingetrokken is en `contact.expiresAt` nog in de toekomst ligt. Houd bij twijfel contact gepauzeerd. De ontvangsttijd van een bericht verlengt de toestemming niet.
5. Bewaar lokale verkoopnotities/afspraken los van door Zonlio aangeleverde bronvelden; een replay wist geen eigen werk. De Portal bepaalt wie de velden mag zien.
6. Een stop-event zet vervolgcontact stil en maakt een duurzame opdracht voor de bestaande Odoo-connect. `advice.erased` vraagt daarnaast om verwijdering van de betreffende bronpersoonsgegevens en de noodzakelijke afhandeling in de downstream-systemen; alleen een statuswijziging naar ingetrokken is daarvoor onvoldoende. Eventuele noodzakelijke wettelijke bewaarplichten beoordeelt NIVO afzonderlijk. De Portal beheert Odoo-retries; een Odoo-storing mag het stopverzoek niet verliezen.
7. Heropen een ingetrokken of verlopen verzoek niet automatisch. Een nieuwe bewuste adviesaanvraag heeft een nieuw Zonlio-dossier. Dagmailtoestemming is nooit een vervangend belrecht.
8. Sla geen ruwe eventpayload, headers, claimtoken of klantgegevens op in technische logs. Operationele monitoring gebruikt tellingen, niet-persoonlijke referenties en foutcategorieën.

## 5. Fouten, retries en achterstand

| HTTP-status | Portal-actie |
| --- | --- |
| 200 | Claim verwerken of duurzame ack registreren. |
| 401 | Stop loop; token/configuratie onderzoeken. Niet eindeloos herhalen. |
| 409 bij ack | Lease niet meer geldig; opnieuw claimen, idempotent verwerken en de nieuwe lease bevestigen. |
| 415 / 422 | Contractfout; stop betreffende verzending en herstel de client. |
| 429 | Wacht minimaal één minuut met begrensde jitter; geen strakke retryloop. |
| 503 | Export/configuratie staat uit of is onbeschikbaar; geen bewijs van gegevensverlies. Pauzeer en controleer veilige status. |
| 5xx / netwerk-timeout | Exponentiële backoff met bovengrens; lease mag vervallen. Geen ack gokken. |

De lease is 120 seconden. Een Portal-batch moet ruim daarbinnen duurzaam kunnen worden verwerkt. Claim anders minder events. Een verloren response kan leiden tot herlevering: de semantiek is **at least once**, geen garantie dat elk event maar eenmaal over de verbinding gaat.

De afgeschermde Zonlio-statistiek toont tellingen voor pending/leased/accepted plus leeftijd van de oudste open taak, verlopen leases en laatste acceptatie. Geen wachtrij handmatig leegmaken om een rood dashboard groen te maken. Zie replay en herstel in de onboarding.

## 6. Verificatie en vrijgavegrens

`node --test tests/portal.test.mjs` controleert met lokale, synthetische SQLite-data: gesloten flags, bearer-/JSON-validatie, exact schema, optionele scenariodeling, concurrente claims, leaseverval, oude worker, idempotente ack, persistente replay na opnieuw openen, revisies, intrekking, erasure, automatisch verval na eerdere acceptatie, dataminimalisatie en scheiding tussen abonnement en woningadvies. Er worden geen echte e-mails of Portal-requests uitgevoerd.

De echte MySQL-driver/transacties moeten via de aparte MySQL 8-CI-gate worden bevestigd. Een geslaagde lokale suite bewijst geen echte Portal-ontvangst, productiecron of downstream Odoo. De uiteindelijke aansluitacceptatie en tokenrotatieprocedure staan in [PORTAL-ONBOARDING.md](PORTAL-ONBOARDING.md).
