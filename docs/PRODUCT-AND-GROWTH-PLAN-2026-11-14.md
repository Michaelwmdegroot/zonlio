# Zonlio 2.0 — product-, conversie- en uitvoeringsplan

Datum: 14 november 2026. Status: **voorstel voor eigenaarreview; geen uitvoerings- of commerciële vrijgave**.

Uitgangspunt: `main` op `5579945297ff6578c88df71c8edad175d0eb6ae1`, na merge van ontwerp-PR #6. De eigenaar heeft de visuele fase als succesvol afgerond verklaard. De bestaande Blue Glass-stijl en `src/design-system.css` blijven het ontwerpcontract. Dit plan verandert geen applicatiecode, productieconfiguratie, abonnementen of mailverzending.

## 1. Besluitrichting

**Zonlio wordt een gratis persoonlijke stroomassistent: vandaag helpen, een bruikbaar woningprofiel opbouwen en op het juiste moment vrijwillig woningadvies van NIVO Groep Holland aanbieden.**

Niet: een calculator die de uitslag achter een verplicht contactformulier verbergt. Niet: een lijst e-mailadressen die automatisch een bellijst wordt. Wel: twee routes die naast elkaar bestaan:

- Direct: consument verkent zijn situatie, ziet een resultaat en vraagt bewust NIVO-woningadvies aan.
- Terugkerend: consument ontvangt een zelfgekozen dagplan, gebruikt Zonlio opnieuw en kan later zelf advies aanvragen.

De commerciële richting **NIVO Groep Holland** is door de eigenaar in deze opdracht gekozen. De bestaande broncode noemt standaard nog Thuisbatterij Team B.V. Die keuze mag niet stilzwijgend als dezelfde juridische ontvanger worden behandeld. Vóór activatie moet de precieze juridische entiteit achter NIVO, haar rol als verwerkingsverantwoordelijke en de eventuele rol van Zonlio worden vastgelegd. NIVO is de gekozen commerciële bestemming; de exacte juridische inrichting is een vrijgavepunt, geen nieuwe open merkkeuze.

Zonlio mag niet als onafhankelijke marktvergelijker worden gepresenteerd. De adviesroute noemt NIVO duidelijk. Andere ondernemingen, waaronder Thuisbatterij Team, ontvangen niet automatisch persoonsgegevens op grond van een NIVO-aanvraag.

## 2. Huidige basis en echte ontbrekende onderdelen

### Rechtstreeks gecontroleerd in de repository

- De ontwerpmerge staat op `main` met de centrale stylesheet.
- `server/backend.mjs` bevat een adviesroute, contacttekstversie, gekozen e-mail- of telefoonkanaal, optionele postcode en optioneel scenario. Straat, huisnummer en woonplaats ontbreken in de huidige toegestane payload.
- `server/mail.mjs` maakt leadnotificaties en ontvangstbevestigingen. Het is nog geen abonnementen- of dagplanmailer. De bestaande verwerking haalt telkens de bijbehorende lead op.
- Lead, bewijs en outbox worden volgens de implementatiedocumentatie transactioneel opgeslagen. Deze basis behouden.
- Er zijn beperkte opt-in events (`page_view`, `calculator_complete`, `advice_open`), geaggregeerde serverpaginaweergaven en bestaande beheerstatistieken. Dit is geen complete acquisitie-, retentie- of omzetfunnel.
- De huidige calculator gebruikt scenarioaannames. De planner plant met gepubliceerde prijzen, niet met een bewezen persoonlijke PV-forecast, en stuurt geen apparaten aan.

### Nog niet als operationeel geslaagd beschouwd

SMTP vanuit de applicatie, werkelijke inboxbezorging, geplande verwerking, productie-restore, volledige beheerroute en commerciële vrijgave blijven de bestaande P0-controles. De laatste eigenaargerapporteerde health had `leadEnabled:false`. Een nieuwe read-only poging naar health/config/privacy via de webtool was niet toegankelijk; dit bewijst geen uitval en bevestigt evenmin een actuele flagwaarde.

De Hostinger Mail-connector bevestigt toegang tot `info@zonlio.nl`. De quota-actie toont opslag en aantallen opgeslagen berichten, **niet** het actuele uitgaande dagquotum. Daaruit wordt geen verzendcapaciteit afgeleid.

### Nieuw te bouwen

Persoonlijk opgeslagen consumentenprofiel, veilige optionele accounttoegang, abonnementen met afzonderlijke toestemmingen, dagplangeneratie, voorkeurencentrum, volledige woningadvies-intake, opvolgworkflow, consent/suppression-controles, betrouwbare mailplanning, CRM-overdracht en uitgebreidere meting.

## 3. Consumentenproduct: drie samenhangende onderdelen

### 3.1 Zonlio Vandaag / Dagplan

De belangrijkste vraag is niet alleen ‘Wat is de stroomprijs?’, maar ‘Wat kan ik vandaag praktisch doen?’

De gebruiker kiest contracttype, apparaten en toegestane tijdvensters. Zonlio toont een concreet aanbevolen blok, waarom dat blok is gekozen en de gebruikte prijsbasis. Zelf ingevoerd apparaatverbruik krijgt voorrang boven een voorbeeldprofiel; aannames blijven zichtbaar.

