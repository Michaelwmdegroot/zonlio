# Zonlio — adviesaanvragen, gegevens en verzending

Actuele technische beschrijving bij `autonomy-ready-04-20261114`. **NIVO Groep Holland BV**, KvK 95227768, Lireweg 52, 2153 PH Nieuw-Vennep, is door de eigenaar bevestigd als exploitant en adviesontvanger. Privacycontact: **info@zonlio.nl**. Definitieve beleidsgoedkeuring staat los van deze implementatie.

## Afzonderlijke keuzes

Gratis tools vragen geen account. Accounttoegang, de vrijwillige dagplandienst, een concrete adviesvraag en statistieken hebben elk hun eigen keuze. Er ontstaat geen verkoopdossier door een account of abonnement; er is geen algemene marketingopt-in.

Algemene adviesvragen gebruiken een gekozen e-mail- of telefoonkanaal. Woningadvies vraagt de noodzakelijke woning-/contactgegevens voor de betreffende hulpvraag en heeft een aparte functieflag. Het rekenresultaat blijft vooraf zichtbaar. Alleen bewust gedeelde, gevalideerde scenariovelden gaan mee naar het dossier.

Actuele contactteksten komen uit de serverconfiguratie, met versie, ontvanger, ontvangsttijd en het afgesproken contactvenster. Het venster van 30 dagen is bedrijfsbeleid, geen universele bewaartermijn. Intrekking, sluiting of verlopen contactrecht stopt nieuwe opvolging en nog wachtende mails; reeds bij SMTP afgegeven mail is niet terug te halen.

## Opslag, rechten en herstel

Aanvraag, contactbewijs en outboxtaken worden in één MySQL-transactie vastgelegd. Succes volgt pas na commit. Dezelfde aanvraagcode met dezelfde inhoud geeft dezelfde referentie; gewijzigde inhoud met die code wordt geweigerd. Na correctie of wissing mag een oude browserherhaling het dossier niet opnieuw vullen.

Opgeslagen worden de noodzakelijke contact-/woninggegevens, optionele vraag/scenario, bronmodule, onderwerp, contactbewijs, acties/statushistorie en technische queue-/idempotentiegegevens. Vrije notities mogen alleen noodzakelijke informatie bevatten. De publiek toegankelijke analytics bevatten geen NAW, telefoon of e-mail. Pogingsbegrenzing gebruikt tijdelijke gehashte sleutels, geen blijvende IP-lijst.

Het afgeschermde beheer biedt dossierexport, correctie met revisiecontrole, intrekking en gegevenswissing na verificatie van het verzoek. Wissing verwijdert directe gegevens, vrije tekst en oorspronkelijke payloadhash, maar bewaart minimale stop-/idempotentiereferenties tegen heractivering. Dat is geen belofte van volledige anonimisering van alle bedrijfsdata. Een afzonderlijk account/dagmailabonnement vraagt bij een verzoek om alle gegevens óók verwerking in die dienst.

Zie [PRIVACY-OPERATIONS.md](PRIVACY-OPERATIONS.md) voor identiteitcontrole, uitwerking van rechten, het concrete **concept**bewaarbeleid, retentiepreview en een aparte read-only herstelproef. Retentiepreview verwijdert niets. Pseudonieme interacties worden alleen na `ANALYTICS_RETENTION_CONFIRMED=true` volgens het voorgestelde 90-dagenbeleid opgeschoond. Definitieve termijnen, uitzonderingen, verwerkers en kopieën/back-ups vereisen NIVO-goedkeuring.

Het privéherstelregister bevat minimale contactstops, correctierevisies, erasures, abonnementsstops en adres-hashsuppressies. Het register blijft buiten Git/openbare artifacts. Een oude back-up mag deze latere rechten niet terugdraaien. De restorechecker controleert uitsluitend een afzonderlijke kopie en activeert niets.

## Verzendbetrouwbaarheid

Een SMTP-fout wist de aanvraag niet. Begrensde retry, claimlease en gedeeld rollend budget beschermen verwerking. Voor verzending worden actuele contactrechten, status, verval, claims en suppressies opnieuw gecontroleerd. Een onduidelijke externe SMTP-uitkomst blijft een beperking: geen garantie op exact één inboxaflevering.

