# Databronnen en adapterafspraken

Gecontroleerd op **14 november 2026**. Dit document gaat over de prijs- en
weerkoppelingen; het is geen verklaring dat de volledige website al in productie
is getest. De servermodules bevatten geen demonstratieprijzen of verzonnen
voorspellingen als terugvaloptie.

De 19 gerichte adaptertests slagen. Een live aanroep via de servicemethode gaf
voor 14 november 2026 `available` met 96 prijsintervallen; MET Norway gaf voor
Leiden `available` met 90 forecasttijdstappen. Een eerdere prijsaanroep gaf een
netwerkfout en werd correct als `unavailable` weergegeven. Dit is een beperkte
koppelingstest, geen duurtest of garantie voor toekomstige beschikbaarheid.
De upstreamdeadline is 15 seconden.

## Nederlandse beursprijzen: Energy-Charts

De server vraagt één Nederlandse leveringsdag op via:

```text
GET https://api.energy-charts.info/v2/price?bzn=NL&start=YYYY-MM-DD&end=YYYY-MM-DD
```

De publieke proef voor **13 november 2026** gaf HTTP 200 en 96 kwartieren:
00:00 tot en met 23:45 in Europe/Amsterdam. De response vermeldde `PT15M`,
`interval_minutes: 15`, `EUR / MWh` en deze licentie:

```text
CC BY 4.0 (creativecommons.org/licenses/by/4.0) from Bundesnetzagentur | SMARD.de
```

De adapter controleert de zone, eenheid, licentie, timestamps en volledige
leveringsdag. Een ontbrekende waarde wordt nooit nul. Nul en negatieve prijzen
blijven geldig. Het resultaat gebruikt UTC-starttijden en expliciete
intervalduren; een Nederlandse klokwisseldag bevat 92 of 100 kwartieren.

`marketEurMWh` is de beursprijs. Delen door 1000 levert EUR/kWh. Belastingen,
leveranciersopslagen en teruglevervoorwaarden worden afzonderlijk toegepast.
`publishedAt` blijft `null`: `generated_at` bewijst alleen wanneer de API-response
is samengesteld, niet wanneer de veilingprijs is gepubliceerd. `fetchedAt`
registreert wanneer Zonlio een geldige response ontving.

De officiële limiet voor `/price` is twee verzoeken per minuut per IP en
endpoint, met een burst van twee; v2 erft die limiet. De leverancier kan de
effectieve limiet verlagen. Zonlio combineert gelijktijdige verzoeken, begrenst
verzoeken over alle datums samen en respecteert `Retry-After`.

Bronnen:

- [Officiële Energy-Charts OpenAPI](https://api.energy-charts.info/openapi.json)
- [Een dag NL-prijzen](https://api.energy-charts.info/v2/price?bzn=NL&start=2026-11-13&end=2026-11-13)
- [SMARD-gebruiksrechten](https://www.smard.de/en/datennutzung)
- [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

### Rechten en bronvermelding

NL is in de Energy-Charts-documentatie aangewezen als SMARD-data onder CC BY 4.0.
Toon Energy-Charts/Fraunhofer ISE en **Bundesnetzagentur | SMARD.de**, met links en
de licentie. Benoem de eigen omrekening wanneer consumentenprijzen worden
berekend. De adapter weigert een response waarvan de licentie afwijkt van de
bevestigde Nederlandse licentietekst.

SMARD vermeldt tevens een lopend onderzoek naar licentievraagstukken rond
groothandelsprijzen in de HEDWIG-procedure. Dit vereist periodieke controle van
de bronvoorwaarden. De huidige vermelding is geen garantie voor toekomstige
beschikbaarheid of ongewijzigde voorwaarden. Rechtstreekse EPEX- of Nord
Pool-data voor openbare websites vraagt een passende externe gebruikslicentie;
een intern data-abonnement is daarvoor niet voldoende.

- [EPEX: intern gebruik tegenover externe publicatie](https://webshop.eex-group.com/offerdescription_epex_spot_MD_ISVs)
- [Nord Pool: redistributielicenties](https://www.nordpoolgroup.com/en/services/power-market-data-services/faq/faq-premium-container/what-kind-of-redistribution-licences-do-you-have/)

### Cache en uitval

- Toegestane datums: vanaf 30 kalenderdagen geleden tot en met morgen, bepaald
  in Europe/Amsterdam. Ongeldige invoer geeft een `TypeError` of `RangeError`.
- Volledige prijzen voor vandaag/morgen worden 15 minuten als vers behandeld;
  eerdere leveringsdagen zes uur. Een 404 voor morgen geeft `not_published`;
  een ontbrekende huidige/historische dag geeft `unavailable`.
- Als een hercontrole mislukt, kan alleen de eerder gevalideerde **zelfde
  leveringsdag** worden teruggegeven, met `stale: true` en de oorspronkelijke
  ophaaltijd. Zonder zo'n cache blijft de lijst leeg. Er volgt geen schatting.
- Cache, singleflight en limiter zijn per service-instantie en proces. Maak één
  service aan bij serverstart. Bij herstart is de cache leeg. Meerdere replicas
  achter hetzelfde IP vereisen een gedeelde cache/limiter voordat wordt opgeschaald.
- De healthmetadata bevat vaste foutcodes en tijden, geen ruwe upstream-body of
  credentials. Dit is geen beschikbaarheidsgarantie van de databron.

## Regionale weersverwachting: MET Norway

De publieke Locationforecast 2.0 API levert voorspelde temperatuur, bewolking en
neerslag. De server gebruikt uitsluitend een vaste lijst Nederlandse stadsregio's,
waaronder Leiden, met coördinaten op twee decimalen:

```text
GET https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=52.16&lon=4.49
```

Er is geen API-sleutel nodig. MET Norway staat commercieel gebruik toe onder
CC BY 4.0/NLOD 2.0. Bronvermelding en een herkenbare applicatie-identificatie met
bereikbare contactinformatie zijn vereist. De standaardheader is:

```text
User-Agent: Zonlio/1.0 info@zonlio.nl
```

Het contactadres is door de eigenaar als zakelijk contact bevestigd. Houd dit
adres bereikbaar. Stel `MET_USER_AGENT` in wanneer de applicatie-identificatie
of het contactadres verandert. Een contact-URL met bereikbare contactinformatie
is ook toegestaan. De optie `userAgent` kan de header expliciet overschrijven.

Toon **MET Norway**, de licentielink en dat Zonlio een selectie weergeeft. De
regionale verwachting is geen waarneming en geen exacte voorspelling op het dak.
De JSON gebruikt `properties.meta.updated_at`, `properties.meta.units` en
`properties.timeseries`. Temperatuur en bewolking zijn momentwaarden;
`next_1_hours` bevat de neerslag voor het volgende uur. Een `next_6_hours`-totaal
wordt nooit als één uur neerslag weergegeven. De tijdstappen worden op hun eigen
timestamps behouden; verder vooruit kunnen ze zes uur uiteen liggen.

De adapter wacht voor dezelfde locatie minstens drie uur en nooit korter dan
`Expires`. Bij hercontrole gebruikt hij het exacte `Last-Modified` als
`If-Modified-Since`. Bij uitval wordt een bestaande verwachting hoogstens tot
24 uur na de modelupdate getoond, expliciet als verouderd. Ontbrekende gegevens
blijven ontbreken. MET Norway biedt geen SLA.

De dienst wordt vanuit de server benaderd. Er gaat geen adres of browser-IP mee;
alleen de vooraf gekozen stadscoördinaten. De algemene providergrens is twintig
verzoeken per seconde over de volledige applicatie. Houd die grens ook bij
eventuele toekomstige uitbreiding en meerdere servers in stand.

Bronnen:

- [MET Norway Locationforecast-documentatie](https://api.met.no/weatherapi/locationforecast/2.0/documentation)
- [Datamodel en tijdstappen](https://docs.api.met.no/doc/locationforecast/datamodel.html)
- [JSON-formaat](https://api.met.no/doc/ForecastJSON)
- [Servicevoorwaarden, versie 5 november 2026](https://api.met.no/doc/TermsOfService)
- [Licentie en bronvermelding](https://api.met.no/doc/License)
- [FAQ: commercieel gebruik en zonne-energiedata](https://api.met.no/doc/FAQ)

### Geen PV-opwek uit bewolking afleiden

Locationforecast bevat geen inkomende zonnestraling voor een PV-berekening.
Bewolkingspercentage of een weersymbool wordt daarom niet omgerekend naar
`solarKwh`, batterijopbrengst of gegarandeerde besparing. Voor een latere lokale
PV-module zijn straling, dakrichting, helling, vermogen, verliezen en validatie
nodig. PVGIS is bruikbaar voor historische opbrengstscenario's en
langetermijnreferenties. Het is geen weerverwachting voor morgen.

Open-Meteo kan later stralingsverwachtingen leveren. Voor een commerciële Zonlio
is een passend betaald abonnement nodig; het gratis gehoste aanbod is daarvoor
niet toegestaan.

- [PVGIS: historische datasets en gebruik](https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis_en)
- [Open-Meteo: commerciële licentie](https://open-meteo.com/en/pricing)
- [Open-Meteo: gebruiksvoorwaarden](https://open-meteo.com/en/terms)

## NED.nl: aanvullende energiecontext

De gedocumenteerde NED-API levert opwek, verbruik, energiemix en emissies. De
publieke datacatalogus bevat geen day-aheadprijsdatatype. De NED-website toont
wel externe ENTSO-E-prijzen; dat maakt een NED-account niet tot een prijsfeed.

Het endpoint `https://api.ned.nl/v1/utilizations` gebruikt `X-AUTH-TOKEN`.
Voorbeelden zijn Solar (`type=2`), Wind (`type=1`), WindOffshoreC (`type=51`)
en Electricityload (`type=59`). `capacity` is kW en `volume` is kWh, geen europrijs.
De huidige voorwaarden van 31 augustus 2026 bevatten beperkingen op verspreiding
aan derden. Een eventuele NED-integratie voor publiek Zonlio-gebruik vraagt
daarom bevestiging van het beoogde gebruik en de juiste bronvermelding. Er is
geen NED-sleutel ingelezen en deze bron is niet actief in de adapters.

- [NED API-handleiding](https://ned.nl/nl/handleiding-api)
- [NED datacatalogus](https://ned.nl/nl/datacatalogus)
- [NED definities](https://ned.nl/nl/definities)
- [NED voorwaarden](https://ned.nl/nl/algemene-voorwaarden)