| Situatie | Zinvolle hulp | Geen ongefundeerde belofte |
| --- | --- | --- |
| Dynamisch contract | Goedkoop passend apparaatblok op basis van bevestigde contractonderdelen | Beursprijs niet als volledige consumentenprijs tonen |
| Vast/variabel tarief | Uitleg over eigen gebruik en scenario's; passend dagritme | Geen tariefbesparing door alleen op een ander uur netstroom te gebruiken suggereren als het tarief gelijk is |
| Zonnepanelen | Eigen-gebruikscenario en vervolginvoer voor dak/contract | Geen dakopwek of zonmoment in kWh afleiden uit alleen bewolking |
| Elektrische auto | Gewenste energie, beschikbaarheid en vertrektijd | Geen automatisch laden of laadvermogengarantie claimen |
| Onbekend contract | Duidelijk gemarkeerde beursinformatie en hulp bij invoer | Geen persoonlijk financieel voordeel claimen |

Bij dynamische tarieven wordt ook de contractuele afrekenresolutie vastgelegd: uur of kwartier. Kwartierbrondata betekenen niet automatisch dat een huishouden per kwartier wordt afgerekend.

De huidige planner blijft eerst binnen de daadwerkelijk beschikbare prijsdag. Planning over middernacht wordt pas aangeboden na uitbreiding naar twee aaneengesloten, gevalideerde prijsdagen. Meerdere losse apparaatadviezen zijn geen optimalisatie van het totale huishoudvermogen; dat onderscheid blijft zichtbaar.

### 3.2 Mijn Zonlio

Een optioneel persoonlijk dashboard, bereikbaar vanuit het bestaande ‘Mijn huis’. Geen registratie om prijzen of eerste scenario's te bekijken.

Het bewaart contractinstellingen, gekozen apparaten, verbruik/opwek, aannames, opgeslagen scenario's en mailvoorkeuren. De consument kan later op een ander apparaat verdergaan. Aanmaken gebeurt na een betekenisvol resultaat, met een veilige eenmalige e-mailcode of link; een abonnement hoeft geen uitgebreid accountformulier te vereisen.

Toegang tot een profiel, inschrijving voor dagmail en toestemming voor marketing zijn afzonderlijke handelingen. E-mailverificatie is geen bewijs dat een telefoonnummer van diezelfde persoon is.

Het dashboard toont ‘berekend voordeel’ of ‘potentieel volgens jouw invoer’, niet ‘al bespaard’, zolang er geen gemeten verbruik en een verdedigbare vergelijking beschikbaar zijn. Geen kunstmatige bespaarteller, woonlabel of pseudo-nauwkeurige energiescore.

### 3.3 Mijn woningplan

Een korte interactieve verkenning vraagt stapsgewijs naar contracttype, zonnepanelen, totaalverbruik, grote verbruikers en doel. ‘Weet ik niet’ blijft mogelijk; ontbrekende input wordt niet heimelijk als een persoonlijk feit ingevuld.

De uitkomst wordt direct zichtbaar en ordent maatregelen als:

1. Wat je zonder investering kunt aanpassen.
2. Wat met betere instellingen of planning mogelijk kan zijn.
3. Welke investering een nader onderzoek verdient.

Een ongunstig batterijscenario blijft ongunstig. Een huishouden kan dus het advies krijgen voorlopig geen batterij te kopen. De huidige jaarberekening kan een aanleiding voor onderzoek tonen, maar geen betrouwbare batterijcapaciteit of rendementsbelofte bepalen.

De 2027-module krijgt een inhoudelijk vervolg na de overgang naar 2027: ‘Mijn zonnestroom’ met scenariojaar en gedateerde regels. De afschaffing van salderen per 1 januari 2027 is een relevante aanleiding, geen excuus voor verzonnen deadlines of schaarste.

## 4. Conversie: waarde vóór gegevens

### 4.1 Instap en informatie per stap

| Stap | Waarde voor consument | Benodigde gegevens | Commerciële status |
| --- | --- | --- | --- |
| Vrij gebruiken | Prijzen, planner, eerste scenario | Geen contactgegevens; optionele invoer lokaal | Bezoeker |
| Dagplan aanvragen | Zelfgekozen praktische mail | E-mail, frequentie, relevante planinstellingen | Abonnee, géén saleslead |
| Profiel bewaren | Later of elders verdergaan | Geverifieerde toegang en gekozen profielvelden | Gebruiker, géén beltoestemming |
| Woningadvies aanvragen | Persoonlijke intake voor de eigen woning | Naam, noodzakelijk woningadres, telefoon; e-mail optioneel voor bevestiging | Expliciet adviesverzoek |
| NIVO kwalificeert | Passend vervolg of afspraak | Bereikbaarheid, behoefte, werkgebied, toestemming | Door sales geaccepteerde lead |

NAW + telefoon is de gewenste complete woningadvieslead. Deze velden worden pas gevraagd wanneer iemand zelf woningadvies aanvraagt, niet als toegangsbewijs voor de gratis tool of de dagelijkse mail.