Alle mailtypen gebruiken hetzelfde ingestelde appbudget van 1–100 pogingen per rollende 24 uur. De eigenaar bevestigde 100 als mailboxplafond; voorstel 50 voor Zonlio zodat er ruimte voor andere mail blijft. Dagmails krijgen maximaal 80% van het appbudget. `MAIL_SEND_PAUSED=true` stopt nieuwe verzendingen. Directe harde bounces en expliciet bevestigde beheerstops blijven via een minimale adres-hash geregistreerd, ook na accountverwijdering. Asynchrone bounces/klachten vereisen nog operationele mailboxafhandeling.

SMTP-acceptatie, ontvangen mail en gelezen mail zijn verschillende bewijsniveaus. De reeds ontvangen losse eigenaarstest bewijst uitsluitend die test. Werkelijke account-, aanvraag- en dagmailberichten, SPF/DKIM/DMARC-resultaten en afmeldheaders moeten apart worden bewezen. Zie [MAIL-AUTHENTICATION-QA.md](MAIL-AUTHENTICATION-QA.md) en het [operationsrunbook](AUTONOMOUS-OPERATIONS.md).

## Beheer en activering

Productie gebruikt MySQL; geen lokale fallback. Beheer gebruikt een expliciet ingestelde scrypt-hash, een apart sessiegeheim en serverzijdige sessies. Productiecookies zijn Secure, HttpOnly en SameSite=Strict. Mutaties vereisen sessie, JSON, vertrouwde origin en CSRF; privacywijzigingen ook actuele revisie en expliciete verzoekcontrole. Onderhoud heeft een afzonderlijk geheim in de Authorization-header, nooit in de URL.

NIVO bepaalt welke persoon bevoegd beheerder is en welke vervanging beschikbaar is voor Pim. De huidige gedeelde applicatieconfiguratie biedt één beheeridentiteit; deel het wachtwoord niet als medewerkersoplossing. Publieke diensten blijven afzonderlijk uit totdat P0-bewijs en eigenaar-GO zijn vastgelegd. Een testdossiermachtiging is geen vrijgave voor publieke instroom.

Portal-export blijft uit. Later ontvangt alleen de bevestigde NIVO-ontvanger actuele woningdossiers volgens [contract v1](PORTAL-CONTRACT-v1.md), met revisionering, intrekking, verval en erasure. Zonlio bouwt geen directe Odoo-export.

## Eerlijke meting

Ruwe serverpaginaweergaven zijn geaggregeerde tellingen zonder opgeslagen IP/cookie/bezoekers-ID en kunnen bots bevatten. Ze zijn geen unieke mensen. Interacties worden alleen na actieve statistiekentoestemming aangenomen. Het tijdelijke tab-ID wordt gehasht en per dag/module/event ontdubbeld; het blijft een pseudoniem. Weigeren en intrekken blijven toegankelijk; na intrekking stopt verzenden en wordt het tab-ID gewist.

`calculator_complete` betekent een geldige bewuste rekenwijziging, bruikbaar plannerresultaat of expliciet resultaatgebruik; geen automatische rendering. Ontvangen advies komt uit opgeslagen aanvragen. De salesrapportage telt per bronmodule werkelijk vastgelegde mijlpalen uit huidige status en historie: poging, bereikt, gekwalificeerd, afspraak, offerte, gewonnen/verloren. Een overgeslagen stap wordt niet ingevuld. Dit bewijst nog geen volledig extern campagnepad of unieke-bezoekerconversie.

## Primaire bronbasis

De actuele AP-bronnen over verificatie, privacyrechten, bewaartermijnen en back-ups staan met concrete toepassing in [PRIVACY-OPERATIONS.md](PRIVACY-OPERATIONS.md). Hostinger- en SMTP-bronnen staan in [DEPLOYMENT.md](DEPLOYMENT.md) en [MAIL-AUTHENTICATION-QA.md](MAIL-AUTHENTICATION-QA.md). Deze technische uitvoering vervangt geen bevoegde definitieve beleidsbeoordeling.
