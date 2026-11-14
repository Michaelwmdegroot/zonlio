# Zonlio: rekenmodel en grenzen van de productie-interface

Deze beschrijving volgt [src/app.mjs](../src/app.mjs),
[src/api.mjs](../src/api.mjs), [src/data.mjs](../src/data.mjs) en
[src/domain.mjs](../src/domain.mjs). Zij beschrijft het gedrag en de aannames
van de applicatie; zij verklaart niet dat de volledige website al live is getest.

## Welke gegevens bepalen welke uitkomst?

| Onderdeel | Invoer | Betekenis van de uitkomst |
| --- | --- | --- |
| Prijsgrafiek, stand Beurs | Gepubliceerde Nederlandse dagmarktprijzen | Beursprijs per kWh, zonder belastingen en leverancierskosten |
| Prijsgrafiek, stand Afname | Marktprijzen plus bevestigde contractonderdelen, of één ingevoerd vast tarief | Berekende afnameprijs volgens die instellingen |
| Prijsgrafiek, stand Terugleveren | Expliciet ingevoerde vergoeding en variabele terugleverkosten | Constante netto terugleverwaarde per kWh |
| Apparatenplanner | Beschikbare toekomstige kwartieren en aangenomen apparaatverbruik | Passend blok met de laagste berekende beurs- of afnamekosten |
| 2027-scenario | Jaarverbruik, jaaropwek, direct eigen verbruik en jaartarieven | Variabel jaarsaldo zonder salderen |
| Batterijscenario | Het verbeterde 2027-scenario plus jaarlijkse opslag en kosten | Extra jaarlijks voordeel van meer eigen zonnestroom boven op dat scenario |
| Weerkaart | Regionale weersverwachting van MET Norway | Weercontext, zonder berekening van zonneopwek of financieel voordeel |

De dagcontractinstellingen (`state.dayContract`) en de jaaraannames
(`state.profile`) zijn afzonderlijke gegevens. De applicatie kopieert geen
marktprijs, daggemiddelde of planneruitkomst naar jaarlijkse tarieven of
besparingen. Bekende prijzen voor vandaag of morgen onderbouwen geen
voorspelling voor een heel jaar. Bevestiging van het huidige contract maakt
het aparte 2027-scenario evenmin tot een contractberekening voor dat jaar.

De huidige UI bevat geen prijsforecast buiten gepubliceerde dagen, geen lokale
PV-voorspelling en geen simulatie of aansturing van een batterij. De rekenfuncties
zelf doen geen netwerkverzoeken. Herkomst, licenties, cachegedrag en uitval van
de datadiensten staan in [DATA-SOURCES.md](DATA-SOURCES.md).

## Eenheden en validatie

- Energie: kWh. Jaarverbruik is het **totale huishoudverbruik**, inclusief
  direct gebruikte zonnestroom; het is niet alleen de gemeten netafname.
- Marktprijs: EUR/MWh. Delen door 1.000 geeft EUR/kWh; delen door 10 geeft
  cent/kWh. De grafiek toont cent/kWh.
- Afname, vergoeding en variabele terugleverkosten: EUR/kWh. Negatieve
  markt-, afname- en vergoedingstarieven blijven mogelijk. `exportFee` is
  niet-negatief; de netto terugleverwaarde kan wel negatief zijn.
- `selfUsePct` en `targetPct`: percentage van **PV-opwek**, niet het percentage
  van de huishoudvraag dat met zon wordt gedekt.
- `vat`: fractie in de rekenkern, bijvoorbeeld `0.21`. Het formulier vraagt een
  percentage en zet dit om. Er is geen ingevuld belastingtarief voor 2027.
- Retourrendement: fractie groter dan nul en hoogstens één. De huidige UI laat
  waarden van 0,10 tot en met 1 toe.
- De rekenkern accepteert alleen eindige getallen, zonder impliciete conversie
  van tekst, null of booleans. De UI valideert invoer voordat zij resultaten bijwerkt.
- De rekenkern rondt geen tussenuitkomsten af. De interface rondt voor weergave.

## Dagprijzen en het bevestigde contract

### Beursprijs als vertrekpunt

Zonlio begint in de stand **Beurs**. De Energy-Charts-adapter levert gepubliceerde
Nederlandse dagmarktprijzen op hun oorspronkelijke kwartierresolutie. De hele
geselecteerde leveringsdag kan in de grafiek staan, ook de verstreken uren.
Alleen de planner beperkt zich tot toekomstige intervallen.

