# NIVO Portal aansluiten op Zonlio — uitvoerbare overdracht

**Huidige toestand:** voorbereid, niet aangesloten. `PORTAL_EXPORT_ENABLED=false`. Dit document is voor de toekomstige Portal-agent en de bevoegde beheerder. Het afronden van Zonlio's zelfstandige leadopvang hoeft niet op de Portal te wachten.

## Vaste grenzen

- Route uitsluitend **Zonlio → NIVO Portal → bestaande Odoo-connect → Odoo**.
- NIVO Groep Holland BV is de bevestigde ontvanger; Pim is het standaard opvolglabel. Geen automatische teamautorisatie ontlenen aan dat label.
- Alleen passende woningadviesaanvragen; geen algemene verkoopexport van accounts, abonnementen of analytics.
- Geen gedeelde database, Odoo-wachtwoord in Zonlio, willekeurige webhook-URL of nieuw betaald product.
- Bron van waarheid voor transport: [PORTAL-CONTRACT-v1.md](PORTAL-CONTRACT-v1.md) en `server/portal.mjs`. Voor productie-/privacyvoorwaarden: [masterchecklist](COMPLETION-MASTER-CHECKLIST-2026-11-14.md) en [eigenaarspoorten](OWNER-INPUT-AND-GATES-2026-11-14.md).

## 1. Wat het Portal-team bouwt

| Onderdeel | Vereist resultaat |
| --- | --- |
| Service-identiteit | Afzonderlijke Portal-taak met alleen de rechten voor intake, stopverwerking en de bestaande Odoo-queue. |
| Periodieke worker | Claimt maximaal tien events per batch via HTTPS, met begrensde timeout, zonder redirect-follow en zonder payloadlogging. Start klein, bijvoorbeeld twee events. |
| Receipt-opslag | Unieke event-ID, bron/dossier-ID, revisie, interne Portal-referentie en verwerkingsstatus; geen onnodige kopie van de hele payload. |
| Dossier-upsert | Unieke `(source, requestId)` en monotoon hoogste bronrevisie; eigen verkoopnotities blijven apart. |
| Contactcontrole | Actief verzoek, juiste ontvanger en niet-verstreken termijn bij ieder contact. Stop-events en lokale afmeldingen winnen van oude replay. |
| Duurzame vervolgqueue | De bestaande Portal/Odoo-connect krijgt idempotente wijzigingen en stopopdrachten. |
| Monitoring | Laatste claim, laatste duurzame ontvangst, oudste onverwerkte taak en beperkte foutcategorie; geen NAW of tokens. |

Een ontvangsttransactie verwerkt eerst het event. Een reeds verwerkt event hoeft geen tweede lead of afspraak te maken. Daarna kan ook de herleverde lease veilig worden geacknowledged. Er is geen reden om Odoo synchroon binnen de 120 seconden lease te laten slagen; duurzame Portal-opslag en eigen vervolgqueue zijn de ack-grens.

## 2. Acceptatietests vóór toegang tot productie

Alle onderstaande proeven worden eerst met **synthetische** gegevens in een afgezonderde omgeving gedaan. Testresultaten bevatten alleen scenario, versie, tijd en geschoonde uitkomst.

