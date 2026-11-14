# Zonlio 2.0 — Masterchecklist naar zelfstandig bedrijfsklaar product

**Statusdatum:** 14 november 2026 · **Scope:** zelfstandig bruikbaar consumentenplatform + vrijwillige NIVO-leadgenerator, onafhankelijk van NIVO Portal · **Geen kalenderplanning.**

## Leeswijzer en bron van waarheid

Deze checklist is de **actuele, normatieve vervolgoverdracht**. De oudere pilot- en testrelease-documenten zijn historisch bewijs. Controleer bij hervatten altijd opnieuw GitHub `main`, live `/api/health` en `/api/config`, de huidige issues en de effectieve flags. Er zijn nog geen nieuwe productieflags aangezet door deze documentatieronde.

**Definitie van bedrijfsklaar:** bezoekers krijgen een eerlijke gratis tool, kunnen vrijwillig een persoonlijk account/dagplan gebruiken of een NIVO-woningadvies aanvragen; relevante data, bevestigingen en opvolgtaken worden veilig opgeslagen en verwerkt zonder handmatige technische tussenkomst of draaiende Mac; NIVO kan aanvragen zelfstandig opvolgen via Zonlio; fouten, quota, intrekkingen en herstel zijn beheersbaar. Een menselijke salesopvolging door Pim blijft nodig. De toekomstige Portal-ontvanger is **geen** blokkerende afhankelijkheid.

De masterstatus is altijd **bewijsafhankelijk**: niet `[x]` zetten op grond van alleen bouw/CI/health als een live E2E- of restoreproef nodig is. Verdeel bewijs expliciet in repository, CI, lokale simulatie, productieobservatie en eigenaargetuigenis.

## 0. Feitelijk bereikt, niet opnieuw als open punt behandelen

- [x] Live Hostinger Node.js 24/Express-app, `main`, MySQL en afgeschermd beheer ingericht. Apprelease ten minste `test-ready-03-20261114` extern via twaalf read-only checks bevestigd.
- [x] Premium lichte Zonlio-branding en het centrale `src/design-system.css`; designissue #4 gesloten na eigenaarreview.
- [x] Nederlandse gepubliceerde kwartierprijzen, apparaatplanner, 2027-zonnescenario, indicatief batterijjaarplan en regionale weercontext zijn geïmplementeerd; aannames en grenzen blijven zichtbaar.
- [x] Drie-staps woningadvies met NAW/telefoon, contactbewijs, veilige MySQL-opslag, idempotentie, status/revisie en intrekking zijn **gebouwd en CI-getest**; nog niet publiek E2E bewezen of geactiveerd.
- [x] `/mijn` account/profiel/export/verwijdering, magic link, double opt-in, ochtend-/avonddagplan, abonnementsvoorkeuren en afmelden zijn **gebouwd en CI-getest**; nog niet publiek E2E bewezen of geactiveerd.
- [x] E-mailoutbox, gedeeld rollend budget, retries, cron-code en Portal claim/ack **aan Zonlio-zijde** zijn gebouwd en deels getest.
- [x] Exploitant: **NIVO Groep Holland BV**, KvK 95227768, Lireweg 52, 2153 PH Nieuw-Vennep; `info@zonlio.nl` is het publieke contact. Actuele bedrijfsnaam/contact in runtime door eigenaar correct gemeld; externe observatie gaf beide passend.
- [x] Route vast: **Zonlio → NIVO Portal → bestaande Odoo-connect → Odoo**, Pim opvolger. Geen directe Odoo-route in Zonlio.
- [x] Hostinger mailboxquotum **100 uitgaande mails per rollende 24 uur** uit eigenaarscreenshot. Het appbudget is volgens eigenaar/privé readiness `Correct`; publiek is het exacte ingestelde getal niet uitgelezen. Voorstel uit eerder gesprek: appbudget 50, maximaal circa 40 dagplannen, inclusief ruimte voor andere e-mail.
- [x] **Echte losse SMTP-testmail** door eigenaar ontvangen en geopend in Apple Mail (code `F9A4DB4C`). Dit bevestigt feitelijke ontvangst voor die handmatige test, **niet** automatisch de lead-/account-/dagmailketen of SPF/DKIM/DMARC.
- [x] CI op `42e544f53d9138c51d09f53b9937a1a157927797` en publieke smokecontrole geslaagd op 14 november. Als `main` verandert, altijd nieuw bewijs verzamelen.

**Laatst bevestigde effectieve commerciële toestand:** leads, woningadvies, accounts, dagmailinschrijving, automatische dagmail en Portal-export uitgeschakeld. Hercontroleer actuele flags; gebruik geen verouderde status als nieuw feit.

