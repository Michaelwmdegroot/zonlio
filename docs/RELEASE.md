# Zonlio 1.0 — release en vervolg

Datum: 14 november 2026. Dit document maakt onderscheid tussen geïmplementeerde code en werkelijk aangesloten productievoorzieningen.

## Geïmplementeerd

- Gepubliceerde Nederlandse kwartierprijzen en eerlijke bron-, fout- en actualiteitsstatussen.
- Interactieve uur-/kwartiergrafiek, bevestigde contractinvoer en toekomstige verbruiksplanner.
- Regionaal weer, zonder afgeleide fictieve zonneproductie.
- 2027- en batterijscenario's met controleerbare aannames en rapport.
- Aanvragen per e-mail of telefoon, optionele scenario-overdracht en vastgelegd contactverzoek.
- Transactionele databaseopslag, idempotentie en afzonderlijke e-mailwachtrij.
- Afgeschermd beheer met aanvragen, opvolging, notities, statistieken en bron-/mailstatus.
- Hostinger-gerichte Node.js-configuratie, MySQL-adapter, onderhoudsscript en GitHub Actions.

De feitelijk uitgevoerde controles staan in [QA.md](QA.md). Gebruik dit document niet als verklaring dat het domein al deze code serveert.

## Nog te verbinden voor publieke ingebruikname

1. Een bereikbare hostingkoppeling met het juiste Hostinger-account, Node.js-app en domein.
2. De eigen repository op branch `main`, passende Node-runtime en HTTPS.
3. Een productiedatabase, beheerder en servergeheimen via beveiligde configuratie.
4. Authenticatie van `info@zonlio.nl`, SMTP-controle en een gecontroleerde afleveringsproef.
5. Periodieke verwerking van de mailwachtrij en monitoring van mislukte taken.
6. Bevestigde exploitant/privacygegevens en een operationele procedure voor bewaartermijnen, intrekking en verwijdering.
7. Visuele en functionele controle op de echte deployment, inclusief mobiel, foutstatussen en een gecontroleerde testaanvraag.

De beschikbare Hostinger-koppeling kon in deze bouwomgeving niet worden aangeroepen. Hostinger blokkeert bovendien inloggen vanuit de cloudbrowser. Er is daarom geen geslaagde hPanel-handeling, domeinwijziging, mailboxconfiguratie of Hostinger-deployment gerapporteerd.

## Vervolg met de meeste productwaarde

**Na de eerste betrouwbare ingebruikname:** volg de kwaliteit van aanvragen, gekozen onderwerpen, contactkanaal en daadwerkelijke opvolging. Baseer wijzigingen aan de adviesroute op ontvangen aanvragen en opt-in metingen.

**Persoonlijker rekenen:** import van eigen intervalmeetdata en een gevalideerde PV-verwachting met dakgegevens en een passende stralingsbron. Bouw vervolgens een batterijmodel dat tijdsvolgorde, vermogen, capaciteit, verliezen en contractregels verwerkt.

**AI-uitleg:** laat een taalmodel brondata en rekenuitkomsten in gewone taal uitleggen, met vastgelegde bron- en actualiteitsinformatie. Prijsvoorspellingen vragen een afzonderlijk model, onzekerheidsbanden en toetsing op nog niet geziene perioden. De huidige app presenteert deze toekomstige functies niet als al beschikbaar.