Uurweergave is een naar duur gewogen gemiddelde van de bronintervallen. De
uurvakken worden op UTC-tijd gevormd en in Europe/Amsterdam weergegeven; beide
voorkomens van 02:00 bij de wintertijd blijven afzonderlijke vakken. Een volledige
lokale dag bevat 92, 96 of 100 kwartieren. Het daggemiddelde beschrijft die ene
leveringsdag en is geen gemiddeld huishoudtarief.

Als prijzen nog niet gepubliceerd of niet beschikbaar zijn, toont de UI die
status. Er worden geen voorbeeldprijzen ingevuld. Na uitval kan de service
gevalideerde gegevens voor dezelfde leveringsdag teruggeven met een zichtbare
aanduiding dat het eerder opgehaalde data zijn.

### Eigen afnameprijs

Afname wordt pas getoond nadat de gebruiker de vereiste tariefonderdelen heeft
ingevuld en bevestigd dat die zelf in het contract zijn gecontroleerd. Zonlio
verifieert de inhoud van dat contract niet bij een leverancier.

Voor een dynamisch contract:

```text
importRate = (marketEurMWh / 1000 + markup + energyTax) × (1 + vat)
```

Leveranciersopslag en energiebelasting zijn in deze invoer exclusief btw. De
velden beginnen leeg; de UI veronderstelt geen actuele standaardwaarden.
Een negatieve beursprijs levert door deze componenten niet automatisch een
negatieve afnameprijs op.

Voor een vast of variabel contract voert de gebruiker één actueel afnametarief
in, inclusief toepasselijke belastingen en btw. De rekenkern gebruikt hiervoor
het type `fixed`: het tarief is binnen de berekende dag constant. Een variabel
contract wordt dus alleen voor de ingevoerde tariefperiode weergegeven.

### Terugleverwaarde

De stand Terugleveren vraagt beide exportvelden expliciet in te vullen:

```text
exportNet = exportRate − exportFee
```

Beide bedragen moeten op de toepasselijke prijsbasis staan. De huidige UI
ondersteunt één constante vergoeding en één lineaire kostenpost per kWh. Zij
leidt geen dynamische terugleverformule, btw-behandeling, wettelijk minimum of
kostenschijf af uit de beursprijs. Ontbrekende exportinstellingen worden niet
als een vastgesteld nultarief getoond.

Vaste leveringskosten, netbeheer en belastingvermindering maken geen deel uit
van de marginale prijs per kWh.

## Startwaarden van de jaar- en batterijscenario's

Deze aanpasbare waarden staan in `initialProfile` in `src/data.mjs`. Het zijn
rekenaannames om de tool te verkennen: geen vastgestelde tarieven voor 2027,
geverifieerde woninggegevens, productofferte of voorspelde opbrengst.

| Invoer | Startwaarde | Betekenis |
| --- | ---: | --- |
| Totaal jaarverbruik | 4.200 kWh | Inclusief direct gebruikte zonnestroom |
| Bruto jaaropwek zonnepanelen | 4.000 kWh | Voor direct verbruik en teruglevering |
| Direct eigen verbruik, uitgangspunt | 30% | Aandeel van de jaaropwek |
| Direct eigen verbruik, verbetering | 50% | Verkennend doel, geen bewezen haalbaar aandeel |
| Afnameprijs voor het jaar | €0,30/kWh | Inclusief toepasselijke belastingen |
| Bruto terugleververgoeding | €0,10/kWh | Op de toepasselijke prijsbasis |
| Variabele terugleverkosten | €0,05/kWh | Per teruggeleverde kWh |
| Jaarlijkse zonne-input naar batterij | 1.000 kWh | Voor opslagverlies; geen batterijcapaciteit |
| Retourrendement batterij | 90% | Aangenomen totaal laad- en ontlaadverlies |
| Investering | €5.500 | Aanschaf inclusief installatie, als aanname |
| Overige jaarlijkse batterijkosten | €35 | Aanvullende jaarlijkse kaslast |
| Vergelijkingsperiode | 15 jaar | Analyseperiode, geen gegarandeerde levensduur |

## Jaarmodel zonder salderen

Met totaal huishoudverbruik `U`, bruto PV-opwek `P` en aandeel direct eigen
verbruik `s` berekent `calculate2027`:

```text
directUse = min(U, P × s / 100)
gridImport = U − directUse
gridExport = P − directUse
netExportRate = exportRate − exportFee
annualVariableCost = gridImport × importRate − gridExport × netExportRate
```

