# E6 — publieke mail-DNS en daadwerkelijk ontvangen authenticatie

**Stand:** 14 november 2026, publieke DNS-waarneming om **21:49:28 UTC**. **Vrijgavestatus:** publieke records daadwerkelijk waargenomen; nog geen volledige e-mailauthenticatie- of afleverbevestiging. De eerder door de eigenaar ontvangen losse SMTP-testmail blijft apart bewijs; deze controle verstuurt niets.

## Wat de repository nu controleert

`node scripts/mail-dns.mjs` doet uitsluitend publieke DNS-opvragingen voor `zonlio.nl`: MX, SPF-TXT, DMARC-TXT en de drie door Hostinger gedocumenteerde standaard-DKIM-selectors. Als een selector naar zijn gedocumenteerde Hostinger-doel verwijst, wordt daar de aanwezigheid van de gepubliceerde sleutel bekeken. Het script leest geen mailbox, secreten of productiegegevens en wijzigt geen DNS.

De output bevat beperkte publieke instellingen en vaste statuscodes. Overige TXT-verificatiewaarden, DMARC-rapportmailadressen en volledige DKIM-sleutels worden niet afgedrukt. Het script gebruikt de resolver van zijn uitvoeromgeving, met begrensde pogingen. Het zet geen alternatieve DNS-server en probeert netwerkbeperkingen niet te omzeilen.

`lookup_failed` betekent dat vanuit deze resolver geen uitspraak mogelijk is. `not_found` betekent een ontvangen negatief DNS-antwoord of geen passend record in de ontvangen gegevens. `defaultHostingerRecordsObserved:true` betekent alleen dat de verwachte standaardonderdelen werden aangetroffen. Het is geen volledige SPF-evaluatie, cryptografische berichtcontrole of bewijs van inboxbezorging.

## Officiële referentiewaarden