Een volledig adres moet passen bij de concrete woningintake, werkgebiedcontrole of locatiegebonden voorbereiding. Bij alleen een algemene telefonische vraag kan postcode/woonplaats voldoende zijn. Dan niet onnodig een volledig adres verplichten; het dossier blijft zo nodig ‘nog aan te vullen’ in plaats van de consument te dwingen. Een commerciële wens om alle velden te hebben vervangt niet de noodzaakstoets.

### 4.2 Concrete acties in de interface

- Na een bruikbare planning: **‘Ontvang mijn stroommomenten per e-mail’**.
- Na een persoonlijke scenario-uitkomst: **‘Bewaar mijn woningplan’**.
- Bij een relevante hulpvraag: **‘Bespreek mijn woningplan met NIVO’**.
- Bij de batterijmodule: **‘Laat beoordelen of een batterij bij mijn woning past’**, nooit ‘Claim je gegarandeerde besparing’.

Maximaal één prominente vervolgstap per context. Geen direct geopende leadpopup, geblokkeerde uitslag, vooraf aangevinkte marketing of ongefundeerde ‘gratis advies ter waarde van’-claim.

### 4.3 Woningadvies-intake

Drie korte stappen, met zichtbaar nut:

**Woning en vraag:** onderwerp, postcode/huisnummer/toevoeging en straat/woonplaats voor zover noodzakelijk, eigendom/beslissingsbevoegdheid wanneer relevant. Handmatige adresinvoer blijft mogelijk; geen betaalde adresdienst toevoegen zonder akkoord.

**Persoonlijk contact:** naam, telefoonnummer, optioneel e-mail en een voorkeursmoment. Een voorkeursmoment is geen bevestigde afspraak als agenda/capaciteit niet gekoppeld is.

**Controle en aanvraag:** gegevens, ontvangende onderneming, gekozen onderwerp en welke scenario-informatie wordt meegestuurd. Delen van het rekenprofiel blijft een aparte bewuste keuze. Geen accountplicht.

Concept terugbeltekst, na juridische invulling te beoordelen:

> Ik vraag NIVO Groep Holland om mij telefonisch te benaderen over mijn woningadvies voor [onderwerp]. Ik kan dit verzoek intrekken. Mijn gegevens worden niet gebruikt om mij automatisch voor nieuwsbrieven of algemene belcampagnes aan te melden.

Daarbij wordt de werkelijke juridische ontvanger genoemd. Bestaande contacttermijn van 30 dagen is bedrijfsbeleid, geen wettelijke standaard; niet verwarren met bewaartermijn. We beloven pas een reactietijd als de opvolging dit daadwerkelijk kan dragen.

Een succesmelding verschijnt uitsluitend na databasecommit, met aanvraagnummer, verwachting en intrekkingsmogelijkheid. Een mailfout verandert een ontvangen aanvraag niet in een mislukte aanvraag.

## 5. Zonlio Dagplan: de terugkerende reden om terug te komen

### 5.1 Eerste versie

Een korte, mobiel leesbare mail met een persoonlijke hoofdactie, maximaal enkele apparaatmomenten, datum en tijdzone, prijsbasis en een knop ‘Bekijk mijn dagplan’. Geen dashboard als enorme afbeelding en geen bijlage als primaire ervaring.

Voorbeeld — uitsluitend fictieve tijden en bedragen:

> **Jouw Zonlio-dagplan voor morgen**
>
> Wasmachine: 13:00–15:00, binnen jouw gekozen tijdvenster.
>
> Berekende programmakosten: €0,21, tegenover €0,34 op jouw gebruikelijke moment. Verschil: €0,13 bij het ingevulde verbruik en tarief.
>
> Stel zelf je apparaat of timer in. Bekijk of wijzig je dagplan.

Een vergelijking gebruikt hetzelfde apparaat, dezelfde energie, dezelfde datum en dezelfde contractbasis. Ontbreekt het gebruikelijke moment of passend vergelijkingsblok, dan geen besparingsbedrag tonen. Geen vergelijking met willekeurig de duurste uren. Een relatief goedkope dag geeft niet vanzelf groot financieel voordeel.

### 5.2 Frequentie en verzending

Voorgesteld instelbaar productgedrag:

- Avondoptie: plan voor morgen, bijvoorbeeld vanaf 18:00 Europe/Amsterdam, pas na validatie van de gepubliceerde prijzen.
- Ochtendoptie: plan voor vandaag, bijvoorbeeld rond 07:00; alleen nog uitvoerbare momenten.
- Wekelijks overzicht of pauze als alternatief. Niet zonder keuze overzetten op een andere lijst.
- In de eerste versie maximaal één dagplan per persoon per dag. Drempelmeldingen zoals ‘alleen bij een groot prijsverschil’ volgen later.

Dit zijn ontwerpdefaults, geen reeds ingerichte planning. De engine beslist op datagereedheid en tijd, niet op een aanname dat prijzen altijd op een vast kloktijdstip gepubliceerd zijn.