Het plafond voorkomt meer direct eigen verbruik dan beschikbare zonnestroom of
jaarlijkse vraag. Het bewijst niet dat vraag en opwek werkelijk gelijktijdig
plaatsvinden. De UI begrenst de schuiven op het maximaal mogelijke gehele
percentage bij de ingevoerde jaarvraag en jaaropwek, en laat het verbeterde
aandeel niet onder het uitgangspunt zakken. De energiestromen en balkverdeling
volgen de werkelijk berekende hoeveelheden.

`compareSelfUse` houdt jaarvraag, jaaropwek en tarieven gelijk en wijzigt alleen
het aandeel direct eigen verbruik. De besparing is het verschil tussen de twee
variabele jaarsaldi. Dit vergelijkt twee verbruikspatronen binnen hetzelfde
scenario zonder salderen; het is geen vergelijking met de werkelijke
2026-rekening of met een salderingsberekening.

Elke extra direct gebruikte kWh vervangt één kWh netafname en verwijdert één
kWh export. De marginale waarde is `importRate − netExportRate`: met de
starttarieven €0,25/kWh. Bij andere tarieven kan meer eigen verbruik ook minder
financieel gunstig zijn; de uitkomst wordt niet op positieve besparingen afgekapt.

### Controlevoorbeeld met de daadwerkelijke startwaarden

| Uitkomst | Uitgangspunt: 30% | Verbeterd scenario: 50% |
| --- | ---: | ---: |
| Direct gebruikte zonnestroom | 1.200 kWh | 2.000 kWh |
| Netafname | 3.000 kWh | 2.200 kWh |
| Teruglevering | 2.800 kWh | 2.000 kWh |
| Variabel jaarsaldo | €760 | €560 |

Het verschil is **€200 per jaar**. Een handmatig gekozen alternatief van 70%
geeft €360 variabel jaarsaldo, dus €400 verschil met 30%. Dat is geen
standaardinstelling en geen bewijs dat 70% direct eigen verbruik haalbaar is.

Het model gebruikt één constante effectieve prijs per energiestroom en lineaire
terugleverkosten. Staffelgrenzen, vaste kosten, contractwijzigingen,
belastingvermindering en investeringen ontbreken. Een werkelijke dynamische
jaarrekening vraagt verbruik, opwek en contractvoorwaarden per interval; een
gemiddelde beursprijs alleen volstaat niet. Een negatief jaarsaldo blijft negatief.
De uitkomst heet **variabel jaarsaldo**, geen volledige jaarrekening.

## Batterij: extra voordeel boven op slimmer verbruiken

De UI roept `batteryScenario` aan met het **verbeterde** aandeel `targetPct`,
niet met het oorspronkelijke aandeel `selfUsePct`. Het gekozen extra directe
eigen verbruik is dus al verwerkt voordat opslag wordt toegevoegd. De UI geeft
het jaarverbruik altijd mee.

`extraSolarStored` is jaarlijkse zonnestroom naar de batterij, vóór verliezen:

```text
directUse = min(annualUse, annualSolar × targetPct / 100)
remainingImport = annualUse − directUse
availableSolar = annualSolar − directUse
solarStored = min(extraSolarStored, availableSolar, remainingImport / roundTripEfficiency)
usefulOutput = min(solarStored × roundTripEfficiency, remainingImport)
annualGrossBenefit = usefulOutput × importRate − solarStored × netExportRate
annualNetBenefit = annualGrossBenefit − annualCosts
simplePayback = investment / annualNetBenefit  (alleen bij positief nettovoordeel)
breakEvenCost = max(0, annualNetBenefit × lifeYears)
```

Misgelopen netto export telt over **alle** zonnestroom die de batterij ingaat,
inclusief het deel dat verloren gaat. Het retourrendement wordt éénmaal toegepast.
Bij negatieve netto terugleverwaarde kan vermeden export ook voordeel opleveren;
de formule behoudt dat teken.

De retourwaarden `requestedSolarStored`, `solarStored` en `capped` maken een
begrenzing inzichtelijk. De UI meldt het wanneer gevraagde opslag groter is dan
de jaaropwek of resterende vraag toelaat. Deze jaarlijkse grenzen bewijzen niet
dat laden en ontladen op de benodigde momenten mogelijk zijn.

### Kosten éénmaal tellen

De derde kolom in de batterijvergelijking volgt:

```text
jaarsaldo met slimmer verbruiken en batterij
  = optimized.annualVariableCost − annualNetBenefit
```

Overige batterijkosten zitten al in `annualNetBenefit` en worden niet nogmaals
opgeteld. De investering zit niet in dit jaarlijkse saldo; zij wordt apart
gebruikt voor de eenvoudige terugverdientijd. Neem dezelfde investering niet
tevens als afschrijving op onder `annualCosts` wanneer het doel deze eenvoudige
kasstroomvergelijking is.

Met de startwaarden en 50% direct eigen verbruik:

- 1.000 kWh zonne-input levert 900 kWh nuttige batterij-uitvoer.
- Vermeden afname is 900 × €0,30 = €270.
- Misgelopen netto export is 1.000 × €0,05 = €50.
- Bruto voordeel is €220; na €35 overige kosten resteert **€185 per jaar**.
- De vergelijking wordt **€760 → €560 → €375 per jaar**. De laatste waarde
  omvat overige batterijkosten en sluit de aanschaf uit.
- €5.500 / €185 geeft ongeveer 29,7 jaar eenvoudige terugverdientijd. De UI
  toont dat dit niet binnen de gekozen 15 jaar valt.
- De ongedisconteerde kasstroom over 15 jaar dekt hoogstens €2.775
  begininvestering: helperuitkomst `breakEvenCost`, geen offerteprijs.

`simplePayback` is `null` zonder positief jaarlijks nettovoordeel. Een positieve
terugverdientijd buiten de analyseperiode blijft in de rekenkern numeriek
beschikbaar; `paybackWithinLife` is dan false. Elk jaar hetzelfde voordeel
veronderstellen is een aanname; er wordt niet gedisconteerd.

Dit jaarlijkse scenario kiest geen batterijcapaciteit, laadvermogen of product
en modelleert geen laadregeling, cycli, reserve, seizoensverdeling, netaansluiting
of beschikbaarheid per interval. Degradatie, vervanging, financiering, restwaarde
en prijsverandering ontbreken. Er zijn geen inkomsten uit netladen, arbitrage
of onbalanshandel. De aangenomen jaarlijkse opslag van 1.000 kWh is niet als
haalbaar gevalideerd.

## Apparatenplanner in de huidige interface

De planner gebruikt oorspronkelijke prijsintervallen, ook wanneer de grafiek
op uurweergave staat. `futurePriceSlots` beperkt de invoer tot de geselecteerde
Nederlandse leveringsdag en intervallen die op het moment van berekenen nog niet
zijn begonnen. Een begonnen kwartier wordt niet gedeeltelijk gebruikt. De
vergelijking gebeurt op tijdstempels, zodat beide voorkomens van 02:00 op een
wintertijdwisseldag niet worden verward. Een verstreken leveringsdag geeft geen plan.

Morgen kan alleen worden gepland wanneer echte prijzen zijn gepubliceerd.
Ontbrekende of niet-aaneengesloten data, te weinig resterende intervallen of een
te kort gebruikersvenster leveren geen verzonnen plan op. Gevalideerde prijzen
voor dezelfde dag uit de cache kunnen met de bijbehorende waarschuwing worden gebruikt.

De apparaatkeuzes bevatten aannames uit `src/data.mjs`:

| Apparaatkeuze | Duur | Energie per cyclus |
| --- | ---: | ---: |
| Vaatwasser | 2 uur | 1,1 kWh |
| Wasmachine | 2 uur | 0,8 kWh |
| Elektrische auto | 3 uur | 10 kWh |

Dit zijn voorbeeldprofielen, geen gemeten verbruiken van het apparaat van de
gebruiker. `findBestWindow` verdeelt energie gelijkmatig over één ononderbroken
blok: constant vermogen `energyKwh / durationHours`. Een werkelijk programma
met pieken, pauzes of wisselend laadvermogen vraagt een apart profiel.

Begin- en einduur gelden in Europe/Amsterdam binnen één lokale kalenderdag;
24:00 is het einde van die dag. Een programma over middernacht wordt niet gepland.
De duur volgt verstreken tijd, ook op dagen met 92 of 100 kwartieren. De standaard
in de planner is 08:00–22:00.

De huidige UI gebruikt uitsluitend `goal: 'cost'` en geeft `solarKwh: 0` mee.
Zij zoekt een goedkoop prijsblok, zonder lokale zonneopbrengst te veronderstellen.
Bij gelijke kosten wint het vroegste passende blok.