De actuele [Hostinger-instructie voor handmatige mail-DNS](https://www.hostinger.com/support/8671319-set-up-a-domain-for-hostinger-email-manually/) vermeldt de volgende standaardonderdelen. Dit is een vergelijking, geen opdracht om bestaande records te vervangen.

| Record | Naam | Gedocumenteerde waarde |
| --- | --- | --- |
| MX | `zonlio.nl` | prioriteit 5: `mx1.hostinger.com` |
| MX | `zonlio.nl` | prioriteit 10: `mx2.hostinger.com` |
| SPF | `zonlio.nl` | één SPF-record met `include:_spf.mail.hostinger.com`; de Hostinger-standaard eindigt op `~all` |
| DMARC | `_dmarc.zonlio.nl` | één DMARC-record; de gepubliceerde Hostinger-voorbeeldinstelling gebruikt `p=none` |

Hostinger documenteert deze [standaard-DKIM-selectors](https://www.hostinger.com/support/4456413-what-are-the-dkim-records-for-hostinger-email/):

| Selector onder `_domainkey.zonlio.nl` | Verwacht CNAME-doel |
| --- | --- |
| `hostingermail-a` | `hostingermail-a.dkim.mail.hostinger.com` |
| `hostingermail-b` | `hostingermail-b.dkim.mail.hostinger.com` |
| `hostingermail-c` | `hostingermail-c.dkim.mail.hostinger.com` |

Een bewust ingestelde [custom DKIM-selector](https://www.hostinger.com/support/6780535-how-to-add-a-custom-dkim-record-for-hostinger-email/) kan daarnaast bestaan. De checker doorzoekt geen geraden selectors. Ontbrekende standaardrecords betekenen daarom niet automatisch dat een werkelijk verzonden bericht geen geldige handtekening heeft. De daadwerkelijk ontvangen `DKIM-Signature` bepaalt welke selector relevant is.

`p=none` is een waargenomen DMARC-beleidskeuze voor monitoring, geen bewijs dat berichtauthenticatie slaagt. Verander beleid of bestaande SPF/DKIM-records niet blind: andere legitieme verzenders kunnen daarvan afhankelijk zijn.

## GitHub-observatie

De bestaande workflow **Observe public Zonlio deployment** voert na de publieke smokecontrole een aparte informatieve DNS-stap uit. Het rapport staat als `mail-dns.json` naast `observation.json` in het bestaande artifact. De stap heeft geen credentials en is **niet** de vrijgavepoort voor commerciële mail. Het verzamelen van een rapport, ook met mislukte lookups, wordt niet als een geslaagde authenticatiecontrole aangeduid.

| Bewijs | Uitkomst |
| --- | --- |
| Vier lokale fixturetests | Geslaagd: TXT-segmenten, ontdubbeling/ongeldige beleidstags, veilige output, DNS-foutclassificatie, onverwachte CNAME niet volgen en lege DKIM-sleutel |
| Werkelijke lookup vanuit ontwikkelomgeving, 14 november 21:24 UTC | Alle zes eerste queries: `ECONNREFUSED`. Geen inhoudelijk oordeel over Zonlio-DNS mogelijk. Geen records gewijzigd. |
| Werkelijke GitHub Actions DNS-observatie van nieuwe release | [Run 43644817235](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43644817235), poging 1, `2026-11-14T21:49:28.052Z`: nul lookupfouten; MX/SPF/DMARC en drie DKIM-CNAMEs waargenomen. Bij selector `hostingermail-a` een gepubliceerde RSA-sleutel; `hostingermail-b` en `hostingermail-c` hebben checkerstatus `empty_or_unusable_key`. Zie de uitsplitsing hieronder. |
| Authenticatie op ontvangen account-/aanvraag-/dagmail | Nog vereist |

### Werkelijke publieke records op 14 november 2026

Het rapport `mail-dns.json` is gelezen in de [joblog van de publieke observatie](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43644817235/job/132600116256). De workflow draaide tegen `main`-commit **`2b0ddbfd5e92bc55c78b29ed196874f8a7881757`**, na de geslaagde [application-run 43644743932](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43644743932), en eindigde succesvol om 21:49:33 UTC. De DNS-stap is informatief: workflow-succes betekent hier niet dat alle DNS-onderdelen een bruikbare sleutel hadden of dat een mail is geauthenticeerd.

| Onderdeel | Waargenomen uitkomst uit de publieke resolver |
| --- | --- |
| MX voor `zonlio.nl` | `mx1.hostinger.com` met prioriteit **5**; `mx2.hostinger.com` met prioriteit **10**. |
| SPF voor `zonlio.nl` | **Eén** SPF-record; directe `include:_spf.mail.hostinger.com` aangetroffen; `allPolicy: "~all"`; geen `redirect` aangetroffen; geen onbeperkte `+all`. Dit zijn geprojecteerde velden, geen volledige SPF-evaluatie. |
| DMARC voor `_dmarc.zonlio.nl` | **Eén** record met `p=none`; de parser rapporteert percentage **100** en relaxed alignment (`r`) voor DKIM en SPF. Deze velden kunnen hun standaardwaarde hebben wanneer de betreffende optionele tag ontbreekt. Geen dubbele tags; geen aggregate-/failure-rapportontvanger geconfigureerd volgens de waargenomen velden. |
| DKIM `hostingermail-a._domainkey.zonlio.nl` | CNAME naar `hostingermail-a.dkim.mail.hostinger.com`; sleutelstatus `observed`, `keyPublished:true`, type `rsa`. Geen berichtsignatuur gecontroleerd. |
| DKIM `hostingermail-b._domainkey.zonlio.nl` | CNAME naar `hostingermail-b.dkim.mail.hostinger.com`; sleutelstatus `empty_or_unusable_key`, `keyPublished:false`. |
| DKIM `hostingermail-c._domainkey.zonlio.nl` | CNAME naar `hostingermail-c.dkim.mail.hostinger.com`; sleutelstatus `empty_or_unusable_key`, `keyPublished:false`. |
| Resolver-/totaalstatus | `lookupFailures:0`; `defaultHostingerRecordsObserved:false`, omdat niet bij alle drie verwachte selectors een volgens de checker bruikbare sleutel werd gevonden. |

De status voor selectors `b` en `c` betekent dat de beperkte parser bij het ontvangen TXT-antwoord geen bruikbare gepubliceerde sleutel vaststelde. Het rapport bevat geen volledige sleutel of ruwe TXT-records en maakt binnen die status geen onderscheid tussen een lege sleutel en andere onbruikbare sleutelinhoud. De daadwerkelijk gebruikte selector van Zonlio-mail is nog niet uit ontvangen headers vastgesteld. Daarom bewijst deze uitslag **niet** dat de actieve ondertekening van een verzonden Zonlio-bericht faalt. Bestaande CNAMEs of providerdoelen zijn niet gewijzigd; gebruik de ontvangen `s=`-selector en bijbehorend authenticatieresultaat voor de vervolgstap.

De geschoonde bestanden `mail-dns.json` en `observation.json` staan samen in [artifact `zonlio-public-observation-43644817235-1`](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43644817235/artifacts/14133468286). Artifact-ID: `14133468286`; aangemaakte ZIP SHA-256: `a424af3f57509214100d5a4a63dea9a8938868026db3bd7370f9be1ddc5c12a4`. GitHub meldt vervaldatum **17 november 2026, 21:49:28 UTC**; bovenstaande beperkte resultaten blijven daarom ook in dit projectdocument vastgelegd.

### Tegelijk waargenomen publieke release en gates

De openbare GET-smoke in dezelfde run rapporteert op **`2026-11-14T21:49:27.916Z`** release **`autonomy-ready-04-20261114`**, gelijk aan de verwachte release. Alle 21 bevraagde openbare/beschermde routes gaven de verwachte status; beschermde account-, beheer- en privacy-API's gaven zonder sessie `401`. `databaseReady`, `adminConfigured`, `mailConfigured` en de drie operatorcontrolevelden waren `true`. Dit is publiek configuratie-/bereikbaarheidsbewijs, geen werkende SMTP-afleverproef of geautoriseerde beheersessietest.

De geobserveerde gates `leadEnabled`, `housingAdviceEnabled`, `accountsEnabled`, `subscriptionsEnabled`, `dailySendEnabled` en `portalExportEnabled` waren alle **`false`**. De controle heeft geen publieke dienst ingeschakeld. `productionEndToEndVerified`, `authenticationResultsVerified`, `receivedDkimSignatureVerified`, `unsubscribeHeadersVerified` en `inboxDeliveryVerified` blijven in de rapporten **`false`**: dit bewijs is niet geleverd door deze uitsluitend lezende observatie.

## Wat nog nodig is uit een echt ontvangen bericht

Open bij de reeds toegestane eigenaarstest de berichtdetails van een werkelijk ontvangen account- of aanvraagbevestiging. Controleer de door de ontvangende mailbox toegevoegde `Authentication-Results`: SPF, DKIM en DMARC en de bijbehorende domeinen. Controleer ook de echte `DKIM-Signature` met ondertekenend domein `d=` en selector `s=`. Een publiceerbaar bewijs bevat uitsluitend resultaatcodes, publieke domeinen, selectornamen, berichtsoort en tijd; geen ontvangers, ruwe berichtbron, tracking-ID’s, volledige headers of inlog-/afmeldlinks.

Voor een werkelijk ontvangen dagmail moet bovendien blijken dat `List-Unsubscribe` en `List-Unsubscribe-Post` aanwezig zijn en door een geldige DKIM-handtekening worden gedekt. RFC 8058 vereist deze dekking in de `h=`-lijst; het bestaan van de headers in Zonlio-code of het bestaan van een DKIM-record bewijst dat niet. Leg alleen vast: headers aanwezig ja/nee, DKIM-dekking ja/nee, ontvangen authenticatieresultaat en gecontroleerde afmeldactie gelukt/mislukt.

Pas na deze controle, de andere P0-/dagmailtests en expliciete eigenaar-GO kan E6 samen met de betreffende dienst worden afgetekend. Geen publieke account-/lead-/dagmailflag wordt door het DNS-script of de observatieworkflow ingeschakeld.

## Technische primaire bronnen

- [Node.js 24 DNS API](https://nodejs.org/docs/latest-v24.x/api/dns.html): resolver, TXT-segmenten en foutcodes.
- [RFC 8601 — Authentication-Results](https://www.rfc-editor.org/rfc/rfc8601.html): ontvangen authenticatieresultaten.
- [RFC 7489 — DMARC](https://www.rfc-editor.org/rfc/rfc7489.html): domeinafstemming en beleid.
- [RFC 8058, secties 3.1 en 4](https://www.rfc-editor.org/rfc/rfc8058.html): eenklik-afmeldheaders en DKIM-dekking.

Deze bronnen zijn op 14 november 2026 geraadpleegd. Hostinger-recordverwachtingen komen uit de providerdocumentatie; het script doet geen zelfstandig bewijs van het actieve Hostinger-account of het gebruikte ondertekeningsbeleid.