Bij vertraagde data: binnen het toegestane venster opnieuw proberen; daarna het advies overslaan of hoogstens een afgesproken neutrale bronmelding. Nooit gisteren als morgen versturen. Een na het aanbevolen startmoment wachtend bericht verloopt; geen achterstand uitrollen met onuitvoerbare tips.

Voor vaste tarieven zonder bruikbare PV-/verbruikinformatie is een wekelijkse uitleg vaak een eerlijker propositie dan een dagelijkse ‘goedkoopste stroom’-mail. De consument kiest dit zelf. Een persoonlijke zonneprognose wacht op het latere gevalideerde model.

### 5.3 Abonnement en toestemming

De abonnee kiest expliciet de dienst en bevestigt het e-mailadres via double opt-in. Niet-bevestigde adressen krijgen geen dagmails. De bevestiging is een product- en bewijsmaatregel; niet gepresenteerd als universeel wettelijk verplichte techniek.

Afzonderlijke doeleinden en staten:

- Dagplanservice: gevraagd praktisch advies, frequentie en profiel.
- Optionele tips/aanbiedingen: commerciële berichten van de duidelijk genoemde afzender.
- Adviesverzoek: contact over het specifiek aangevraagde onderwerp.
- Statistiekkeuze: optionele gebruiksmeting.

De standaard dagmail bevat geen verborgen NIVO-verkoopaanbod. Commerciële aanbiedingen komen alleen in een afzonderlijk, bewust gekozen berichttype. Een klik op een algemeen dagplan geeft geen beltoestemming. Op de website kan de consument opnieuw zelf woningadvies kiezen.

## 6. NIVO-leads, opvolging en CRM

### 6.1 Niet iedereen in dezelfde bak

Aparte administratieve categorieën: bezoeker, onbevestigde inschrijver, actieve abonnee, accountgebruiker, adviesaanvraag en door sales geaccepteerde lead. Een persoon kan meerdere rollen hebben; de bijbehorende rechten blijven gescheiden.

Een complete woningadvieslead bevat: naam/adres/woonplaats/telefoon, hulpvraag, bronmodule, contactverzoek met tekstversie en tijd, ontvanger, optioneel gedeeld scenario, gekozen tijdvenster en status. Een e-mailadres is nuttig maar geen extra verplicht veld voor een puur telefonisch verzoek zonder noodzaak.

### 6.2 Praktische werkvoorraad

Voorgestelde workflow: nieuw → toegewezen → contactpoging → bereikt → gekwalificeerd → afspraak → offerte → gewonnen/verloren. Daarnaast: dubbel, buiten werkgebied, uitgesteld, onbereikbaar en ingetrokken. Een contactpoging is niet hetzelfde als een bereikt persoon.

Iedere aanvraag heeft een eigenaar, volgende actie en datum. Intrekking stopt verdere contacttaken. Start met een begrensd opvolgbeleid, bijvoorbeeld maximaal drie pogingen binnen de aangevraagde contactperiode; laat dit vóór gebruik door de eigenaar goedkeuren.

Prioriteit is uitlegbaar: expliciet gevraagde timing, concrete vraag, werkgebied en volledigheid. Geen ‘koopkans 87%’ zonder modelbewijs, geen score gebaseerd op e-mailopens en geen automatische afwijzing op indirecte welvaarts- of persoonskenmerken. Scores kunnen nooit toestemming vervangen.

### 6.3 Bestaand CRM respecteren

Zonlio beheert intake, bewijs, abonnementen en meetinformatie. Het bestaande NIVO/Odoo-proces blijft de voorkeursplek voor sales, offertes en uitvoering zodra de werkelijke bestaande route is geïnspecteerd.

Geen tweede concurrerend volledig CRM. Eerst veilige lokale opvolging; daarna een adapter met expliciete company/team-mapping. Geen oncontroleerbare generieke mail die mogelijk bij de verkeerde onderneming een verkoopkans aanmaakt.

Synchronisatie gebruikt een stabiele Zonlio-aanvraag-ID, herhaalbare overdracht, foutwachtrij en resultaat terug naar Zonlio. Intrekkingen en suppressies gaan mee. Een abonneelijst wordt niet als verkoopkansen geïmporteerd. Een overeenkomstig adres is geen reden om profielen van verschillende bewoners samen te voegen.

## 7. Twee dashboards, dezelfde designbasis

### Consument: Mijn Zonlio

Dagplan, apparaten, instellingen, woningprofiel, opgeslagen scenario's, voorkeuren, eventueel status van de eigen aanvraag en verwijder-/exportmogelijkheden. Geen saleskolommen of gefingeerde resultaten.

### NIVO: bestaand beheer uitbreiden

**Vandaag:** nieuwe aanvragen, nog niet opgepakte aanvragen, eerstvolgende taken en mail-/databronproblemen.

**Leads:** gefilterde werkvoorraad, details, gedeelde scenario's, bewijs van contactverzoek, notities, eigenaar en uitkomst.

**Abonnees en e-mail:** bevestigde inschrijvingen per berichttype, wachtrij, vertraging, tijdelijke fouten, bounces, uitschrijvingen, campagnes en globale pauzeknop.

