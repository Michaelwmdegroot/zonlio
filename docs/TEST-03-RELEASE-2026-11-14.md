# Testrelease 03 — publicatiebewijs

14 november 2026. **Applicatie op main; nieuwe productieobservatie en de eigenaarstest afzonderlijk vaststellen.**

## Gepubliceerde applicatie

Applicatiecommit: `f9288845ada5739f1f8063c1791ebbc4508ca0e6`, marker `test-ready-03-20261114`.

[Verificatie vóór applicatiepublicatie, run 43614935034](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43614935034) heeft de daadwerkelijke kandidaat gecontroleerd, inclusief echte MySQL. Daarna is één samenhangende applicatiecommit naar main gepusht zonder force-push. Tijdelijke transferbestanden zijn uit de eindwijziging verwijderd; deze afsluiting verwijdert de eenmalige delivery-workflow.

- Node 24-syntaxcontrole: **51 modules**.
- Standaardteststap: **113 tests totaal, 112 geslaagd, 1 afzonderlijke MySQL-gate in deze stap overgeslagen**, geen fouten.
- Afzonderlijke echte MySQL 8-gate: **8 tests geslaagd, geen overgeslagen tests**.
- Productiebuild: **27 publieke bestanden**.
- Dependency-audit: **0 kwetsbaarheden gerapporteerd** tijdens deze run.
- Verificatieartifact SHA-256: `4af1b281662d09fb9a5aa62256ab2a376cb343ccab3182cf8345d11c4c04b46f`. De **18** gewijzigde applicatie-/test-/documentatiebestanden in het teruggehaalde bronarchief zijn bytegelijk vergeleken met de lokaal geteste kandidaat: alle gelijk.

## Wijzigingen

`/admin#testen` geeft na beheerlogin een read-only controle van het draaiende proces: bedrijfsnaam en contact afzonderlijk, databaseleesproef, origin/alias, mailconfiguratie, budget, onderhoudssleutel en de afzonderlijke functieschakelaars. Geen rauwe omgevingswaarden, geheimen, klantgegevens of testlogin. Het paneel heeft geen activeringsknop en verandert geen productieconfiguratie.

SMTP-verificatie gebruikt de bestaande afgeschermde, CSRF-beveiligde route en verstuurt geen e-mail; een begrenzing voorkomt onbeperkt herhalen. Het dashboard ververst nu ook configuratie en diagnose, in plaats van de opstartstatus te blijven tonen. De veilige tijdstempels zijn procesgebonden, geen permanente auditregistratie.

`npm run test:live` doet **12 uitsluitend openbare GET-controles** op verwachte release, vijf pagina's, stylesheet/modules en geweigerde toegang tot beheerdiagnose en privéprofiel. De publieke observatieworkflow gebruikt dit na een geslaagde main-push-CI of handmatig. Hij heeft alleen leesrechten, geen productiecredentials, geen geplande periodieke uitvoering en geen POSTs. Een ontbrekende release of kapotte route geeft een foutstatus. Een groene observatie is **geen** SMTP-/inbox-/cron-/restore-/Portal-test of commerciële vrijgave.

## Lokale controles en grenzen

De twaalf probes slaagden tegen een geïsoleerde lokale backend. De nieuwe beheercomponent is met de echte stylesheet en lokale backendrespons getest op 320/375/390/768/1440 pixels, zonder horizontale pagina-overflow. Uitklappen werkt met klikken en toetsenbord. Door een browserbeleidblokkade was dit een statische componentfixture, geen volledige browser-E2E op Hostinger. Geen fysieke Safari-/iPhone-test of productiecookieproef claimen.

De eigenaar meldde dat de hostingvariabelen correct staan. De voorafgaande publieke runtimecontrole op **14 november om 17:02:58 Europe/Amsterdam** zag nog `operatorConfigured:false` bij groei-iteratie 2. Dit is geen bewijs dat de instellingen niet zijn opgeslagen; de actieve runtime kan een oudere waarde hebben. De nieuwe afzonderlijke booleans wijzen bij de volgende productieobservatie de betreffende sleutel aan zonder de waarde te tonen. Na deze nieuwe deployment opnieuw waarnemen; de oude observatie niet als actuele eindstatus behandelen.

## Testen en vrijgave

Testvolgorde en benodigde schakelaars: [TEST-RELEASE-2026-11-14.md](TEST-RELEASE-2026-11-14.md). Lees bij de volgende stap eerst de actuele runtime. Exacte NIVO-identiteit, route via NIVO Portal, Pim als opvolger, mailopzet en toestemming voor een eigen testdossier zijn al bevestigd; vraag deze niet opnieuw.

Geen persoonlijke eigenaarstestgegevens in Git, geen echte mail verzonden en geen Hostinger-variabelen door deze ronde gewijzigd. Accounts/leadopvang en automatische dagmail/Portal-export hebben elk eigen schakelaars; dat zijn **publieke** functieschakelaars, geen eigenaar-only allowlist. Schakel niets blind aan vanwege deze codepublicatie.

Werkelijke inboxbezorging, quota, blijvende cron, back-up/restore en de Portal-ontvanger blijven afzonderlijk te bewijzen. De ontbrekende Portal-ontvanger, volledige bounces/klachten, multi-userrollen, wekelijkse mail en geavanceerde modellen zijn niet voltooid door dit controlescherm. Geen nieuwe betaalde dienst toegevoegd.

De gewone main-CI en de openbare observatie op de afsluitende commit worden na uitvoering gecontroleerd. Leg hun uitkomst vast bij issue #3 of in een volgende productienotitie; claim geen productiegroen uitsluitend op basis van deze voorafgaande tests.
