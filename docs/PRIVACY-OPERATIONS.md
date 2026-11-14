# Zonlio — privacyrechten, bewaarbeoordeling en veilig herstel

**Status:** operationele code en synthetische tests; beleidsvoorstel voor NIVO-goedkeuring. Dit document is geen verklaring dat een productieherstel, juridisch onderzoek of echt rechtenverzoek is voltooid. Exploitant/privacycontact zijn bevestigd: **NIVO Groep Holland BV**, **info@zonlio.nl**.

## 1. Uitgangspunten en actuele bronbasis

De Autoriteit Persoonsgegevens beschrijft dat een organisatie de identiteit van de verzoeker controleert, in beginsel binnen één maand reageert en correctie/verwijdering zo nodig aan ontvangers doorgeeft. Voor Zonlio betekent dit: geef een dossierexport niet mee aan iemand die alleen een openbare aanvraagreferentie kent; controleer de aanvrager met zo weinig mogelijk aanvullende persoonsgegevens. Een volledig identiteitsbewijs opvragen is geen standaardstap. [AP: privacyrechten in de praktijk](https://autoriteitpersoonsgegevens.nl/themas/basis-avg/privacyrechten-avg/voor-organisaties-privacyrechten-in-de-praktijk).

De AVG kent geen universele bewaartermijn voor alle persoonsgegevens. NIVO moet per doel noodzaak, uitzonderingen en termijn onderbouwen en uitvoeren. Een contactvenster van 30 dagen is **geen** algemene bewaartermijn voor het hele dossier. [AP: bewaren van persoonsgegevens](https://autoriteitpersoonsgegevens.nl/nl/over-privacy/persoonsgegevens/bewaren-van-persoonsgegevens).

Verwijdering omvat ook kopieën en back-ups. Bij moeilijk of niet overschrijfbare back-ups moet worden bijgehouden wat gewist moest worden en moet dit bij herstel alsnog gebeuren. Zonlio's herstelregister en restorecontrole ondersteunen die beperking; een oude back-up zonder recente rechtenverwerking terugzetten is onvoldoende. [AP: recht op gegevens verwijderen](https://autoriteitpersoonsgegevens.nl/nl/zelf-doen/privacyrechten/recht-op-vergetelheid).

Bronnen zijn op 14 november 2026 via de primaire AP-publicaties gecontroleerd. Specifieke bewaarplichten, contracten/verwerkers, ontvangers en definitieve bezoekersinformatie vragen goedkeuring door de bevoegde NIVO-verantwoordelijke.

## 2. Eén uitvoerbaar rechtenproces

1. **Ontvang en bepaal de scope.** Het verzoek kan alleen adviescontact stoppen, een fout adres corrigeren, een dossier inzien of persoonsgegevens laten wissen. Account, dagmail en woningadvies zijn afzonderlijke diensten; behandel een verzoek om *alle* gegevens in al die systemen. Vul nooit marketingtoestemming in op basis van abonnement of account.
2. **Controleer identiteit en dossier.** Gebruik bestaande, veilige contactinformatie en passende aanvullende verificatie. Leg alleen vast dat en hoe de controle passend is gedaan. Plaats geen ID-kopie, BSN, wachtwoord of verificatiecode in dossiernotities/GitHub.
3. **Stop ongewenst contact direct.** Gebruik intrekking voor een contactstop, ook wanneer verdere beoordeling van een inzage-/wisverzoek nog loopt. Afmelden van dagmails verloopt via de afzonderlijke dienst. Een stop kan niet via een gewone statuswijziging worden teruggedraaid.
4. **Kies de bevoegde handeling.** Export, correctie en wissen staan alleen achter de beheersessie; mutaties vereisen toegestane origin, JSON, CSRF en de actuele dossier-revisie. Vernieuw bij een revisieconflict. Verwijderen vereist bovendien de expliciete dossierbevestiging.
5. **Controleer resultaat en overige kopieën.** Bekijk de actuele dossierstatus, wachtende mails en eventuele Portal-stopopdracht. Controleer relevante e-mails, downloads, back-ups en later Portal/Odoo. Een groen Zonlio-resultaat is geen bewijs dat een losse CSV, mailboxkopie of ander systeem al is gewist.
6. **Reageer concreet en veilig.** Vermeld welke gegevens/onderdelen zijn afgehandeld, welke eventueel moeten blijven en waarom, en wat nog in een beperkte back-up zit. Verstrek de export via een passende veilige route nadat de identiteit is gecontroleerd. Geen automatische verzending naar een nieuw, niet geverifieerd correctieadres.

NIVO bepaalt de bevoegde beheerder en vervanging. De huidige beheerlogin is geen uitnodiging om één wachtwoord onder medewerkers te delen. De technische handeling vervangt geen inhoudelijke beslissing over een uitzonderlijke bewaarplicht.

## 3. Wat de nieuwe code precies doet

`server/privacy-store.mjs` voegt additief `zonlio_lead_privacy` en `zonlio_privacy_audit` toe. Het werkt transactioneel met dezelfde dossierlock als de bestaande statusmutaties.

| Handeling | Gedrag | Praktische grens |
| --- | --- | --- |
| `exportLead(id)` | Dossiergegevens, opgeslagen contactbewijs, scenario, eigen dossiernotities en veilige mail-/Portalstatusmetadata. | Geen sessies, wachtwoorden, mail-/claimtokens, oorspronkelijke payloadhash of interne inlogadressen. Notities kunnen gegevens van anderen bevatten; bevoegde beoordeling vóór verstrekking. |
| `correctLead(id,{expectedRevision,fields,actor})` | Alleen naam, e-mail, telefoon, postcode en woningadres; interne validatie; revisie omhoog; veldnamen in audit. | Geen toestemmingstekst, status, contacttermijn of marketingrecht uitbreiden. Geen automatische nieuwe bevestigingsmail. |
| `eraseLead(id,{expectedRevision,actor,confirm})` | Wist directe contact-/adresgegevens, hulpvraag, scenario, vrije notities en oorspronkelijke payloadhash; contact wordt ingetrokken. | Geen automatische claim dat het gehele bedrijf, externe mailboxen of back-ups zijn gewist. |
| `retentionPreview(...)` | Begrensde lijst met dossierreferenties en tellingen voor beoordeling. | Altijd `dryRun:true`, `policyApproved:false`; geen bulkverwijdering. |
| `recoveryManifest()` | Pseudoniem register van recente correctierevisies, contactstops, erasures, abonnementsstops en verzendsuppressies. | Privé herstellen/vergelijkingsbestand, geen openbare rapportage of adressenlijst. |

### Correctie

Een correctie bewaart het oorspronkelijke formulierbewijs en de reeds geldende contactbeperking. Correctie van een ingetrokken dossier heropent het niet. Het auditrecord bevat de gewijzigde **veldnamen**, geen tweede kopie van oude/nieuwe persoonsgegevens. Browser-retries met de oorspronkelijke aanvraagcode herstellen de oudere waarden niet.

Nog wachtende, geclaimde of mislukte aanvraagmails worden bij correctie geannuleerd. Dit voorkomt dat een wijziging stilzwijgend een nieuwe bevestiging naar een ander adres stuurt. Mail die al daadwerkelijk bij SMTP was afgeleverd, kan niet technisch worden teruggehaald; controleer die kopie afzonderlijk. Er blijft geen claim van exact één verzending tijdens onzekere netwerkmomenten.

### Wissen met een minimale stopregistratie

Voor het wisendpoint is de bevestiging `ERASE_LEAD_PERSONAL_DATA` vereist; de beheer-UI vraagt dit per geopend dossier. De transactie:

- Zet naam op `[Gegevens verwijderd]` en wist e-mail, telefoon, postcode, woningadres, vraag, scenario, vrije dossiernotities en opvolgnotities.
- Zet contactrecht uit en status op `withdrawn`, verhoogt de revisie en bewaart `erased_at`.
- Vervangt de oorspronkelijke persoonsgebonden payloadhash door `erased`. De oorspronkelijke aanvraag-ID blijft geblokkeerd: een latere herhaling wordt geen nieuwe aanvraag.
- Annuleert wachtende/verwerkende/gefaalde mails en maakt hun claim onbruikbaar. Een al begonnen externe SMTP-aflevering is niet terug te halen.
- Maakt voor een NIVO-woningdossier een `advice.erased`-event zonder NAW. De toekomstige Portal-ontvanger moet dat als verwijderopdracht verwerken; alleen een contactstop is niet voldoende.
- Weigert nieuwe statusnotities/correcties op het gewiste dossier, zodat een gewoon beheerformulier geen persoonsgegevens terugschrijft.

Behouden blijven beperkte technische dossier-/aanvraagreferenties, ontvangst-/wistijd, minimale audit, bronmodule/onderwerp, het oorspronkelijke algemene contactbewijs en niet-persoonlijke queue-statussen. Dat is **pseudonimisering met verwijderde directe dossiergegevens**, geen belofte van volledige onomkeerbare anonimisering. NIVO moet noodzaak en bewaartermijn van deze beperkte restregistratie beoordelen. Het register mag niet als commerciële leadlijst worden gebruikt.

Een afzonderlijk Mijn Zonlio-account met hetzelfde e-mailadres wordt niet blind meegewist. Dat voorkomt dat een woningdossiercorrectie onbedoeld een andere dienst opheft. Voor een aantoonbaar verzoek om alle diensten voert de bevoegde behandelaar óók account-/dagmailverwijdering uit. `zonlio_member_erasure` bewaart daarvoor minimaal oud account-ID, een e-mailhash en wistijd; bestaande verzendsuppressies blijven gelden. Dit register bevat geen plaintext e-mail of profiel en voorkomt dat een oudere back-up het gewiste account ongemerkt terugbrengt.

## 4. Concreet bewaarschema ter goedkeuring

Onderstaande termijnen zijn een **voorstel/technische beschrijving**, geen wettelijke standaard en geen definitief NIVO-besluit. Zet geen automatische leadverwijdering aan voordat NIVO doelen, uitzonderingen, verantwoordelijke en maximale back-upduur heeft goedgekeurd.

| Gegevens | Voorgesteld beleid of bestaande technische termijn | Uitvoering |
| --- | --- | --- |
| Actief adviesverzoek | Contact uitsluitend binnen het vastgelegde 30-dagenvenster en zolang niet ingetrokken/gesloten. | Automatische contactstop; dit wist niet meteen de hele aanvraag. |
| Gesloten, verloren of verlopen lead zonder lopende overeenkomst | Beoordelen uiterlijk 180 dagen na de laatste inhoudelijke wijziging; eerder wissen als het doel vervalt of een geldig wisverzoek geldt. | Nieuwe retentiepreview; geen automatische vernietiging. Een onnodige administratieve wijziging rechtvaardigt geen eindeloos bewaren. |
| Gewonnen lead met overeenkomst | Alleen noodzakelijke zakelijke administratie volgens het passende doel/wettelijke bewaarplicht; beoordeel welke intakevelden nog nodig zijn. | Bevoegde beoordeling, later in het eigen Portal/Odoo-proces. Geen algemene kopie van alle Zonlio-data voor onbepaalde tijd. |
| Niet bevestigde login-/inschrijfverzoeken | De link verloopt veel eerder; technische challengegegevens worden na 7 dagen opgeruimd. | Bestaande maintenance-cleanup. Geen geverifieerd account of lead zonder bevestiging. |
| Actief persoonlijk account/profiel | Zolang nodig voor gevraagde dienst; voorstel: review bij 12 maanden inactiviteit. | Geen automatische inactiviteitsverwijdering in deze release. Op gebruikersverzoek actieve accountgegevens verwijderen. |
| Actief abonnement/bewijs | Zolang de dienst actief is; na afmelding alleen noodzakelijk bewijs/stop. Voorstel: na 180 dagen beoordelen welke gegevens nog nodig zijn. | Uitschrijven stopt queued dagmails; geen lead ontstaat. Nog beleidsbesluit over beperkte bewijsbewaring. |
| Verwerkte/afgelopen/geannuleerde dagmailmetadata en payload | Bestaande technische opschoning na 30 dagen voor terminale dagmailtaken. | Maintenance. |
| Verzendbudgetreservaties | 2 dagen, voor controle van het rollende 24-uursbudget. | Bestaande cleanup. |
| Verlopen accountsessies | Niet meer bruikbaar zodra verlopen; verwijderen tijdens maintenance. | Bestaande cleanup. |
| Klacht/hard-bounce/verzendstop | Minimale e-mailhash plus reden/tijd zolang nodig om ongewenst opnieuw verzenden te verhinderen. Voorstel: jaarlijks noodzaak en toepassingsbereik beoordelen. | Blokkeert verzending; geen onnodige plaintext adreskopie. Geen automatische suppressie-opheffing bij accountverwijdering. |
| Lead-/accounterasure en beperkt privacy-auditregister | Bewaren zolang nodig om back-upherstel en rechtmatige audit zonder heractivering mogelijk te maken; voorstel: beleid koppelen aan maximale back-upduur en gerechtvaardigde auditbehoefte. | Nog definitieve termijn te besluiten; uitsluitend minimale referenties, geen kopieën van gewiste NAW. |
| Databaseback-ups | Voorstel maximaal 35 dagen waar het bestaande pakket dit ondersteunt, of een kortere passende termijn; werkelijk Hostinger-schema eerst bevestigen. | Geen nieuwe betaalde backupdienst. Gegevens waar mogelijk uit back-ups verwijderen; voor niet-overschrijfbare kopieën herstelregister toepassen vóór hergebruik. |

De preview toont uitsluitend beoordelingskandidaten. Een dossier dat binnen die 180 dagen nog aantoonbaar nodig is, blijft een expliciete beleidsuitzondering; een terecht eerder wisverzoek hoeft niet tot dag 180 te wachten.

## 5. Niet-destructieve restoreproef

De productieback-up-/restoreproef blijft een afzonderlijke eigenaar-/Hostingerhandeling. Het script importeert **geen** SQL en schrijft **niets** naar een database. Het opent uitsluitend een read-only MySQL-transactie naar een apart benoemde restore-/testdatabase.

### Veilige voorbereiding in Hostinger

1. Noteer de actuele applicatiecommit en tijd. Controleer het tijdstip/de volledigheid van de beschikbare databaseback-up in hPanel, zonder de SQL-export openbaar te maken.
2. Maak via het bestaande databasebeheer een **aparte** database met een naam die `zonlio_` en `restore` of `test` bevat, bijvoorbeeld met de gebruikelijke accountprefix: `u123_zonlio_restore`. Gebruik een eigen gebruiker en bij voorkeur uitsluitend leesrechten voor de controle. Verander nooit `DB_NAME` van de live Node-app naar deze database.
3. Importeer de gekozen back-up uitsluitend in die lege, aparte database. Zet geen publieke website of mailworker op de kopie. Controleer vooraf in de import-UI dat de bedoelde aparte database geselecteerd is.
4. Beoordeel schemaversie. Een oudere back-up kan de nieuwe additieve tabellen missen; het controlescript meldt dit en houdt de proef op HOLD. Alleen de afgescheiden kopie mag een gecontroleerde schema-upgrade krijgen. Geen productie-restore of destructieve schema-acties voor deze proef.
5. Download via geautoriseerd Zonlio-beheer een **nieuw** privacyherstelregister. Bewaar het buiten Git, website, downloads voor derden en CI. Het bevat pseudonieme persoonsreferenties en hoort privé te blijven.
6. Noteer hoe recente wijzigingen tussen de back-up, het herstelregister en de echte omschakeling worden opgevangen. Een maximaal 24 uur oud register is een technische grens, geen bewijs dat er daarna geen nieuw verzoek kwam. Bij echte omschakeling moeten bronwrites kort gecontroleerd worden gepauzeerd en de laatste rechtenwijzigingen worden verwerkt.

### Configuratie voor de read-only controle

Gebruik een privéconfiguratiebestand buiten de repository/webroot. Stel daarin uitsluitend de hieronder genoemde restorewaarden in. Kopieer geen productie-SMTP-wachtwoord of actieve dienstenflags. Dit zijn sleutelnamen/voorbeeldvormen, geen echte credentials:

```dotenv
RESTORE_CHECK_ONLY=true
RESTORE_DB_HOST=host-van-de-aparte-database
RESTORE_DB_PORT=3306
RESTORE_DB_NAME=u123_zonlio_restore
RESTORE_SOURCE_DB_NAME=u123_zonlio_productie
RESTORE_DB_USER=aparte-leesgebruiker
RESTORE_DB_PASSWORD=alleen-in-privéconfiguratie
RESTORE_PRIVACY_MANIFEST=/privépad/zonlio-recovery.json
```

Op een geautoriseerde serverterminal met Node 24:

```sh
chmod 600 /privépad/zonlio-recovery.json
node --env-file=/privépad/zonlio-restore.env scripts/verify-restore.mjs
```

Gebruik de werkelijke, vastgestelde repository- en privébestandslocaties. De placeholders hierboven zijn geen bekende Hostinger-uitvoerpaden. Wachtwoorden staan alleen in het privébestand, niet in argumenten of shellhistory. `RESTORE_DB_NAME` moet afwijken van `RESTORE_SOURCE_DB_NAME` en een eventueel aanwezige productie-`DB_NAME`. Het script weigert een actieve publieke/mail/Portalflag of een overgenomen `SMTP_PASSWORD` vóór het verbinding maakt.

### Betekenis van de uitslag

De controle verifieert de verwachte schemaonderdelen, verwijzingen zonder wezen, veilige aantallen en vergelijking met recente rechten:

- Geen contact opnieuw actief waar het bronregister een nieuwere intrekking/sluiting heeft.
- Geen oudere correctierevisie teruggezet. Correcte waarden moeten uit een recente beveiligde bron worden hersteld; het minimale register bewaart die privéwaarden bewust niet.
- Geen gewiste leidgegevens of oorspronkelijke payloadhash teruggebracht; stopregistratie aanwezig.
- Geen afgemeld/gepauzeerd abonnement opnieuw actief.
- Klacht-/bouncesuppressies nog aanwezig en bijbehorende accounts geblokkeerd voor aflevering.
- Gewiste accounts afwezig en de minimale account-erasureledger behouden.

Output bevat uitsluitend aantallen, schemanamen, foutcategorieën, registerdatum en een SHA-256 van het gebruikte register. Geen SQL-rijen, NAW, tokens of databasewachtwoorden. Exitcode 0 betekent dat **deze read-only controles** slagen; het activeert niets en geeft geen toestemming om deze kopie direct live te zetten.

Bij mismatches blijft de restoredatabase geïsoleerd. Verwerk de nieuwere stops/correcties/erasures uit de beschermde actuele bron via een bevoegde herstelhandeling en controleer opnieuw. Dit script voert bewust geen automatische massale replay of dataverwijdering uit. Controleer vóór een echte omschakeling ook oude sessies, uitstaande mails, verlopen dagplannen, oude claims en berichtleveringen die na de back-up al waren uitgevoerd. Een oude mailqueue mag niet automatisch opnieuw worden verstuurd.

### Vereist bewijs voor P0

Leg alleen vast: commit, back-updatum, tijd van restoreproef, aparte doelomgeving (geen geheime host/user), schemaresultaat, geanonimiseerde aantallen, registerhash, rechtenvergelijking, verantwoordelijke en uitkomst. Productiegegevens blijven in het beveiligde beheer. Deze lokale implementatie/tests sluiten de echte Hostinger-restoregate niet.

## 6. Reproduceerbaar testbewijs

```sh
node --test tests/privacy.test.mjs tests/portal.test.mjs
```

De lokale suite gebruikt tijdelijke synthetische SQLite-data en een lokale HTTP-server. Ze bewijst onder meer gevalideerde export/correctie, revisieconflicten, rollback bij queuefout, erasure zonder heractivering, annulering van oude mailclaims, retentie als dry-run, afzonderlijke accountscope, pseudoniem herstelregister en fail-closed restoreconfiguratie/-vergelijking. De Portal-suite voegt erasure-/intrekkings-/vervalevents en retry/ack/leasegedrag toe.

Echte MySQL 8-integratie, beveiligde productie-UI, werkelijke SMTP en een niet-destructieve Hostinger-restore moeten afzonderlijk worden vastgelegd. Er is geen echte persoonsgegevenmutatie of externe verzending uitgevoerd door deze tests.