## P0 — Niet live vrijgeven zonder bewijs

### P0-01 — Echte MySQL + beheer + herstel (issue #1)

- [ ] Huidige productiebackoffice na inloggen testen: sessie/cookie, CSRF, autorisatie, notities, werkvoorraad, statussen en uitloggen.
- [ ] Toegestane eigen testaanvraag exact éénmaal in productie-MySQL opslaan; aanvraagnummer, NAW, telefoon, eventueel expliciet gedeeld scenario, Pim-label en contactbewijs controleren.
- [ ] Databasepersistentie na applicatieherstart bevestigen; ook bij tijdelijke SMTP-fout blijft de lead opgeslagen.
- [ ] Actuele, herstelbare databaseback-up bevestigen en **niet-destructief herstellen naar een aparte database**; geen productie-restore of destructieve acties.
- [ ] Retentie, gegevensinzage/-export, correctie, intrekking en verwijder-/anonimiseerprocedure vastleggen en voor testdossiers doorlopen.
- [ ] Herstel/replay mag actuele uitschrijvingen en ingetrokken contactrechten niet ongedaan maken.
- [ ] Bewijs alleen geanonimiseerd in QA/documentatie; geen privé- of testcontactgegevens in GitHub.

### P0-02 — E-mail en zelfstandige verwerking (issue #2)

- [x] SMTP-authenticatie door eigenaar als bereikbaar getest.
- [x] Één aparte beheertestmail via echte Zonlio-app door eigenaar ontvangen.
- [x] Hostinger-mailboxquota bekend; appbudget-validatie in productie gemeld als Correct.
- [ ] SPF/DKIM/DMARC en waar relevant afmeldheaders op **werkelijk ontvangen** bericht controleren; geen DNS blind aanpassen.
- [ ] Transactionele aanvraagbevestiging én interne notificatie bij een echte testlead ontvangen en aan correct dossier koppelen; geen dubbeling.
- [ ] Echte accounttoegang- en dagplaninschrijfbevestiging in inbox/spam controleren.
- [ ] Beveiligde Hostinger-cron/maintenance daadwerkelijk installeren (Authorization-header, geen secret in URL); herhaalde succesvolle ticks, ook na herstart, bewijzen.
- [ ] Reële retry, tijdslimiet, rate limits, ongeldige mail, budgetuitputting en verlopen dagplan vóór verzending testen.
- [ ] Hard-bounces/klachten en suppressies voor zelfstandig verzenden operationeel afhandelen of dagmailpilot aantoonbaar beperkt houden tot toegestane volumes met handmatige audit.
- [ ] Verzendvolume binnen Hostinger-limiet bewaken; geen ongeautoriseerde nieuwe provider of kosten.

### P0-03 — Juridische en privacyvrijgave (issue #3)

- [x] NIVO-exploitant en ontvanger bevestigd door eigenaar; live configuratie passend.
- [ ] Definitieve privacy-, formuliertekst-, doelbinding-, contacttermijn- en verwerkerscontrole uitvoeren, inclusief review door bevoegde NIVO-verantwoordelijke.
- [ ] Dienstmails, vrijwillig adviescontact, optionele marketing en statistiektoestemming strikt gescheiden houden; abonnee ≠ belbare lead.
- [ ] Contact- en bewijslast, rechtmatige bewaartermijn en intrekking bij opslag, wachtrij en opvolging E2E toetsen.
- [ ] Commerciële activeringsschakelaars alleen **na** P0-bewijs en expliciete eigenaar-GO instellen. Geen publieke flag als tijdelijke eigenaar-only test beschouwen.
- [ ] Bij activatie bevestigen dat `leadEnabled`/`housingAdviceEnabled` werkelijk true zijn, dat de juiste NIVO-bedrijfsnaam getoond wordt en dat de gratis tool blijft werken.
- [ ] Activerings-/rollback-/incidentbewijs vastleggen met tijd, versie en uitsluitend niet-gevoelige status.

## P1 — Vereist voor volledige zelfstandige leadmachine

### P1-01 — Mijn Zonlio + dagplanservice op productie (issue #9)

