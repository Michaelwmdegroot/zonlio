# Zonlio → NIVO Portal — intakecontract v1

Status: **Zonlio-zijde geïmplementeerd, ontvanger nog niet aangesloten**. De route naar Odoo loopt uitsluitend via de bestaande Portal/Odoo-connect. Geen gedeelde database, algemene webhook-URL of directe Odoo-credentials in Zonlio.

## Authenticatie

`PORTAL_EXPORT_ENABLED=true` én afzonderlijk `PORTAL_EXPORT_TOKEN` met minimaal 32 willekeurige tekens, naast de bevestigde NIVO-operator. Portal-verzoeken gebruiken HTTPS en `Authorization: Bearer <secret>`, niet een querystring. Geheimen uitsluitend in serverconfiguratie, nooit in deze documentatie of logging. Roteren door een nieuw geheim gecoördineerd in beide systemen te plaatsen; geen prefixlogging.

## Ophalen

`POST /api/portal/claim`, `Content-Type: application/json`, body `{ "limit": 5 }`. Maximum tien events. De response is `{ "events": [...] }`. Een event is tijdelijk geclaimd; zonder bevestiging komt het na leaseverloop opnieuw beschikbaar. Ontvanger moet dus idempotent zijn.

Schema `zonlio.portal.advice.v1` bevat:
- `id` en `claimToken`: technische ontvangstbevestiging voor deze claim.
- `type`: `advice.upsert`, `advice.withdrawn`, `advice.closed` of `advice.contact_expired`.
- `requestId`: vaste Zonlio-dossier-ID; gebruik voor upsert in Portal. `revision` bepaalt volgorde; een oude snapshot mag nooit een nieuwere staat terugdraaien.
- Aanvraagreferentie, aanmaak-/wijzigingstijd, actuele status en bronmodule.
- Bevestigde exploitant, `assignmentHint: "Pim"` (werklabel, geen autorisatie), contactverzoek inclusief versie/tekst/termijn.
- Alleen bij actief passend contactverzoek: `person`, `housing`, hulpvraag en optioneel scenario.

Intrekking, sluiting of verstreken contacttermijn hebben **geen NAW-/scenario-payload**. Stop verdere opvolging en werk het Portal-dossier en downstream Odoo bij. Een latere legitieme staat heeft een nieuwere revisie; de ontvanger moet actuele toestemming blijven toetsen en geen leads zelfstandig heropenen.

De gedetailleerde veldnamen zijn versieerbaar vastgelegd in `server/portal.mjs`; gebruik die als contractreferentie. Er staan bewust geen echte klantvoorbeelden in dit document.

## Bevestigen

Na succesvolle, duurzame Portal-opslag:

`POST /api/portal/ack`, JSON `{ "id": "<event-id>", "claimToken": "<claim-token>", "portalReference": "<intern-portal-dossier>" }`.

Een ontvangststatus zonder duurzaam dossier is onvoldoende. Dezelfde bevestiging kan worden herhaald. Bevestig geen verouderde claim nadat een andere worker de lease heeft overgenomen. Een Odoo-storing mag de ontvangst in Portal niet wissen; Portal beheert zijn eigen verdere queue en idempotentie.

## Ontvangeracceptatie

1. Behoud bestaande Portal-data-eigenaarschap en rolrechten; gebruik een serviceaccount met minimale rechten.
2. Upsert op bron `zonlio` + `requestId`. Geen automatische samenvoeging van alle bewoners op hetzelfde adres.
3. Verwerk alleen deze wettelijke ontvanger. Geen stille doorgifte aan andere BV's of omzetting van abonnees naar leads.
4. Verwerk revisies, dubbelen, leaseverloop, timeouts en oude antwoorden.
5. Sla bewijs van contactverzoek en de eigenlijke opvolgstatus apart op; geen ruwe persoonsdata in technische logs.
6. Stop contact bij intrekking en verwerk de stop door naar Odoo. Bewaar audit met noodzakelijke, beperkte gegevens.
7. Exporteer nooit een dagmailabonnee als saleslead.
8. Test op staging met synthetische data, daarna uitsluitend de expliciet toegestane eigen ketentest. Schakel productie-export pas daarna in.

Export is een pull-protocol; het is geen pushmelding en vereist een periodieke Portal-taak. De Zonlio-health geeft alleen `portalExportEnabled`, beheer toont queue-status. Beide bewijzen geen verbinding of ontvangst in de Portal.
