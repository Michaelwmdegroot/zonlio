# Zonlio — gecontroleerde eigenaarstest voor P0-productieacceptatie (releasekandidaat 06)

**Peildatum:** 15 november 2026, Europe/Amsterdam. **Status:** [Release 06 staat aantoonbaar live](RELEASE-06-EVIDENCE-2026-11-15.md); CI en 23 read-only productieprobes zijn geslaagd. **Een echte eigenaarstest, inboxontvangst, gecontroleerde herstart en database-restore zijn nog open.** Dit document geeft **geen** commerciële of algemene mailvrijgave.

## Waarom deze wijziging

De publieke routes `/api/leads` en `/api/housing-leads` mogen niet tijdelijk voor willekeurige bezoekers worden geopend om een eigen productieacceptatie te doen. De reeds toegestane **eigenaarstest** gebruikt daarom een bestaande, bevoegde adminlogin en een strikte afzonderlijke route.

- **Endpoint:** `POST /api/admin/acceptance/lead`, alleen na bestaande admin-cookie + CSRF-controle (inclusief toegestane Origin), bevestiging en bevestigde NIVO-ontvanger.
- **Testgegevens:** uitsluitend via `/admin` in privé browser-/HTTPS-sessie, nooit in GitHub, console-uitvoer of issuecommentaar. Ontvangend testadres **moet exact het beheer-e-mailadres zijn**. Voor woningadvies is een eigen telefoonnummer, adres en volledige NL-postcode vereist.
- **Validatie en opslag:** gebruikt dezelfde `validateLead`, `store.createLead`, transactie, contactbewijs, idempotente request-ID, Pim-werkvoorraad, mailoutbox, budget, toestemming en privacyhandelingen als een normale NIVO-aanvraag.
- **Afscherming:** een nieuwe additieve tabel `zonlio_acceptance_leads` markeert ieder testdossier. Gewone consumenten-KPI's en `Nu opvolgen` sluiten tests uit. Beheerfilter **Acceptatietests** toont de testdossiers apart. Geen Portal-event bij create/update/privacy/expiry; Portal-claim heeft aanvullende databasefilter als vangnet.
- **Mail:** eigen klantbevestiging + bestaande interne notificatie krijgen prefix `[TEST]`; NIVO-melding zegt expliciet **niet commercieel opvolgen**. Als `MAIL_SEND_PAUSED=true`, wordt geen mail geforceerd of omzeild: de echte outbox blijft wachten.
- **Limieten:** maximaal drie testpogingen per 24 uur per ingelogde admin per actieve applicatie-instantie; de achterliggende idempotente request-ID voorkomt dubbeldossiers bij retry. Geen bulktool.
- **Geen nieuwe privileges:** bestaande beheerlogin blijft een eenpersoonsbeheeridentiteit; dit levert geen personeelsrollen op.

## Checklist voor één echte geautoriseerde productie-E2E

1. Controleer de huidige release en dat `LEAD_ENABLED=false`, `HOUSING_ADVICE_ENABLED=false`, `MEMBER_ACCOUNTS_ENABLED=false`, `DAYMAIL_SIGNUP_ENABLED=false`, `DAYMAIL_SEND_ENABLED=false`, `PORTAL_EXPORT_ENABLED=false` blijven. Een code-merge is **geen** live-GO.
2. Log privé in via `https://zonlio.nl/admin` en open **Productieacceptatie · eigen test**. Vul alleen de eigen gegevens in, kies algemene aanvraag of woningadvies, bevestig het expliciete vakje en verstuur eenmaal.
3. Noteer uitsluitend het dossierkenmerk `ZON-...` of een geschoonde uitkomst in het bewijsregister, geen NAW, telefoon, e-mail, bezoekadres, formulierpayload of screenshots met gegevens. Controleer de privé **Acceptatietests**-lijst; het dossier heeft intern **Pim**, bron, datum en contactbewijs.
4. Controleer dat hetzelfde kenmerk buiten de gewone `Alle aanvragen`-lijst en consumentenstatistieken blijft. De gewone publieke formulierroute moet nog **niet** beschikbaar zijn.
5. Controleer in de beveiligde privé-UI of de **twee afzonderlijke outboxitems** zijn verwerkt (interne NIVO-notificatie en klantbevestiging). Herhaal geen SMTP-test om dit te vervangen. Bevestig afzonderlijk de werkelijke ontvangst in de eigen inbox en controleer authenticatieresultaten, onderwerp en spam. Indien de mailpauze actief is, **geen afgeleverde mail claimen** en niet los van een goedgekeurde test verzenden.
6. Controleer vervolgens één gewone revisie-/opvolgactie zonder een fictieve contactpoging vast te leggen. Test intrekking en controleer dat open mailwerk niet alsnog wordt verzonden. Gebruik desgewenst de bestaande privacywissing na verificatie; controleer de minimale stopregistratie.
7. Leg het resultaat vast met **bewijsniveau** (CI, werkelijk via privé-UI geverifieerd, SMTP-acceptatie, echte inboxontvangst, MySQL-persistentie en eventueel restart) en alleen geschoonde metadata. Sluit P0 niet op basis van dit document af.

## Aanvullend onafhankelijk operationeel bewijs

Op 15 november 2026 zag de onafhankelijke GitHub-operationscontrole [run 43657748765](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43657748765) de MySQL-opgeslagen `lastMaintenanceAt=2026-11-15T00:20:02.212Z`; de eerdere [run 43656137432](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43656137432) zag `2026-11-15T00:00:02.878Z`. Dat is **minimaal twee verschillende onderhoudsmomenten**, nog geen handmatig gecontroleerde appherstart met twee opvolgende ticks. De externe watch had `cronExpected:false`; de alarmgate blijft afzonderlijk open.

## Restant en terugval

De werkelijke Hostinger-backupherstelproef naar een **afzonderlijke** MySQL-database, echte login/dagmail-/unsubscribe-E2E, definitief bewaarbeleid, NIVO-SOP-rolkeuzes, foutalertontvangst en afzonderlijke commerciële GO blijven open. Het uitzetten van de admin-test-UI heeft geen effect op opgeslagen records. Bij storingen: houd publieke gates uit, corrigeer code via branch/PR, controleer productie na merge, en gebruik de bestaande privacyregels voor eventueel opgeruimde testdossiers. Geen `DROP TABLE` of uitwissen van productiegegevens bij rollback.
