# Wat de eigenaar nog nodig heeft te doen of goed te keuren — Zonlio

**Statusdatum:** 14 november 2026, **geactualiseerd 15 november 2026**. **De Hostinger-cron is al aangemaakt**; na de symlinkcorrectie is minimaal één werkelijk opgeslagen tick aangetroffen. Geen herinstallatie vragen. Voor actuele prioriteiten/bewijs zie [definitieve overdracht](HANDOFF-FINALIZATION-2026-11-15.md) en [nieuwe startprompt](NEXT-GPT6PRO-START-2026-11-15.md). Dit document vraagt **geen herhaling van reeds beantwoorde vragen** en bevat geen privaat testdossier of geheim.

## Vaststaande besluiten — NIET opnieuw vragen

- Zonlio valt volledig onder **NIVO Groep Holland BV**, KvK **95227768**, **Lireweg 52, 2153 PH Nieuw-Vennep**. Zonlio is geen eigen BV. Publiek contact/privacyadres: **info@zonlio.nl**.
- Zonlio → **NIVO Portal** → bestaande **Odoo-connect** → Odoo, zodra de Portal ontvanger klaar is. Tot die tijd zelfstandig Zonlio-beheer. Nieuwe woningaanvragen krijgen **Pim** als opvolglabel.
- Premium Blue Glass-stijl, merkkit en centrale stylesheet zijn goedgekeurd.
- Geen nieuwe betaalde tools, geen nieuwe technische architectuur; GitHub `main` en automatische Hostinger-implementaties behouden.
- Avond-/ochtenddagplannen zijn akkoord als opt-in-dienst met geldige data; geen automatische verkoopmailing.
- De eigenaar heeft **één gecontroleerde eigen testaanvraag met zijn persoonsgegevens** eerder expliciet toegestaan. Die gegevens zijn beschikbaar in de eerdere privéchat, maar zijn NIET toegestaan in GitHub, logs, docs, reviewbeelden of een algemene agentprompt. Vraag ze niet opnieuw; gebruik een beveiligde productie-UI of afgesproken veilige testhandeling.
- Hostinger-mailbox heeft **100 uitgaande mails per rollende 24 uur**. SMTP-verbinding werkt; handmatig aangevraagde Zonlio-testmail is **daadwerkelijk ontvangen en geopend**. Een eigenaarsweergave van Zonlio Beheer toonde **1 van 50 gebruikt, 49 beschikbaar, dagmailplafond 40** op dat moment. Dat is het geobserveerde appbudget, niet de actuele teller of het totale Hostinger-verbruik; controleer feitelijk mailverbruik.
- De eigenaar heeft de runtime juridische naam/contact als `Correct` getoond; dit hoeft niet opnieuw ingesteld te worden, tenzij nieuwe status afwijkt.

## Wat de agent grotendeels zelfstandig kan doen

De agent kan op basis van de broncode, GitHub, officiële documentatie en eigen tests de intake, accountmail, dagplan, schedulerlogica, monitoring, SEO, analytics, privacyteksten **als concept**, data-/herstelscripts, veilige tutorials, testcases en releases bouwen. Geen toestemming nodig voor gewone codeontwikkeling, lezen van publieke health, onderzoeken van architectuur of tests met synthetische data. Publicatie op `main` is gewenst mits veilige, aantoonbaar geteste kleine commits en geen ongecontroleerde productieactivering.

**Een Hostinger Mail-connectie geeft geen automatische toegang tot hPanel, de database of cron.** Als de agent die omgeving niet kan bedienen, voer hieronder de strikt noodzakelijke UI-handelingen uit of verschaf expliciet toegestane beperkte koppeling zonder wachtwoorden in chat.

## Concrete overdracht na afrondingsrelease 04

De bouw-/testvoortgang staat in [release 04](AUTONOMY-04-RELEASE-2026-11-14.md). Hostinger hPanel blokkeerde aanmelden vanuit de cloudbrowser; daarom blijven uitsluitend de noodzakelijke hosting-/productiehandelingen hier bij de eigenaar. De mailconnector is geen hostingtoegang.

