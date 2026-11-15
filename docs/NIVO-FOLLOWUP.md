# NIVO — zelfstandig opvolgen vanuit Zonlio

> **Eigenaarbesluit 15 november 2026:** de interne opvolging van Pim/NIVO wordt door de eigenaar in het andere Portal-project geregeld en is **geen Zonlio-ontwikkelblokkade** meer. Zonlio levert interne transactionele adviesmeldingen via `LEAD_NOTIFY_TO=portal@nivogroepholland.nl`; dit is e-mailroutering, **geen** automatische Portal-/Odoo-koppeling. Bestaande Pim-werkvoorraad en privacy-audit blijven technisch bestaan. Alleen de daadwerkelijke ontvangst door de Portal-mailbox en de effectieve Hostinger-env zijn nog apart te bewijzen. Zie [de nieuwe e-mailoverdracht](PORTAL-EMAIL-HANDOFF-2026-11-15.md). De oudere taken hieronder zijn intern NIVO-verantwoordelijkheid, niet een nieuw Zonlio-rollenproject.

**Operationeel concept ter bekrachtiging.** Ontvanger NIVO Groep Holland BV, opvolglabel Pim en de toekomstige Portal-route zijn al bevestigd. Er wordt geen onbevestigde terugbelbelofte op de publieke website geplaatst. Portal/Odoo is geen voorwaarde om een vrijgegeven Zonlio-dossier te behandelen.

## Vast werkproces

1. Gebruik standaard **Nu opvolgen** in `/admin` voor nieuwe of achterstallige geldige contactverzoeken. Kies **Alle aanvragen** voor gesloten en historische dossiers. Controleer hulpvraag, bronmodule, contactbewijs/voorkeur en resterend contactvenster. Een account of dagmailabonnement is nooit een belopdracht.
2. Controleer noodzakelijke gegevens en passendheid voor de gevraagde dienst. Houd het dossier bij Pim of de door NIVO aangewezen bevoegde vervanger. Noteer één volgende actie en datum; geen onnodige privégegevens in vrije notities.
3. Leg iedere daadwerkelijke contactpoging vast. Markeer pas `contacted` wanneer de aanvrager werkelijk is bereikt en `qualified` wanneer behoefte, werkgebied en haalbare dienstverlening zijn beoordeeld. Een onbereikbaar adres is geen gekwalificeerde lead.
4. Gebruik `appointment`, `quoted`, `won` of `lost` uitsluitend voor werkelijk bereikte momenten. De rapportage bewaart historische mijlpalen; overslaande statuskeuzes leveren geen verzonnen eerdere stappen op. Commerciële omzet/bedragen worden niet ingevuld als de huidige app die niet registreert.
5. Respecteer intrekking, sluiting en het vastgelegde 30-dagencontactvenster. Een gewone statuswijziging heropent geen ingetrokken of gewist dossier. Voor een nieuw doel of nieuwe periode is een nieuwe passende aanvraag nodig.
6. Bij correctie, inzage of wissing: verifieer het verzoek, gebruik het afgeschermde rechtenproces en behandel kopieën/mailboxen volgens [het privacyrunbook](PRIVACY-OPERATIONS.md). Exporteer alleen waar noodzakelijk en veilig.

## Nog vast te stellen door NIVO

| Besluit | Werkbaar concept; nog niet als belofte publiceren |
| --- | --- |
| Werkgebied en diensten | Leg per aangeboden hulpvraag vast welke postcodegebieden en diensten door NIVO worden aangenomen. Buiten scope: duidelijke terugkoppeling en afsluiten, geen automatische doorgifte aan andere bedrijven. |
| Reactietermijn | Kies een haalbare termijn binnen de bezetting; laat de huidige melding na 24 uur onbehandeld als interne signalering dienen. Dat is geen gepubliceerde servicebelofte. |
| Contactpogingen | Leg een beperkt maximum en spreiding vast, binnen voorkeursmoment en contactvenster. Stop direct bij intrekking. De app verzint geen automatisch belschema. |
| Vervanging | Wijs een concrete bevoegde vervanger en overdracht bij afwezigheid van Pim aan. Geen onbekende medewerker automatisch toegang geven. |
| Beheertoegang | Bepaal wie NAW mag zien en rechtenverzoeken mag uitvoeren. De huidige ene beheeridentiteit is geen rollenstelsel; gebruik geen gedeeld adminwachtwoord als teamoplossing. |
| Storingsontvanger | Bevestig wie operationele e-mail-/GitHub-meldingen daadwerkelijk ontvangt en opvolgt, en controleer een echt bericht. |

## Sturing op kwaliteit

Gebruik ontvangen aanvragen, bereikbaarheid (`contacted`), inhoudelijke kwalificatie, afspraken, offertes en gewonnen/verloren dossiers. Vergelijk per bronmodule binnen dezelfde instroomcohort en periode; jonge aanvragen hebben nog geen volledige doorlooptijd. Het dashboard telt daadwerkelijke vastgelegde mijlpalen en vult ontbrekende stappen niet in.

De analytics bevatten geen NAW en geen externe advertentiepixels. Een vrijwillig consent-event of ruwe paginaweergave is geen unieke klant. Werkelijke campagne-attributie, omzetvelden en externe Search Console-data zijn in deze release niet toegevoegd en worden niet uit proxycijfers afgeleid.

## Incident en continuïteit

Nieuwe aanvragen blijven in MySQL bestaan bij SMTP-uitval. Gebruik de werkvoorraad als operationele bron; de notificatiemail is een hulpmiddel. Bij technische achterstand, quota of bronuitval volgt de bevoegde beheerder [AUTONOMOUS-OPERATIONS.md](AUTONOMOUS-OPERATIONS.md). Bij privacy- of toegangsfout: stop betrokken verwerking, bewaar alleen noodzakelijke incidentmetadata en volg de bevoegde NIVO-procedure.

Dit SOP-concept sluit E4 pas nadat de ontbrekende keuzes en feitelijke toegang/ontvangst zijn bevestigd. Een codecommit benoemt geen nieuwe medewerker en verleent geen gegevensrechten.

## Automatische werkvoorraad — release 05

Nieuwe adviesaanvragen voor **NIVO Groep Holland BV** krijgen bij opslag atomisch het opvolglabel `Pim`, een **interne beoordelingstaak** en de actuele Amsterdamse kalenderdatum als actiedatum. Status blijft `new`; er wordt geen contactpoging, kwalificatie, afspraak of verzendresultaat verzonnen. Een idempotente herhaling maakt geen tweede taak. Oudere dossiers en rechten worden niet herschreven.

In de beveiligde backoffice gebruikt de standaardweergave `GET /api/admin/leads?queue=attention`. Alleen actuele vrijwillige contactverzoeken komen in deze werkvoorraad: nieuwe dossiers, niet toegewezen of niet ingeplande dossiers en acties met een datum tot en met vandaag. Het filter ondersteunt status en paginering; afgesloten, ingetrokken of verlopen contact valt buiten de actielijst, maar blijft volgens bewaarbeleid in **Alle aanvragen**. Een actie die voor de toekomst is ingepland, komt pas op de geplande datum terug. De samenvatting `workload.attention` telt een passend dossier één keer, onafhankelijk van de ingestelde statistiekperiode.

Dit is uitsluitend een interne takenlijst voor de bestaande bevoegde beheerder. Geen nieuwe personeelsaccounts, automatische verkoopmail, belactie of publieke toezegging. De productie- en privacygates voor echte aanvragen blijven onafhankelijk; Portal-export blijft uit.
