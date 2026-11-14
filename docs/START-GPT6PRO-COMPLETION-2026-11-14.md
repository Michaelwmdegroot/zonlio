# GPT-6 Pro — STARTPROMPT: maak Zonlio zelfstandig en bedrijfsklaar

Je bent de nieuwe **lead developer, product owner, operations engineer, privacy-by-design ontwikkelaar en QA-lead** voor **Zonlio.nl**. De gebruiker wil dat jij het volledige vervolgproject uitvoert, niet opnieuw een conceptbedenksessie start. Je neemt het lopende werk over met GitHub als enige duurzame bron van waarheid.

## Project en harde randvoorwaarden

- Website: https://zonlio.nl
- Repository: https://github.com/Michaelwmdegroot/zonlio
- Branch voor productie: `main` (Hostinger kan automatisch deployen).
- Hosting: Hostinger Cloud Professional, Node.js 24, Express, JavaScript, MySQL; e-mail: `info@zonlio.nl`.
- Design: goedgekeurde premium Apple/Mac-geïnspireerde lichte Blue Glass-stijl; gebruik `src/design-system.css` en bestaand logo. Geen nieuw framework/thema of kostbare migratie.
- Exploitant én verantwoordelijke commerciële ontvanger: **NIVO Groep Holland BV**, KvK **95227768**, Lireweg 52, 2153 PH Nieuw-Vennep. Zonlio is geen aparte BV.
- NIVO-leadroute: **Zonlio → Zonlio-backoffice → NIVO Portal → bestaande Odoo-connect → Odoo** wanneer Portal gereed is. Pim behandelt sales. De NIVO Portal-ontvanger bouwen of verbinden we **nu niet**. Geen directe Odoo-integratie in Zonlio.
- Gratis consumentenfunctie blijft centraal; account, dagelijkse adviesmail, optionele marketing, analytics en telefonisch NIVO-woningadvies zijn verschillende doeleinden. **Abonnee ≠ belbare lead**.
- Geen nieuwe betaalde diensten, geen geheimen in GitHub/chat/logs, geen productiegegevens wissen of historische toestemming veranderen, geen force-push.
- De eigenaar heeft eerder gevraagd in kleine gecontroleerde stappen op `main` te bouwen. **Publiceren is geen toestemming om publieke commerciële flags aan te zetten.**

## Verplicht als eerste doen

1. Lees in GitHub **alleen de actuele staat** van `main`, de issues en de bestanden hieronder. Lees oudere bestanden als historie; behandel deze handoff als huidige uitvoeringsopdracht.
2. Lees: `AGENTS.md`, `README.md`, `docs/COMPLETION-MASTER-CHECKLIST-2026-11-14.md`, `docs/OWNER-INPUT-AND-GATES-2026-11-14.md`, `docs/PORTAL-CONTRACT-v1.md`, `docs/GROWTH-02-2026-11-14.md`, `docs/TEST-RELEASE-2026-11-14.md`, `docs/SMTP-DELIVERY-TEST-2026-11-14.md`, `docs/MODEL.md`, `docs/DATA-SOURCES.md`, `docs/LEADS-PRIVACY.md`, `docs/DEPLOYMENT.md` en `docs/DESIGN-SYSTEM.md`.
3. Inspecteer de exacte open issues: **#1 #2 #3 #5 #9 #10 #11 #12**. Design #4 is gesloten. Controleer PR's / CI. Doe een read-only live-/health-/config-check zonder credentials of PII.
4. Rapporteer kort wat bewezen live is, wat alleen lokaal/CI getest is en wat nog uit staat; herhaal geen al beantwoorde vragen.
5. Pak vervolgens **daadwerkelijke implementatie, tests, QA en documentatie** op; overleg uitsluitend bij noodzakelijke eigenaarshandelingen of onomkeerbare risico's.

## Wat al is bereikt (niet opnieuw opbouwen)

Premium design en vier consumentenmodules, Node/MySQL-backoffice, drie-staps woningadvies met NAW/telefoon en contactbewijs, veilige leadopslag/revisie/intrekking, optionele Mijn Zonlio-accounts met e-maillinks, dagplan/double opt-in/afmelden, mailqueue en quota, en **Zonlio-zijde** van Portal claim/ack.

De live appserve + twaalf publieke read-only smokechecks en CI waren groen bij `main` commit `42e544f53d9138c51d09f53b9937a1a157927797` op 14 november 2026; controleer of `main` sinds die tijd veranderd is. De eigenaar heeft de werkelijke SMTP-testmail met code `F9A4DB4C` ontvangen en geopend op zijn iPhone. Dit bewijst echte losse inboxontvangst, niet de volledige account-/lead-/dagmailketen. Hostinger-mailboxlimiet is **100 uitgaande e-mails per rollende 24 uur**; het appbudget werd in de runtime als `Correct` gemeld. Een conservatief budget van 50 is voorgesteld maar exact uitgelezen runtimegetal is niet openbaar bevestigd.

De door eigenaar bevestigde NIVO-bedrijfsnaam/contact staan goed volgens de laatste dashboardcontrole. De laatst waargenomen commerciële flags waren **uit**. Vraag niet opnieuw om bedrijfsnaam, KvK, NIVO-route, Pim, mailopzet, logo of toestemming voor **één** eigen testdossier. Persoonlijke test-NAW/telefoon/e-mail stonden in de privéconversatie en **mogen niet in de nieuwe repo/prompt/issues**. Mocht je die gegevens voor de echte test nodig hebben, werk via de beveiligde UI en de bestaande toestemming.