**Resultaat:** bron → bruikbare interactie → aanvraag → geaccepteerde lead → afspraak → offerte → gewonnen. Cohorten en datumbereik expliciet.

**Beheer:** gebruikers/rollen, ontvanger, bewaarbeleid, toestemmingsversies, schedulerstatus en auditlog. Geheimen worden niet in het dashboard afgedrukt.

Geen gedeeld adminwachtwoord voor een team. Minimaal eigenaar/beheerder, sales en marketingrollen, met beperkte inzage per taak. Technische logs bevatten geen naam, adres, telefoon, e-mail of token. Interne mailnotificaties krijgen bij voorkeur een beveiligde dossierlink en minimale gegevens in plaats van een volledige NAW-kopie.

## 8. Meting en experimenten

### Drie stuurgetallen

| KPI | Definitie en bron | Waarop sturen |
| --- | --- | --- |
| Door NIVO geaccepteerde woningadviesleads per week | Unieke aanvragen die sales in de week voor het eerst als passend heeft geaccepteerd; complete noodzakelijke intake, relevant werkgebied en geldig contactverzoek; tests en dubbelen uitgesloten | Kwaliteit en afhandelbare instroom, niet zoveel mogelijk formulieren |
| Terugkerende bruikbare gebruikers | Personen/accounts of expliciet meetbare sessiecohorten met opnieuw een betekenisvolle plan-/scenariodienst in een afgesproken vervolgfase; scope en trackingdekking zichtbaar | Praktisch productnut; niet websitebezoek gelijkstellen aan gerealiseerde besparing |
| Afspraken/offertes/gewonnen opdrachten uit aanvraagcohorten | Aanvragen uit een vaste periode met later gedateerde CRM-uitkomsten; cohort ouderdom zichtbaar | Commerciële bijdrage en kwaliteit op langere termijn |

Bij de tweede KPI wordt geen langdurige anonieme gebruikersidentiteit verzonnen. Een tab-ID meet geen persoon. Langere terugkeerpercentages alleen tonen voor een cohort dat rechtmatig en betrouwbaar te volgen is. Begin anders met beperkte, expliciet gelabelde signalen.

Diagnostiek: bevestigingspercentage inschrijvingen, formulierveldfouten, aanvraagvoltooiing binnen meetbare sessies, opvolgtijd, bereikbaarheid, uitstroomredenen, queueleeftijd, SMTP-acceptatie, bounces en uitschrijvingen.

### Belangrijke meetregels

- Ontvangen aanvragen komen uit databasecommits; nieuwsbriefinschrijvingen uit bevestigde subscription-records, niet uit klikken.
- Ruwe pageviews zijn geen unieke bezoekers. Opt-in sessies en alle leads mogen niet zomaar in één conversiepercentage worden gedeeld.
- Geen e-mailopenpercentage als primaire succesmaatstaf. Apple Mail Privacy Protection verhindert betrouwbare openwaarneming. Standaard geen openpixel.
- Een mailklik kan een linkscanner zijn; bevestigings- en aanvraagacties vereisen een bewuste vervolgactie. Klikmeting blijft begrensd en niet persoonsgericht zonder passende grondslag.
- Bronvelden zijn beperkte campagnecodes, geen ongeschoonde URL/querystring waarin persoonsgegevens kunnen staan. Geen NAW naar GA/Meta of analytics-events.
- Statistiekweigering blokkeert de tool, dagmail of adviesaanvraag niet.
- Intrekking, hard bounce of klacht verhindert toepasselijke vervolgmails vóór de verzendpoging; niet alleen bij het aanmaken van een campagne.

Er zijn nog geen bruikbare baselineaantallen voor deze nieuwe funnel. Geen conversieprognose of omzetbelofte. Eerst instrumenteren en nulmeting; daarna doelwaarden onderbouwen met verkeer, leadkwaliteit en salescapaciteit.

Eerste experimenten: ‘Bewaar mijn plan’ tegenover ‘Ontvang mijn dagplan’; timing van de adviesactie na de uitkomst; volgorde van twee noodzakelijke intake-stappen. Eerst kleine kwalitatieve gebruikerstests, pas statistische A/B-claims bij voldoende meetbare steekproef. Primaire uitkomst is een geaccepteerde lead, met uitschrijvingen, klachten en gebruiksgemak als tegenwicht.

Kosten per geaccepteerde lead = toerekenbare acquisitie- en verzendkosten / geaccepteerde leads uit hetzelfde cohort. Nooit delen door nul; zonder salesuitkomst geen fictieve omzetwaarde toekennen.

## 9. Technische uitvoering op de bestaande stack

Node.js 24, Express, JavaScript en MySQL blijven. Geen nieuw framework, Redis, permanent draaiende mailworker of betaalde marketing-SaaS nodig om de eerste versie te bouwen.

### 9.1 Dataconcepten

Gebruik bestaande tabellen waar passend; voer versieerbare, niet-destructieve migraties uit. De volgende concepten moeten onderscheiden kunnen worden:

