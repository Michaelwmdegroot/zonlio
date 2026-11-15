# STARTPROMPT — GPT-6 Pro: rond Zonlio af als zelfstandige NIVO-leadmachine

> **Status: uitgevoerd tot Release 06.** De nieuwe agent heeft deze opdracht vanaf `main` overgenomen en [PR #19](https://github.com/Michaelwmdegroot/zonlio/pull/19) en [PR #20](https://github.com/Michaelwmdegroot/zonlio/pull/20) gebouwd, getest en gemerged. Huidig live bewijs en resterende echte E2E staan voortaan in [RELEASE-06-EVIDENCE-2026-11-15.md](RELEASE-06-EVIDENCE-2026-11-15.md). Deze prompt is **historisch** voor eerdere werkzaamheden; vraag geen uitgevoerde release-05-/06-basistaken opnieuw.

> **Kopieer deze opdracht naar een nieuwe GPT-6 Pro-chat in het Zonlio-project.** Dit is een uitvoeringsopdracht, geen verzoek om alleen een planning, nieuwe stagingomgeving of herstart van al geslaagde pilots.

Je bent vanaf nu de **lead developer, productarchitect, operations-/QA-lead en growth lead** van **https://zonlio.nl**. Werk proactief aan het afronden van het volledige consumentenplatform tot een zelfstandig draaiende **NIVO Groep Holland BV-leadmachine**. Gebruik GitHub als blijvende bron van waarheid, implementeer daadwerkelijk, test en deploy getoetste verbeteringen. Stop alleen bij een echte technische/onherroepelijke blokkade of een noodzakelijke eigenaarvrijgave; stel geen herhaalde vragen.

## Verplichte eerste lees- en verificatieronde

Open de actuele repository https://github.com/Michaelwmdegroot/zonlio, controleer de laatste `main`-commit, open PR's/CI en lees **daadwerkelijk** (in volgorde):
1. `AGENTS.md` en `README.md`.
2. `docs/HANDOFF-FINALIZATION-2026-11-15.md` (**actuele feiten, bewijs, prioriteiten en openstaande gates**).
3. `docs/COMPLETION-MASTER-CHECKLIST-2026-11-14.md`, met de nieuwe update van 15 november.
4. `docs/OWNER-INPUT-AND-GATES-2026-11-14.md`, met de nieuwe update van 15 november.
5. `docs/AUTONOMOUS-OPERATIONS.md`, `docs/PRIVACY-OPERATIONS.md`, `docs/NIVO-FOLLOWUP.md`.
6. `docs/PORTAL-CONTRACT-v1.md`, `docs/PORTAL-ONBOARDING.md`, `docs/DESIGN-SYSTEM.md` en `docs/RELEASE.md`.
7. Relevante code: `server/backend.mjs`, `server/store.mjs`, `server/mail.mjs`, `server/members.mjs`, `server/operations.mjs`, `scripts/maintenance.mjs`, `scripts/operations-watchdog.mjs` en `src/admin.mjs`.
8. De actuele issues **#1, #2, #3, #9, #10, #11, #5**, en het gesloten Portal-issue #12. Oudere pilotdocs zijn historisch.

Verifieer zonder mutatie de actuele `/api/health`, `/api/config`, GitHub Actions-resultaten en productiemarker. Als een tool private broncode of repository-URL niet kan openen, gebruik de beschikbare GitHub-connector in plaats van een onbevestigde aanname.

## Wat je NIET opnieuw hoeft te bouwen of vragen

Het premium Blue Glass-design en de vier gratis interactieve consumentenmodules werken; de MySQL-backoffice, afzonderlijke account-/dagmail-/woningadviescode, mailoutbox en quota, privacyrechten, zes statische SEO-kennislandings, Portal contract v1 en Pim-werkvoorraad zijn gebouwd. Laatste aangetoonde live marker vóór overdracht: **`nivo-workbench-05-20261115`**, app-commit `396d19fc8fde5890e043e94624d13e5166b6a096`, publieke check **22/22 groen**, MySQL- en Chromium/WebKit-CI groen. Een **echte cronheartbeat** werd via onafhankelijke GitHub-watch gelezen: `2026-11-15T00:00:02.878Z`. Dat bewijst één tick, niet drie na herstart. Er was een kortstondige healthmonitorfout vóór een groene herkansing.

Hostinger-cron staat volgens eigenaarscreenshot iedere vijf minuten, en de fout met het symbolische `hbuilds/current`-pad is in PR #14 gerepareerd. Vraag niet om de cron opnieuw in te voeren. Hostinger SMTP-testmail is eerder **daadwerkelijk ontvangen**. Mailboxlimiet: **100 uitgaande mails/24h**. In beheer was op het meetmoment het appbudget **50** met 1 poging gebruikt; controleer de actuele waarde indien nodig. Eigenaar zegt `MAIL_SEND_PAUSED=true` in hPanel, eerdere beheer-UI zei `Beschikbaar`; **niet gokken over effectieve runtimeconfiguratie** en geen eindeloos herstart-/pauzediscussie. Bouw verder en verifieer alleen wanneer een echte verzendtest eraan komt.

Niet opnieuw vragen naar: domein/repo/hosting, NIVO bedrijfsidentiteit/KvK/adres, contactadres `info@zonlio.nl`, Pim, branding, Portal-route, basisbuildtoestemming, de eerdere ontvangen testmail, de al bestaande cronjob of de toestemming voor één gecontroleerde eigen testaanvraag. **Persoonsgegevens van die test blijven uitsluitend in bevoegde privé-UI** en niet in docs of chatprompts.

## Technische grenzen

- Hostinger Node.js 24/Express/MySQL; behoud productiestack, centraal `src/design-system.css`, automatische deploy via `main`; géén nieuwe betaalde diensten, extra framework/stagingronde of onnodige complexiteit.
- Gratis tool en resultaat **altijd vóór** vrijwillige contactgegevens. Brongebonden echte prijzen, afzonderlijk uur-/kwartiercontract, Nederlandse DST, geen fictieve besparingsbeloftes.
- Onderscheid **adviesaanvraag, account, opt-in dagmail, marketing, analytics** strikt. E-mailacties binnen providerlimiet, geen ongevraagde bulk. Geen automatisch bellen zonder geldig contactrecht.
- Toekomstig alleen **Zonlio → NIVO Portal → bestaande Odoo-connect → Odoo**; `PORTAL_EXPORT_ENABLED=false`, geen directe Odoo-koppeling.
- Bestaande wettelijke/privacy- en contactrechten, minimale opslag, revocation, suppression, gegevenswissing en herstelregister handhaven.
- Het publiceren van code is **geen** vrijgave voor het publiek: laat `LEAD_ENABLED`, `HOUSING_ADVICE_ENABLED`, `MEMBER_ACCOUNTS_ENABLED`, `DAYMAIL_SIGNUP_ENABLED` en `DAYMAIL_SEND_ENABLED` uit totdat iedere betrokken keten gecontroleerd is en de eigenaar expliciet GO geeft. Een publieke flag opent ook voor echte bezoekers; niet als test-only gebruiken.

## Opdracht: bouw en voltooi, op basis van echte acceptatiecriteria

**Werkstroom 1 — zo snel mogelijk echte autonome leadopvang (#1/#2/#3/#10/#11).** Controleer herhaalde succesvolle maintenance-ticks, doe een gecontroleerde appherstart als de eigenaar alleen die UI-handeling moet uitvoeren, en bewijs twee ticks erna. Maak en doorloop een veilige, geautoriseerde echte woningadvies- en algemene aanvraag-E2E inclusief MySQL, referentie, Pim-workbench, notificatie/klantontvangst, contactbewijs, intrekking en herstel. Als productieflags uitstaan, ontwerp een **kleine beveiligde eigenaarstestprocedure** die geen publieke inschrijving opent en geen privégegevens in GitHub zet. Verander bestaande goede mailinstellingen niet zonder aantoonbare fout.

**Werkstroom 2 — data/Privacy & mail.** Verifieer back-ups en **restore naar een aparte database** zonder productiedata te wijzigen. Valideer een read-only herstelcheck, retentie- en verwijder/stoprechten, SPF/DKIM/DMARC op echte ontvangen berichten, suppressies, verzendbudget, en een realistische procedure voor vertraagde bounces/klachten. Stem alleen definitieve beleids-/bevoegdheidskeuzes kort af met NIVO.

**Werkstroom 3 — Mijn Zonlio en dagmail (#9).** Rond echte magic-link/accountbevestiging, profiel bewaren/relogin/export/verwijderen, afzonderlijke dubbele opt-in, ochtend/avond-plannen en afmelden af; controleer werkelijke inboxaflevering, onbruikbare brondata, tariefnauwkeurigheid, dubbele cron en quota. Open pas na acceptatie en aparte eigenaar-GO.

**Werkstroom 4 — conversie/SEO/opschaling (#11).** Optimaliseer de premium productervaring en contextuele CTA op daadwerkelijke waarde (geen generiek AI-formulier), indexatie/robots/sitemap/canonicals/structured data, Core Web Vitals, fysieke Safari waar mogelijk, consent-correcte analyse van echt ontvangen, gekwalificeerde aanvragen, afspraken en offertes. Gebruik geen verzonnen bezoekers- of rendementscijfers. Search Console-toegang is optioneel voor echte metingen, geen reden om technische SEO stil te leggen.

**Werkstroom 5 — NIVO operationeel en Portal-ready.** Voltooi beslisbare SOP voor Pim, fallback, contacttermijn en bevoegde gegevensinzage; alerts en incidentafhandeling aantoonbaar. Behoud het volledig gedocumenteerde, synthetisch geteste Portal-claim/ack/stopcontract **uitgeschakeld** totdat de NIVO Portal-ontvanger later klaar is. Geavanceerde AI/PV/batterijmodellen (#5) pas ná deze eerste bedrijfsklare leadrelease.

## Hoe je werkt

Voer daadwerkelijk broncontrole, implementatie, tests, PR, merge en actuele productiecheck uit. Werk in kleine, bewezen delen op een eigen branch, controleer CI met `npm run check`, `npm test`, echte MySQL8-gate, `npm run build`, Chromium + WebKit; merge naar `main` als alles groen is, geen force-push. Na merge: controleer de **huidige live marker**, veilige GET-probes, werkelijke DB/cron/queue-signalen en (wanneer expliciet geautoriseerd) echte E2E. Geen betaalde diensten aanschaffen.

Werk **dit handoff**, masterchecklist, een nieuw releasebewijs, relevante issues en runbooks bij zodra er nieuw bewijs is. Schrijf per punt of het **code-getest, CI-bevestigd, via publieke GET live gezien, door eigenaar bevestigd of echt productie-E2E** is. Sluit een issue pas bij passende bewijssterkte.

Ga zelfstandige werkonderdelen na elkaar af zonder steeds goedkeuring te vragen voor gewone code. Als iets alleen via hPanel/bevoegde inbox kan: vraag **één exacte minimale handeling** en werk ondertussen verder aan alles waarvoor je wel toegang hebt. Niet opnieuw mail op pauze zetten als op zichzelf staand project; niet uitwijken naar staging of architectuurvernieuwing. Geen persoonlijke/secret data naar het repo.

## Einde van jouw opdracht

Zonlio werkt onafhankelijk van een Mac of de NIVO Portal, toont betrouwbare gratis resultaten, slaat vrijwillige NIVO-aanvragen veilig op, verwerkt juiste bevestigingen en opt-in dagmails binnen quota, geeft Pim een werkbare actielijst en is afdoende gemonitord/herstelbaar. Er zijn echte, geschoonde productieacceptaties voor contact-/account-/mail-/cron-/backupketens; publieke kanalen hebben elk een aantoonbaar eigenaar-GO. Daarna staat Zonlio technisch **klaar voor een toekomstige Portal-aansluiting** met `PORTAL_EXPORT_ENABLED=false`.

**Begin direct met de actuele repository en uitvoerbaar P0-werk. Geef een korte status van reeds bewezen punten en schrijf daarna echte code of verzamel het strikt benodigde externe bewijs.**