- [ ] Eigen testaccount: loginlink, expliciete POST-bevestiging, sessie, opnieuw inloggen, ongebruikte/verlopen/reeds gebruikte link.
- [ ] Persoonlijk energieprofiel en apparaatvoorkeuren opslaan, wijzigen, teruglezen, exporteren en verwijderen op mobiele/desktopbrowser.
- [ ] Abonneren, double opt-in, ochtend-/avondkeuze, pauzeren en afmelden end-to-end; geen lead ontstaat door abonnement.
- [ ] Zelfde persoonlijke dagplanbasis in dashboard en mail; geen financieel voordeel bij constant vast tarief, geen fictieve prijzen/zonopbrengst.
- [ ] Ontbrekende/stale data, winter-/zomertijd, verkeerde contractresolutie, onhaalbare starttijd, wijziging van profiel na queue en dubbele cron-ticks toetsen.
- [ ] Beperkt betrouwbaar verzenden: quota, suppressie, afgekeurde adressen, laatste succesvolle verzending en operationeel pauzeren.
- [ ] Accounts, inschrijven en automatisch versturen **apart** vrijgeven; geen Portal-afhankelijkheid.

### P1-02 — Woningadvies, opvolging en continuïteit

- [ ] Resultaat van de energiecalculator direct zichtbaar vóór vrijwillige NAW/telefoon-aanvraag.
- [ ] Op elke relevante module één begrijpelijke CTA: dagplan, plan bewaren of NIVO-woningadvies.
- [ ] Formulier minimaliseren en eerder bewust verstrekte invoer hergebruiken; context/bronmodule en expliciete scenario-deling registreren.
- [ ] Alleen voor de juiste hulpvraag noodzakelijke volledige adresgegevens verzamelen; intake begrijpelijk op mobiel.
- [ ] Dossierworkflow voor Pim: toegewezen → contactpoging → bereikt → afspraak → offerte → gewonnen/verloren; verantwoordelijkheids-/actiedatum en ingetrokken/verlopen verzoeken duidelijk.
- [ ] Alternatieve bevoegd beheerder/opvolger en storingsfallback vaststellen zodat geen leads blijven liggen wanneer Pim niet beschikbaar is.
- [ ] Nieuwe aanvragen zichtbaar en veilig verwerkbaar in Zonlio-backoffice zonder Portal/Odoo.

### P1-03 — Zelfstandige operations (issue #10)

- [ ] Gezondheidscontrole van prijs-, weer-, mail-, DB-, cron- en queuesysteem; status onderscheidt data klaar/niet klaar.
- [ ] Waarschuwingen bij stale prijsfeed, achterstallige cron, mailfout, wachtende leads en naderende quota; deduplicatie en veilige beheerontvanger.
- [ ] Incidentenrunbook voor Herstart, Mail-stop, Bronuitval, Back-up/herstel, Privacy-intrekking en datalek; geen PII in logs.
- [ ] Beheerrechten/rollen afstemmen op de werkelijke medewerkers; geen gedeeld adminwachtwoord als teamoplossing.
- [ ] Beperkte support-/monitoringlast aantonen; site werkt zonder draaiende Mac of handmatig geplande ChatGPT-taak.
- [ ] Periodieke controle van dependencies, openbare bronvoorwaarden, datarelaties en werkelijk kostenplafond.

### P1-04 — SEO en conversie-analytics (issue #11)

- [ ] Premium design system consistent houden; volledige mobiele Safari-, toetsenbord- en toegankelijkheidscontrole.
- [ ] Interactieve persoonlijke woningplanervaring, duidelijke resultaten, eerlijk prijs-/batterijvoorbehoud en passende CTA's.
- [ ] Indexatie, robots/sitemap, canonical, metadata, structured data en Core Web Vitals verifiëren; geen privéprofielen in index.
- [ ] Inhoudelijke NL-pagina's rond stroomprijzen, slim plannen, zonnepanelen na 1 jan 2027, terugleveren en batterijscenario's koppelen aan tools.
- [ ] Privacyvriendelijke funnelrapportage: module → betekenisvolle berekening → **ontvangen** advies → NIVO-geaccepteerde lead → afspraak/offerte/gewonnen. Geen gokconversieratio, geen pseudo-unique users.
- [ ] SEO-prestaties en broncampagnes zo rapporteren dat conversiekwaliteit voor NIVO zichtbaar is zonder persoonsgegevens in analytics of externe advertentiepixels.

### P1-05 — Portal-ready, maar NIET verbinden (issue #12)

- [x] Zonlio contract v1 en claim/ack-code bestaan al, met stabiele dossier-ID, revisie, stop-events en Pim-label.
- [ ] Claim/ack/retries/idempotentie/intrekking en Portal-achterstand met synthetische data verder verifiëren.
- [ ] Het Portal-ontvangstcontract, eventversies, rotatie/rechten en toekomstige aansluitacceptatie documenteren voor Portal-team.
- [ ] Volledige NIVO-sales blijft mogelijk via Zonlio-backoffice; geen werkelijke Portal-ontvangst claimen.
- [ ] `PORTAL_EXPORT_ENABLED=false` houden. Alleen later bij gereedstaande Portal-ontvanger na aparte E2E-vrijgave aanzetten.
- [ ] Geen rechtstreekse Zonlio→Odoo-connector maken.