- Gebruiker/toegang, huishoudprofiel met versie en apparatenvoorkeuren.
- Abonnement per berichttype, bevestigingsstatus en frequentie.
- Consent/contactverzoek per doel, ontvanger, tekstversie, bron, tijd en intrekking.
- Suppressie per kanaal/doel plus expliciete algemene contactstop waar gevraagd.
- Aanvraag met NAW, contact, scenario-snapshot, opvolging en CRM-referentie.
- Dagplan met bron-/contract-/profiel-/modelversie, leveringsdag en geldigheid.
- Mailtaak, poging, providerresultaat, vervaltijd en idempotentiesleutel.
- Toegestane events/aggregaten en beheer-audit.

De huidige lead-outbox niet rechtstreeks misbruiken voor abonnees: de huidige mailer verwacht een lead-ID. Eerst zorgvuldig veralgemeniseren of een afzonderlijke subscription-outbox met gedeelde veilige verzendlaag toevoegen. Bestaande leadtransacties en retries moeten ongewijzigd blijven werken.

### 9.2 Dagplanpipeline

Gepubliceerde prijsdata valideren → planberekening met hetzelfde rekenpad als de website → planversie opslaan → actieve abonnementen selecteren → opnieuw toestemming/suppressie/quota controleren → mailtaak aanmaken → begrensd verzenden → resultaat en fouten vastleggen.

Een logische unieke sleutel zoals `(subscriber, type, leveringsdag, gekozen editie)` voorkomt dubbele planning door meerdere scheduler-aanroepen. Databaseclaim met lease/locking voorkomt parallel dubbel werk. Een onduidelijk SMTP-resultaat kan desondanks dubbele bezorging veroorzaken; beloof geen absolute exactly-once inboxlevering.

Bewaar eenmaal opgehaalde prijsdata gedeeld in MySQL voor batchverwerking; niet per abonnee opnieuw opvragen. Dat is ook nodig omdat bestaande caches procesgebonden zijn en een apart cronproces anders een eigen limiter kan maken. Bewaar licentie, tijdstempel en volledige intervalcontrole.

### 9.3 Hostinger en operationele planning

De actuele Hostinger-documentatie ondersteunt geplande Node.js-scripts op web/cloud-hosting. Cron draait in UTC en erft website-omgevingsvariabelen niet automatisch. De implementatie moet de juiste beveiligde configuratie en actuele deploymentpaden laden zonder secrets in URL, chat, commit of output. De reeds voorziene Authorization-header blijft de veilige route voor een interne onderhoudsaanroep; geen secret-queryparameter overnemen uit voorbeelden.

Voorgestelde regelmatige scheduler-tick, bijvoorbeeld elke vijf minuten, kiest welke lokale Europe/Amsterdam-taken verschuldigd zijn. Zo voorkomt zomer-/wintertijd geen of dubbele dagmails. Dit is een websitevoorziening, geen ChatGPT-herinnering of afhankelijkheid van een open browser/Mac.

Taken zijn kort, begrensd, herhaalbaar en hervatbaar. Toon laatste succesvolle tick en queueleeftijd. Hostinger ondersteunt in dit pakket geen permanent draaiende aparte achtergrondworkers; geen architectuur kiezen die daarop leunt.

### 9.4 Betrouwbare e-mail

Start met de bestaande SMTP-koppeling voor een begrensde, goedgekeurde pilot. Hostinger staat aangevraagde opt-innieuwsbrieven en transactionele mail binnen pakketlimieten toe. Dat is geen onbeperkt volume. Verifieer het echte uitgaande rollende 24-uursquotum en eventuele proefperiode voordat een pilotomvang wordt vastgelegd.

Documentatie noemt onder meer 100 uitgaande berichten per 24 uur voor bepaalde trial-/legacyvarianten en hogere betaalde limieten; niet aannemen dat dit het Zonlio-pakket is. Een rekenvoorbeeld: bij een werkelijk quotum van 100 zou een pilot van 20 dagelijkse ontvangers ruimte kunnen laten voor bevestigingen, inlogcodes en aanvraagmail. De resterende capaciteit moet werkelijk worden begroot; een opslaglimiet van 15.000 berichten zegt hierover niets.

Een bestaande verwerking van drie taken per onderhoudsaanroep is geen bulkstrategie. Mailklassen krijgen capaciteit en prioriteit: toegang/bevestiging en aanvraagcommunicatie mogen niet verdrongen worden door dagmails of marketing. Binnen de toegestane providergrenzen verzenden; geen rotatie over mailboxen om limieten te omzeilen.

SPF/DKIM/DMARC, TLS, herkenbare afzender, gecontroleerd reply-adres, HTML én platte tekst, mobiele weergave, bounceverwerking en afmelden zijn onderdeel van de vrijgave. SMTP-acceptatie heet niet ‘gelezen’ of gegarandeerd ‘afgeleverd’. Afleverstatus alleen tonen als die echt beschikbaar is.