| Proef | Vereiste uitkomst |
| --- | --- |
| Exportflag uit / foute token / query-token | Geen data, respectievelijk 503 of 401. |
| Normale woningaanvraag | Eén Portal-dossier met juist `source`, `requestId`, revisie, contactbewijs en Pim-label. |
| Scenario niet gedeeld | Geen berekening in Portal; `scenario:null`. |
| Dubbele claim/ack of responseverlies | Eén dossier; ack kan identiek worden herhaald. |
| Twee gelijktijdige workers | Geen overlappende geldige leases; logische dossierontvangst blijft ontdubbeld. |
| Portal stopt vóór commit | Geen ack; na leaseverval veilig opnieuw ontvangen. |
| Portal commit, ack-response valt weg | Dezelfde ack herhalen of bij reclaim bestaande receipt gebruiken. |
| Verlopen lease / oude worker | Ack geeft 409; nieuwe claim heeft ander token. |
| Revisie 2 vóór revisie 1 | Revisie 1 opent of overschrijft revisie 2 niet. |
| Intrekking vóór claim | Geen NAW, scenario of hulpvraag in stop-event. |
| Intrekking nadat upsert geclaimd is | Nieuwere stop verwerkt; vertraagde oude upsert kan contact niet herstellen. |
| Contacttermijn vervalt na eerdere ack | Nieuw stop-event met hogere revisie; Portal heeft al zelfstandig op `expiresAt` gestopt. |
| Gesloten/gewonnen/verloren dossier | Geen verdere leadopvolging uit hetzelfde verzoek; stop zonder NAW. |
| Dossierpersoonsgegevens gewist | `advice.erased` verwijdert noodzakelijke bronkopieën en maakt een duurzame downstream-verwijderopdracht; geen heropening bij een oude upsert. |
| Account/dagmail zonder woningadvies | Geen Portal-event of saleslead. |
| Odoo niet beschikbaar | Portal-dossier blijft duurzaam; eigen queue probeert later opnieuw. |
| Tokenrotatie | Oude token werkt niet; nieuwe worker hervat zonder verlies of dubbel dossier. |
| Back-upherstel / oude replay | Eerder ingetrokken, verlopen en verwijderde contactrechten blijven beperkt; geen heropening. |

Zonlio's eigen lokale contractproeven zijn reproduceerbaar met:

```sh
npm ci --ignore-scripts
node --test tests/portal.test.mjs
```

Dit commando heeft geen productiecredentials nodig, start alleen een lokale HTTP-server en gebruikt tijdelijke synthetische SQLite-databases. Echte MySQL-gates worden afzonderlijk uitgevoerd op een lege, expliciete testdatabase. Nooit tests op de productie-DB richten.

## 3. Gecontroleerd aansluiten nadat de ontvanger gereed is

1. Rond bovenstaande synthetische proeven af, leg de gebruikte Zonlio-commit en Portal-commit vast en controleer dat privacy-, back-up-/herstel- en Zonlio-leadgates afzonderlijk zijn gehaald.
2. Bewaar een nieuw willekeurig token van minimaal 32 tekens in de beveiligde configuratie van beide systemen. Toon de waarde niet in chat, terminaluitvoer, tickets of screenshots. Gebruik een secretmanager of beveiligde hostinginstellingen.
3. Configureer de vaste HTTPS-origin in de Portal, `Authorization`-header, JSON, timeout, batchlimiet en backoff. Laat de Portal-worker nog gepauzeerd.
4. Controleer in de Zonlio-backoffice de huidige wachtrij en de leeftijd van de open events. Deze kan rechtmatig zijn opgebouwd terwijl export uitstond. Nieuwe claims tonen actuele rechten en gegevens, geen vroegere snapshots.
5. Verkrijg de **aparte expliciete eigenaarvrijgave voor Portal-export**. Het accepteren van Zonlio-leads of publiceren op `main` is die vrijgave niet.
6. Stel pas dan `PORTAL_EXPORT_ENABLED=true` in via de beveiligde Hostinger-configuratie en herimplementeer. Controleer de effectieve flag. Start de Portal-worker met een kleine batch.
7. Gebruik uitsluitend het vooraf geautoriseerde eigen testdossier wanneer een echte ketenproef nodig is. Een ongevraagde klant of een fictief bereikbaar e-mailadres is geen testpersoon. Controleer Zonlio-ID → Portal-referentie → bestaande Odoo-route zonder persoonsgegevens te publiceren.
8. Doorloop ook intrekking en de stop in de bestaande Odoo-keten. Bevestig ontvangst in elk systeem afzonderlijk; een Zonlio-ack alleen bewijst de Odoo-stap niet.
9. Houd een oplevernotitie bij met commitversies, gecontroleerde scenarios, geanonimiseerde uitkomst en de naam/rol van degene die de vrijgave gaf. Activeer geen andere commerciële flags als bijeffect.