- Zonder bevestigd contract zijn het **alleen beurskosten**; leverancierskosten
  en belastingen ontbreken.
- Met een bevestigd dynamisch contract worden eigen opslag, belasting en btw gebruikt.
- Met een vast of variabel tarief zijn alle passende blokken even duur. De UI
  kiest het eerste passende blok en claimt hiervoor geen prijsvoordeel.

De uitkomst is uitsluitend de berekende netafnamekost van het aangenomen
apparaatprofiel. Eigen zonneopwek, ander huishoudverbruik, misgelopen export,
vermeden terugleverkosten en apparaataansturing ontbreken. Negatieve kosten
blijven mogelijk. Het blok garandeert geen laagste totale huishoudkosten of
werkelijke besparing. Een dagplan helpt de gebruiker zelf een timer in te stellen;
het schakelt geen apparaat.

## Weercontext en mogelijkheden van de losse rekenkern

De weerkaart toont een regionale verwachting met een expliciete tijd. Bewolking
wordt niet omgerekend naar zonne-energie, batterijopbrengst of besparing. De
huidige interface heeft geen zonplanner.

De losse module `src/domain.mjs` heeft daarnaast mogelijkheden die geen actieve
UI-functionaliteit zijn:

- `findBestWindow` accepteert `solarKwh` per interval: zonne-overschot **na**
  andere huishoudvraag, niet bruto PV-productie. De helper benut hoogstens de
  apparaatvraag in hetzelfde interval. `goal: 'solar'` maximaliseert zonnedekking
  en gebruikt lagere afnamekosten als tweede criterium; `goal: 'cost'` keert die
  volgorde om. Geen van beide doelen waardeert gemiste export of optimaliseert
  de keuze tussen afname en teruglevering.
- `batteryScenario` kan zonder `annualUse` worden aangeroepen. Dan ontbreekt het
  vraagplafond en geldt alleen het plafond van beschikbare zonne-export. Dat is
  een expliciet rekenvoorbeeld met onbeperkt veronderstelde vraag, geen UI-pad.
- `compareSelfUse` accepteert ook een lager doelpercentage en kan een negatieve
  besparing opleveren. De UI beperkt het doel tot het huidige aandeel of hoger.
- `priceForContract` neemt ontbrekende opslag, belasting en btw in de pure functie
  als nul. De UI vereist deze velden voordat zij een persoonlijke afnameprijs toont.
  Interne nulwaarden voor nog niet ingestelde export ontsluiten Terugleveren niet.

`findBestWindow` vereist minstens twee strikt toenemende intervalstarts met
expliciete tijdzone. De reeks moet gelijkmatig en compleet zijn; de laatste
intervalduur wordt uit de andere starts afgeleid. Gaten, duplicaten, gemengde
resoluties en programma's met een fractie van een interval worden geweigerd. De
bronadapter controleert oorspronkelijke resolutie en volledigheid; een uniform
uitgedunde reeks is uit alleen starts niet te herkennen. Nul energie of geen
passend blok geeft `null`.

De planner retourneert `start`, `end`, `durationHours`, `energyKwh`, `solarKwh`,
`gridKwh`, `gridCost`, `cost`, `averagePrice`, `slotCount`, `intervalMinutes` en
`goal`. `cost` en `gridCost` zijn identiek. `averagePrice` is de tijdgemiddelde
invoerprijs, zonder financiële waardering van eigen zon. `start` behoudt de
invoernotatie; `end` is UTC-ISO. De UI geeft beide in Europe/Amsterdam weer.

## Verificatie en onderhoud

`node --test tests/domain.test.mjs` controleert de rekenkern met handmatig
berekende voorbeelden, jaarlijkse bovengrenzen, nul- en negatieve prijzen,
ongeldige invoer, zonne-overschot per interval en Nederlandse klokwisselingen.
API- en adaptertests controleren daarnaast prijsverwerking, toekomstige
intervallen en datakwaliteit; de totale suite draait via `npm test`. Tests
bewijzen de praktische haalbaarheid van een gekozen aandeel eigen verbruik
of batterijopbrengst niet.

De bedragen hierboven zijn rechtstreeks nagerekend met de huidige
`initialProfile`, `compareSelfUse` en `batteryScenario`. Bij wijzigingen in
startwaarden, contractinvoer, plannerprofielen of UI-koppelingen moet deze
beschrijving opnieuw worden vergeleken met de broncode.