Voor abonnementen direct een duidelijke afmeldlink en RFC 8058 one-click ondersteuning ontwerpen, ook vóór bulkdrempels. Een normale link-GET toont een pagina; een bewuste POST voert de actie uit. Provider-one-click POST kan de juiste lijst zonder login uitschrijven. Tokens zijn beperkt tot hun doel; een afmeldtoken opent nooit het volledige NAW-dossier.

Een eventuele latere mailprovider krijgt een verwisselbare adapter. Geen kosten, provideraccount of abonnement activeren zonder eigenaarakkoord. Volledige schaalbaarheid is niet hetzelfde als onbeperkt kosteloos verzenden.

### 9.5 Veiligheid en privacy-operatie

Eenmalige toegangstokens kort geldig, gehasht opgeslagen, begrensde verzoeken, generieke antwoorden tegen accountenumeratie en geen tokenverbruik door link-previews. Herbevestig gevoelige wijzigingen. Identiteits- en adresgegevens alleen zichtbaar voor bevoegde rollen; export en wijziging auditen.

We scheiden statistiek, maildienst, woningadvies en marketing. Een account is geen klantrelatie die op zichzelf marketing toestaat. Interne wettelijke grondslagen en externe contacttoestemming worden niet als één checkbox behandeld.

Voorgesteld bewaarbeleid, nog te bekrachtigen: onbevestigde aanmeldingen na zeven dagen opruimen; lopende aanvragen doelgebonden bewaren; gesloten of inactieve dossiers periodiek beoordelen en niet meer noodzakelijke NAW verwijderen. Beperkt bewijs en suppressie alleen bewaren zolang dit rechtmatig nodig is. Geen generieke oneindige bewaartermijn of verzonnen wettelijke 30-dagenregel.

Een herstelproef draait naar een aparte database. Na herstel wordt de actuele suppressie-/intrekkingsstand gecontroleerd vóór mail of contacttaken weer starten, zodat een oude backup geen ingetrokken toestemming opnieuw activeert. Verwerkersafspraken, locatie/doorgiften en rechtenafhandeling worden vóór de pilot vastgelegd.

## 10. Uitvoering in vrijgeefbare pakketten

| Pakket | Oplevering | Afhankelijkheid / vrijgave |
| --- | --- | --- |
| A — Fundament en bewijs | Bestaande P0 #1–#3, NIVO-identiteit, SMTP/DNS, cron, restore, toestemming/retentie, veilige migraties, kanaalflags | Geen commerciële activatie zonder bewijs en expliciet akkoord |
| B — Eerste volledige woningadviesroute | Persoonlijk resultaat → bewuste NAW/telefoon-intake → één opgeslagen aanvraag → NIVO-werkvoorraad → bevestiging → opvolging | A; bestaande gratis functies en design intact; analytics vanaf deze stap |
| C — Dagplanpilot | Double opt-in, planprofiel, optionele veilige toegang, voorkeuren, datagereedheidscheck, verzendbudget, afmelden/bounces | A; quota en bezorging bewezen; eerste ontvangers expliciet toegestaan |
| D — Groei en CRM | Odoo-adapter, rollen, betere funnel-/cohortmeting, relevante SEO-pagina's en optionele tipscampagnes | B/C; werkelijk CRM en toestemmingsscope gecontroleerd |
| E — Energie-intelligentie | PV-forecast, intervalbatterijmodel, toetsbare AI-uitleg | Bestaand #5; bronlicenties, data en backtests; geen verplichte extra kosten |

B en C mogen op aparte branches grotendeels parallel worden voorbereid; activering blijft apart. De eerste productrelease bewijst één complete route in plaats van losse halfafgebouwde functies.

Voorgestelde latere uitvoeringstickets: GROWTH-01 identiteit/toestemmingsmodel; GROWTH-02 woningplan/intake; GROWTH-03 profiel/toegang; GROWTH-04 abonnementen/voorkeuren; GROWTH-05 dagplan/cron/outbox; GROWTH-06 sales/CRM; GROWTH-07 meting/SEO. Dit zijn planlabels, nog geen aangemaakte GitHub-issuenummers. #1–#3 worden niet dubbel aangemaakt; #5 blijft het geavanceerde modelwerk. Visuele goedkeuring betekent geen toestemming om de P0-gates te sluiten.

## 11. Acceptatie voordat echte consumenten worden toegevoegd