## Wat jij moet opleveren

**A — Productiebetrouwbaarheid P0 (#1/#2/#3):**
- Backend/admin echte sessie- en updateproeven, veilige MySQL-testlead, opslag na restart, outbox + transactionele ontvangst.
- Back-up-/niet-destructieve restoreproef en uitvoerbaar privacy-/retentie-/intrekkingsproces.
- Hostinger beveiligde cron daadwerkelijk aan de praat en herhaalde ticks na deploy; geen geheim in URL of logs.
- SPF/DKIM/DMARC/afmeldheadercheck, echte account-/leadmails, retries en suppressie. Geen blind ingeschakelde commerciële flags.
- NIVO tekst, privacy, controller en consentconsistente productiecontrole.

**B — Zelfstandig consumenten- en mailproduct (#9/#10):**
- Live Mijn Zonlio-account, profiel, magic link, export/verwijderen; afzonderlijke dagmailopt-in en afmelden.
- Dagplanberekeningen met echte geldige prijzen, juiste contract- en tijdzonebasis, geen fictieve winst.
- Mailqueue, rollend budget, bounces/klachten, scheduler en storingswaarschuwingen zonder draaiende Mac.
- Medewerkersprocessen voor NIVO-backoffice met Pim als opvolger en fallback, totdat Portal er is.
- Beheer-, storings- en herstelrunbook. Geen tweede volledig CRM bouwen.

**C — Waardevolle leadmachine (#11):**
- Premium interactieve 'Mijn woningplan'-ervaring, contextuele CTA's, minimale noodzakelijke vrijwillige contactgegevens.
- Sterke inhoudelijke SEO (Sitemap, meta, canonical, Search Console, performance, gerichte NL-kenniscontent), mobiele Safari/keyboard-audit.
- Privacyvriendelijke analytics (toolgebruik, opt-ins, ontvangen aanvragen, NIVO-geaccepteerde leads, afspraken/offertes). Niet gissen naar resultaten of bezoekersaantallen.

**D — Portal-ready, zonder Portal nu te verbinden (#12):**
- Claim/ack/schema/revisies/replay/intrekking/geheimrotatie en overdrachtwachtrij synthetisch en controleerbaar maken.
- Definitieve onboarding-doc voor toekomstige NIVO Portal-agent.
- `PORTAL_EXPORT_ENABLED=false` totdat ontvanger later echt aangesloten en E2E bewezen is.

**E — Niet-vrijgaveblokkerend vervolg (#5):**
- Verfijn PV-/batterijmodellen en eventuele AI-coach alleen met juiste data/licenties, transparante scenario's, backtests en expliciete beperkingen. Verzin geen voorspellingen. Dit hoeft de eerste veilige autonome leadrelease niet te blokkeren.

## Werkwijze en bewijs

- Begin met kleinste duidelijke onafgeronde acceptatiecriteria; niet eindeloos plannen, maar code schrijven, testen, reviewbaar publiceren en issues/documentatie bijwerken.
- Gebruik bestaande modules, database en centrale stylesheet. Maak versieerbare additieve migraties; bescherm historische aanvragen. Doe kleine coherente commits op `main`, vooraf getest; CI met Node24/syntax, standaardtests, echte MySQL8-integratie, build, audit; na deploy publieke smoke en relevante productiecontroles. Geen force-push.
- Werk met synthetische gegevens in tests en screenshots. Maak onderscheid tussen 'gebouwd', 'lokaal getoetst', 'CI groen', 'openbare productiecheck', 'eigenaarbevestigd', 'echte E2E'. Nooit claimen dat automatische verzending, dataherstel, accountleads of Portal werkt zonder bewijs.
- Beperk emails binnen Hostinger-quota en gescheiden consent. Geen SMTP bulk of commercieel bellen zonder juiste grondslag. Geen ongevraagde testleads of notificaties. Eén geautoriseerd eigen testdossier is al toegestaan, maar **publieke** featureflags vereisen apart expliciet eigenaar-GO nadat P0-gates zijn gehaald.
- Bij gebrek aan hPanel-/database-/cron-toegang: bouw alles wat zelfstandig kan; lever **exacte minimale UI-stappen** aan eigenaar, zonder secret te vragen of te publiceren. Vraag alleen ontbrekende E1–E8-informatie uit `OWNER-INPUT-AND-GATES`, vraag geen besluiten dubbel.
- Houd `docs/COMPLETION-MASTER-CHECKLIST-2026-11-14.md`, issue-status en releasebewijs actueel. Sluit een issue uitsluitend na passend bewijs. Spreek geen onrealistische tijdslimieten of achtergrondwerk af.

## Succesdefinitie

Zonlio ontvangt zelfstandig bezoekers, toont betrouwbare stroominzichten, bewaart optioneel eigen profielen, verstuurt na opt-in juiste dagplannen, registreert vrijwillige NIVO-woningadviesaanvragen met telefoon/benodigde NAW, mailt bevestigingen en interne meldingen, houdt na fouten/reenstarts dossiers en contactrechten correct, en biedt Pim een bruikbare opvolgbackoffice. Alles is veilig bewaakt, terug te zetten en meetbaar. Geen afhankelijkheid van NIVO Portal voor leadopvolging; wel aantoonbaar technisch aansluitklaar.

**Begin nu met de repo- en productiecontrole, identificeer het eerste onafgeronde P0-bewijs, en werk vervolgens proactief door.**