- **E1 (update):** cronopdracht **al ingesteld**, één tick vastgelegd. Alleen geplande herhaling / herstartbewijs nog afmaken volgens [AUTONOMOUS-OPERATIONS.md](AUTONOMOUS-OPERATIONS.md).
- **E2/E5:** gebruik de aparte restorechecker, het privéherstelregister en het concrete conceptbewaarbeleid uit [PRIVACY-OPERATIONS.md](PRIVACY-OPERATIONS.md).
- **E3/E6:** leg de echte eigen account-/advies-/dagmailketens en geschoonde authenticatie-/afmeldresultaten vast; de losse SMTP-test hoeft niet opnieuw.
- **E4:** bekrachtig alleen de open proceskeuzes in [NIVO-FOLLOWUP.md](NIVO-FOLLOWUP.md). Pim, entiteit en route staan vast; deel geen beheerwachtwoord als teamoplossing.
- **E7:** geef publieke diensten afzonderlijk vrij na bewijs. `LEAD_ENABLED` is nu expliciet apart van bedrijfsbevestiging en woningadvies. Portal blijft uit.

## Wat we nog echt van de eigenaar nodig hebben

### E1 — Cron bestaat; alleen herhaalde werking na herstart nog aantonen

- **Gedaan:** eigenaar heeft één Node24 Hostinger-cronjob voor elke vijf minuten ingesteld; na [symlinkfix PR #14](https://github.com/Michaelwmdegroot/zonlio/pull/14) toont de [GitHub-operationscheck](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43656137432) **minimaal één echte opgeslagen maintenance-tick** op `2026-11-15T00:00:02.878Z`.
- **Nog open:** leg drie geplande ticks vast, inclusief minimaal twee na een gecontroleerde appherstart; verifieer vervolgens de actuele bewaking en eventuele echte alertontvangst. **Vraag niet de cronjob opnieuw in te voeren.**
- Eigenaar hoeft alleen een beperkte appherstart of ingelogde beheercontrole te doen wanneer de agent die niet geautoriseerd zelf kan uitvoeren. Geen `CRON_SECRET` of volledige `.env` in chat/GitHub.
- Pas de claim 'volledig autonoom' en onbeperkte dagmail aan nadat herhaling/continuïteit zijn bewezen.

### E2 — Databaseback-up en afzonderlijke restoreproef (eigenaar/Hostinger-beheer)

- Agent levert backup-checklist en niet-destructieve restore-instructie; gebruik alleen extra testdatabase.
- Eigenaar bevestigt dat Hostinger-back-up beschikbaar en herstel uitvoerbaar is, of maakt dit via hPanel mogelijk.
- Deel datum/status van succes zonder volledige SQL-export of klantgegevens.
- **Blokkeert vrijgave van persoonsgegevens in de volledige productieketen.**

### E3 — Eigen test van volledige routes (eigenaar kan test via website uitvoeren)

- Eigenaar voert de reeds toegestane eigen testlead in **via de beveiligde werkende UI**, niet via chat/GitHub. Agent geeft exacte testvolgorde en controleert dossiers/status via veilige tools als die beschikbaar zijn.
- Test **account magic link, opslaan/relogin, dagmailopt-in, uitschrijven, woningadvies met NAW/telefoon en ontvangst van transactionele bevestiging**. De losse testmail is al geslaagd maar vervangt deze tests niet.
- Meld per onderdeel alleen `gelukt/mislukt`, referentiecode en eventuele **geanonimiseerde** fout; geen persoonsgegevens in issue.
- **Blokkeert claim 'volledig end-to-end werkend'.**

### E4 — NIVO-proces voor opvolging bekrachtigen (enkele bedrijfsbesluiten)

De ontvanger en Pim staan al vast. Agent mag een werkbaar concept-SOP voorstellen, maar eigenaar moet nog bevestigen:
- Welk geografisch werkgebied en welke diensten zijn in scope voor de aanvragen?
- Wat is de realistische terugbeltermijn, maximale contactpogingen en de fallback wanneer Pim afwezig is?
- Wie krijgt tot de Portal-koppeling toegang tot het **Zonlio-beheer** en mag NAW zien?
Geen extra medewerkersaccounts of onbevestigde contactbeloftes publiceren.

### E5 — Privacy-/bewaarbeleid en toestemmingsteksten definitief goedkeuren (eigenaarbesluit)

- Agent ontwerpt concreet bewaarschema voor actieve leads, gesloten dossiers, onverifieerde accounts, abonnementen, contactbewijzen, bounces/logs en backups en levert definitieve privacy-/verwerkerschecklist.
- Eigenaar/NIVO-bevoegde keurt beleid en verstrekte bezoekersinformatie goed (en betrekt waar nodig juridisch/privacyadvies).
- Intrekking, dataverwijdering en eventuele uitwisseling blijven aantoonbaar uitvoerbaar.
- **Geen automatisch marketingopt-in afleiden uit dagmails, account of offerte.**

### E6 — E-mailauthenticatie en live afleverresultaten (agent waar mogelijk, eigenaar alleen waar nodig)

- De agent controleert publieke SPF/DKIM/DMARC-records, voor zover mogelijk, zonder blind wijzigen.
- Eigenaar controleert één echte ontvangen **transactionele** account-/leadbevestiging en eventueel de geanonimiseerde verificatiestatus in mailheaders; geen volledige headers met privégegevens in GitHub.
- Agent bewaakt gezamenlijke mailboxlimiet 100/24 uur en werkelijke appbudgetwaarde; bij groei een capaciteitsbesluit voorleggen **zonder** zelf een betaalde provider aan te schaffen.

### E7 — Expliciete vrijgave van publieke diensten (eigenaar-GO)

Na bewijs van P0 en E1–E6 maakt agent één helder GO/HOLD-besluit per dienst:
1. Algemene adviesvragen (`LEAD_ENABLED`) en woningadvies (`HOUSING_ADVICE_ENABLED`) afzonderlijk, met `LEAD_CONTROLLER_CONFIRMED` alleen na werkende opslag/contactproces;
2. Mijn Zonlio-account en dagplaninschrijving;
3. Dagelijks automatisch versturen na scheduler/afmelding/quotacontrole;
4. **Portal-export voorlopig NO-GO**, totdat de ontvangende Portal gereed en apart getest is.

**Code publiceren op `main` is geen toestemming om deze publieke flags te activeren.** De agent vraagt hoogstens het korte nog ontbrekende expliciete GO, niet eerdere keuzes opnieuw. Publieke flags betekenen dat ook echte bezoekers de route kunnen gebruiken; de eigenaarstest is geen geheime allowlist.

### E8 — Toegang tot externe prestatiedata (optioneel, niet P0)

- Indien Google Search Console of geauthenticeerde webstatistiek nodig is, kan eigenaar een geschikte beperkte connector koppelen of property-verificatie zelf voltooien.
- Dit is nuttig voor SEO, maar geen blocker voor veilige leadopslag of dagplan.

## Niet van eigenaar nodig om te beginnen of voortgang te maken

Geen nieuwe projectbrief, logo, repository, KvK, NIVO-route, verkoopontvanger, dagmailkeuze of nieuwe testpersoon. Geen wachtwoorden/tokens in chat. Geen voorafgaande Portal-ontwikkeltaken. Geen betaalde verzending vóór expliciet akkoord. Geen namen/telefoon/e-mail uit privétestdata in openbare issues.

**Volgende agent:** maak van dit document een concrete, korte eigenaar-actie met maximaal de op dat moment vereiste stappen; bouw en toets zelfstandig verder waar geen gebruikersactie nodig is. Stop pas bij een echte toegang-/vrijgaveblokkade en lever dan exacte hPanel/UI-stappen.