- Eén aanvraag komt ook bij herhaald verzenden precies één keer als logische aanvraag in MySQL; bewijs en verzendtaken zijn atomair.
- NAW en telefoon zijn gevalideerd; adresnoodzaak en daadwerkelijke ontvanger zijn duidelijk. Niet-meegestuurd scenario komt niet alsnog mee.
- Geverifieerde abonnees zijn geen verkoopkansen. Afgewezen marketing of analytics verhindert de gevraagde dienst niet.
- Dubbele scheduler-ticks, herstart, tijdzonewissel en parallelle batches plannen niet dubbel. Verlopen adviezen worden niet verzonden.
- Morgen zonder prijzen blijft zonder voorspeld prijsadvies. Onvolledige dag, negatieve prijs, 92/100 kwartieren, vast tarief en onbekende contractinput zijn getest.
- Een adviesmail en de website geven bij dezelfde bron-/profielversie dezelfde uitkomst. Verandering van het profiel leidt tot herberekening of expliciet verouderde status.
- De e-mail komt bij eigen toegestane testontvangers aan; SPF/DKIM/DMARC en spammap worden gecontroleerd. SMTP-acceptatie blijft apart gelabeld.
- Afmelden, intrekken of een bounce nadat een taak al klaarstaat, blokkeert de passende verzending. Optioneel afgewezen marketing blijft uit.
- Lead blijft bestaan bij SMTP-/CRM-uitval; herstel veroorzaakt geen nieuwe CRM-kans. Een bestaande suppressie mag niet door import worden overschreven.
- Gebruiker A kan profiel/aanvraag van B niet openen, ook niet via gewijzigde URL's of tokens. Sales en marketing zien alleen noodzakelijke gegevens.
- Data-export, intrekking, verwijdering en niet-destructieve restore zijn uitgevoerd met expliciet toegestane testgegevens.
- Core journey werkt met toetsenbord en op mobiel, inclusief foutmeldingen. De centrale stijl blijft behouden.
- `npm run check`, `npm test`, `npm run build` en relevante MySQL-integratie zijn groen vóór merge. Na deployment volgt een afzonderlijke productiecontrole.

## 12. Wat nog moet worden vastgesteld, zonder dit plan te blokkeren

De commerciële bestemming NIVO is gekozen. Nog feitelijk vast te leggen zijn: precieze juridische exploitant/ontvanger, werkgebied en beschikbare opvolgcapaciteit, werkelijke SMTP-verzendlimiet/proefperiode, bestaande CRM-company/team/route, beheerdersrollen en definitieve privacy-/bewaarteksten. Geen verzoek om geheimen in chat. Geen conversie- of omzetdoel zonder baseline en salescapaciteit.

**Aanbevolen eerstvolgende uitvoer:** pakket A combineren met de afgebakende bouw van pakket B. Het datamodel wordt meteen voorbereid op C, maar openbare abonnements- en leadactivatie krijgen elk een eigen GO/HOLD-besluit.

## Bronnen en bewijsgrenzen

Repositorybasis: huidige `AGENTS.md`, `docs/PILOT-HANDOFF-2026-11-14.md`, `docs/LEADS-PRIVACY.md`, `docs/DESIGN-SYSTEM.md`, `server/backend.mjs`, `server/mail.mjs`, actuele `main` en issue-overzicht. De implementatiebeschrijving is geen nieuwe productie-E2E-test. Hostinger Mail is alleen read-only gebruikt voor account- en opslagquotacontrole.

Extern geverifieerd op 14 november 2026:

- ACM, telemarketing en voorafgaande specifieke toestemming: https://www.acm.nl/nl/verkoop-aan-consumenten/reclame-en-verleiden/verkoop-telemarketing
- Overheid, strengere regels sinds 1 juli 2026: https://ondernemersplein.overheid.nl/wetswijzigingen/telemarketing-uw-klant-niet-meer-ongevraagd-bellen/
- AP, digitale direct marketing en onderscheid abonnee/klant: https://autoriteitpersoonsgegevens.nl/nl/onderwerpen/internet-telefoon-tv-en-post/direct-marketing en https://autoriteitpersoonsgegevens.nl/en/themes/internet-and-smart-devices/advertising/digital-direct-marketing
- AP, doelbinding en dataminimalisatie: https://autoriteitpersoonsgegevens.nl/themas/basis-avg/avg-algemeen/de-avg-in-het-kort
- AP, bewaren: https://autoriteitpersoonsgegevens.nl/nl/over-privacy/persoonsgegevens/bewaren-van-persoonsgegevens
- Hostinger, toegestaan opt-inmailgebruik: https://www.hostinger.com/support/1583510-is-mass-mailing-supported-at-hostinger/
- Hostinger, actuele pakketafhankelijke mailgrenzen: https://www.hostinger.com/support/4625828-parameters-and-limits-of-hostinger-email/
- Hostinger, Node.js-cron en afzonderlijke configuratie/UTC: https://www.hostinger.com/support/how-to-run-cron-jobs-for-node-js-websites-at-hostinger/
- Hostinger, geen permanente aparte workers op dit hostingtype: https://www.hostinger.com/support/hostinger-node-js-limits-for-web-and-cloud-plans/
- Google, verzendauthenticatie, abonnementen en one-click: https://support.google.com/mail/answer/81126?hl=en
- Apple, beperkingen openmeting: https://support.apple.com/guide/icloud/use-mail-privacy-protection-mm90f7d05c96/icloud
- Rijksoverheid, einde salderen per 1 januari 2027: https://www.rijksoverheid.nl/themas/klimaat-milieu-en-natuur/energie-thuis/salderingsregeling

Architectuur, teksten, frequenties, bewaarbeleidsvoorbeelden, KPI-keuzes en uitvoeringsvolgorde in dit document zijn **voorstellen**, geen al gebouwde functies, bewezen conversiewinsten of juridisch eindoordeel. Juridische aansluiting wordt vóór activatie getoetst op de feitelijke entiteiten en verwerking.