## 4. Pauzeren en tokenrotatie

**Bij vermoedelijk tokenlek of onbedoelde export:** zet `PORTAL_EXPORT_ENABLED=false`, herimplementeer en controleer de effectieve flag. Pauzeer de Portal-worker. Bestaande Zonlio-leads en de onafhankelijke backoffice blijven behouden. Controleer de ontvangende omgeving volgens het incidentrunbook; publiceren van het oude token helpt niet bij onderzoek.

**Normale rotatie:** pauzeer de Portal-worker, laat lopende transacties afronden of laat de 120 seconden lease vervallen, zet export uit, vervang het token in beide beveiligde configuraties en herimplementeer. Verifieer dat het oude token wordt geweigerd zonder de waarde in bewijs te plaatsen. Zet export alleen binnen de bestaande, geldige aansluitvrijgave weer aan en hervat met een kleine batch. Een lease die tijdens rotatie verviel, wordt opnieuw geclaimd; verwijder geen events.

Er is bewust geen onbeperkte overlap waarin meerdere oude tokens blijven werken. Tokenrotatie wijzigt geen contactbewijs, dossier-ID of revisie.

## 5. Achterstand, replay en herstel

Een **pending** event is nog niet duurzaam bevestigd. Een **leased** event is tijdelijk gereserveerd; een verlopen lease kan automatisch opnieuw worden geclaimd. Een **accepted** event heeft een bevestigde Portal-referentie, maar betekent niet dat Odoo al klaar is.

De Zonlio-backoffice toont naast aantallen ook de oudste open taak, verlopen leases en laatste acceptatie. Bij achterstand controleert de beheerder eerst de effectieve exportflag, receiver-status en foutcategorie. Een bewust uitgeschakelde Portal-export is geen storing van de zelfstandige Zonlio-leadopvang.

Herstelregels:

- Reset een geaccepteerd event niet blind naar pending. Onderzoek eerst de Portal-receipt en huidige contactstatus; er is geen algemene publieke replay-/resetendpoint.
- Bij een verloren ack: herhaal dezelfde ack zolang de bekende claim nog bruikbaar is. Is de lease veranderd, claim opnieuw en gebruik de bestaande Portal-receipt voor idempotente ontvangst.
- Bij een ontvangen stop: trek actuele contactrechten direct in, ook wanneer een eerdere Odoo-upsert nog op een retry wacht. De downstream-queue moet revisies en stops respecteren.
- Een teruggezette Zonlio-back-up kan verouderde contactrechten bevatten. Laat export, nieuwe intake en automatische mails uit totdat recentere intrekkingen, afmeldingen en verwijderingen uit de actuele audit/herstelbron zijn verzoend. Alleen een oude database terugzetten is geen volledige privacyveilige restore.
- Een Portal-restore kan oude bronrevisies of receipts terugzetten. Vergelijk de laatste bevestigde stand, herstel stoprechten en gebruik gecontroleerde reconciliatie. Laat een andere bron geen reeds ingetrokken contactrecht automatisch heropenen.
- Reparaties aan geaccepteerde ontvangst zijn een bevoegde, geauditeerde beheerhandeling. Bewaar voor-/na-versies en stoprechten. Geen handmatige massale SQL-reset zonder concrete herstelnoodzaak en review.

## 6. Wat nog geen bewijs is

Een lokale contracttest bewijst geen productieontvangst. Een geslaagde MySQL-CI-test bewijst geen actuele Hostinger-restore. Een flag in health bewijst alleen de actieve configuratie. Een Portal-ack bewijst de door de ontvanger beloofde duurzame Portal-opslag; Odoo-verwerking heeft een eigen resultaat.

**Afzonderlijk nog nodig:** werkende Portal-ontvanger, bevestigde toegang/rollen, gecontroleerde live intake-/stopketen en expliciete exportvrijgave. Tot die tijd blijft export uit en behandelt NIVO de aanvragen in Zonlio.