## P2 — Verdere producten, géén noodzakelijke blokkade voor eerste zelfstandig draaiende leadmachine

- [ ] Uitbreiding van contract- en apparaatprofielen, contracttariefcorrectheid, planning over middernacht.
- [ ] PV-model op instraling, dakhelling/-richting, vermogen en verliezen in plaats van fictieve weer-naar-kWh omzetting.
- [ ] Interval-batterijmodel met capaciteit, vermogen, verliezen, degradatie, kosten en valide vergelijking.
- [ ] Brongebonden AI-stroomcoach pas na gevalideerde modellen en backtests. Zie #5.
- [ ] Weekeditie, commerciële nieuwsbrieffuncties en uitgebreide experimenten alleen met afzonderlijke opt-in en bewezen verzendcapaciteit.

## Definitieve bedrijfsklare acceptatie (allemaal nodig)

- [ ] Gebruiker kan gratis zonder registratie prijs-/plannings-/scenariofuncties gebruiken.
- [ ] Toestemmingsvrije gratis functie blijft gescheiden van account, dagmail, marketing en belverzoek.
- [ ] Account + bevestiging + afmelding + profielwijziging werken in productie.
- [ ] Eén toegestane woningadvieslead doorloopt opslaan → binnenkomst beheer → notificatie/ontvangst → Pim-opvolging, zonder duplicatie.
- [ ] Cron+mailqueue draaien aantoonbaar door na deploy/restart, binnen providerquota.
- [ ] Storing wordt gealarmeerd; herstel-/pauzestappen zijn uitvoerbaar; lead raakt niet kwijt.
- [ ] Privacyrechten, intrekking, retentie, back-up en restore naar afzonderlijke DB zijn getest.
- [ ] Actieve commerciële flags zijn expliciet door eigenaar vrijgegeven met geanonimiseerd bewijs.
- [ ] SEO en meetbasis werken zonder misleidende claims of privacy-onjuiste tracking.
- [ ] Portal-contract is zelfstandig testbaar en klaar voor latere koppeling, terwijl export op off staat.
- [ ] Actuele README, AGENTS, issue-status, tests, deploy- en operationeel handboek stemmen overeen; alle claims met bewijs.

## GitHub-taskmapping

| Issue | Scope | Gate voor eerste commerciële v1? |
| --- | --- | --- |
| #1 | P0 database/backoffice/privacyrechten/herstel | Ja |
| #2 | P0 SMTP/cron/transactionele E2E | Ja |
| #3 | P0 juridische consistentie en publieke vrijgave | Ja |
| #9 | Accounts/abonnementen/dagplan live E2E | Ja voor volledige mailproductrelease |
| #10 | Monitoring, quota en operationeel beheer | Ja voor autonome exploitatie |
| #11 | Consumentenfunnel, SEO, analytics | Ja voor marketing-/leadmachine-gereedheid |
| #12 | Portal-ready zonder actieve ontvanger | Ja voor handoff; nee voor publieke leads |
| #5 | Geavanceerde PV/batterij/AI | Nee, afzonderlijke verdieping |
| #4 | Gekozen design | Afgerond / gesloten |

**Noodzakelijke eigenaarshandelingen en reeds genomen besluiten:** [OWNER-INPUT-AND-GATES-2026-11-14.md](OWNER-INPUT-AND-GATES-2026-11-14.md).

**Start nieuwe agent:** [START-GPT6PRO-COMPLETION-2026-11-14.md](START-GPT6PRO-COMPLETION-2026-11-14.md).

## Beveiliging en onderhoudsdiscipline

Node 24/Express/MySQL, bestaande bronadapters, `src/design-system.css`, prijsbronlicenties en goedgekeurde productgrenzen behouden. Geen secreten, telefoonnummer, privémail, test-NAW of volledige headers in openbare repo/CI/issues/screenshot. Geen nieuwe betaalde diensten zonder eigenaarakkoord. `main` auto-deployt mogelijk: kleine, geteste, atomische commits, geen force-push; na elke relevante merge GitHub CI, Hostinger- en openbare smoke verifiëren. Geen productie-E2E claimen op grond van lokale mocks of HTTP 200 alleen.
